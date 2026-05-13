(function(){
// P2P client for integration into main site modal
// Uses vyuha.config.js on the hub (load that script before this file); fallback matches server default in vyuha-p2p/server.js
const _cfg = typeof window !== "undefined" && window.VYUHA_CONFIG ? window.VYUHA_CONFIG : {};
const _p2pBase = String(_cfg.p2pSocketUrl || _cfg.p2pUrl || "http://localhost:4040")
  .replace(/\/$/, "");
const socket = io(_p2pBase);

const joinBtn = document.getElementById("joinBtn");
const sendBtn = document.getElementById("sendBtn");
const locationBtn = document.getElementById("locationBtn");
const messageInput = document.getElementById("messageInput");
const chatBox = document.getElementById("chatBox");
const statusDiv = document.getElementById("status");

let peerConnection;
let dataChannel;
let peerId;

const configuration = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" }
    ]
};

if(joinBtn){
    joinBtn.addEventListener("click", () => {
        statusDiv.innerText = "Waiting for peer...";
    });
}

socket.on("connect", () => {
    console.log('p2p client connected', socket.id);
    if(statusDiv && socket.connected) statusDiv.innerText = 'Connected to signaling';
});

socket.on("peer-ready", async (id) => {
    peerId = id;
    createPeerConnection();
    // tie-breaker: use socket ids lexicographically
    if(socket.id < peerId){
        dataChannel = peerConnection.createDataChannel("chat");
        setupDataChannel();
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit("offer", { offer, to: peerId });
    }
});

function createPeerConnection(){
    peerConnection = new RTCPeerConnection(configuration);
    peerConnection.onicecandidate = (event) => {
        if(event.candidate){
            socket.emit("ice-candidate", { candidate: event.candidate, to: peerId });
        }
    };
    peerConnection.ondatachannel = (event) => {
        dataChannel = event.channel;
        setupDataChannel();
    };
}

function setupDataChannel(){
    dataChannel.onopen = () => {
        if(statusDiv) statusDiv.innerText = "Peer Connected";
    };
    dataChannel.onmessage = (event) => {
        try{
            const data = JSON.parse(event.data);
            if(data.type === "location"){
                const locationLink = `https://maps.google.com/?q=${data.latitude},${data.longitude}`;
                addLocationMessage("Peer shared location", locationLink);
                return;
            }
        }catch(e){}
        addMessage("Peer: " + event.data);
    };
}

socket.on("offer", async ({offer, from}) => {
    peerId = from;
    createPeerConnection();
    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit("answer", { answer, to: peerId });
});

socket.on("answer", async ({answer}) => {
    await peerConnection.setRemoteDescription(answer);
});

socket.on("ice-candidate", async ({candidate}) => {
    try{ await peerConnection.addIceCandidate(candidate); }catch(err){ console.log(err); }
});

if(sendBtn){
    sendBtn.addEventListener("click", () => {
        const message = messageInput.value;
        if(message.trim() === "") return;
        if(message.length > 200){ alert("Message too large for low bandwidth mode"); return; }
        addMessage("You: " + message);
        if(dataChannel && dataChannel.readyState === "open"){ dataChannel.send(message); } else { alert("Peer not connected"); }
        messageInput.value = "";
    });
}

if(messageInput){
    messageInput.addEventListener("keypress", (event) => { if(event.key === "Enter") sendBtn.click(); });
}

if(locationBtn){
    locationBtn.addEventListener("click", () => {
        if(!navigator.geolocation){ alert("Geolocation not supported"); return; }
        navigator.geolocation.getCurrentPosition((position) => {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;
            const locationData = JSON.stringify({ type: "location", latitude, longitude });
            if(dataChannel && dataChannel.readyState === "open"){ dataChannel.send(locationData); } else { alert("Peer not connected"); }
            const myLocationLink = `https://maps.google.com/?q=${latitude},${longitude}`;
            addLocationMessage("You shared location", myLocationLink);
        });
    });
}

function addMessage(message){
    if(!chatBox) return;
    const div = document.createElement("div");
    div.classList.add("message");
    div.innerText = message;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function addLocationMessage(text, link){
    if(!chatBox) return;
    const div = document.createElement("div");
    div.classList.add("message");
    div.innerHTML = `${text}<br><br><a href="${link}" target="_blank" style="color:#93c5fd;">Open Location</a>`;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Optional: try clean-up when modal closes
window.addEventListener('modalClosed', () => {
    try{ if(dataChannel) dataChannel.close(); }catch(e){}
    try{ if(peerConnection) peerConnection.close(); }catch(e){}
});

})();
