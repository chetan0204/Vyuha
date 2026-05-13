const socket =
  typeof window !== "undefined" && window.__VYUHA_P2P__
    ? io(window.__VYUHA_P2P__)
    : io();

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
        {
            urls: "stun:stun.l.google.com:19302"
        }
    ]
};

joinBtn.addEventListener("click", () => {

    statusDiv.innerText = "Waiting for peer...";

});

socket.on("peer-ready", async (id) => {

    peerId = id;

    createPeerConnection();

    if(socket.id < peerId){

        dataChannel = peerConnection.createDataChannel("chat");

        setupDataChannel();

        const offer = await peerConnection.createOffer();

        await peerConnection.setLocalDescription(offer);

        socket.emit("offer", {
            offer,
            to: peerId
        });

    }

});

function createPeerConnection(){

    peerConnection = new RTCPeerConnection(configuration);

    peerConnection.onicecandidate = (event) => {

        if(event.candidate){

            socket.emit("ice-candidate", {
                candidate: event.candidate,
                to: peerId
            });

        }

    };

    peerConnection.ondatachannel = (event) => {

        dataChannel = event.channel;

        setupDataChannel();

    };

}

function setupDataChannel(){

    dataChannel.onopen = () => {

        statusDiv.innerText = "Peer Connected";

    };

    dataChannel.onmessage = (event) => {

        try{

            const data = JSON.parse(event.data);

            if(data.type === "location"){

                const locationLink =
                    `https://maps.google.com/?q=${data.latitude},${data.longitude}`;

                addLocationMessage(
                    "Peer shared location",
                    locationLink
                );

                return;
            }

        }catch{

        }

        addMessage("Peer: " + event.data);

    };

}

socket.on("offer", async ({offer, from}) => {

    peerId = from;

    createPeerConnection();

    await peerConnection.setRemoteDescription(offer);

    const answer = await peerConnection.createAnswer();

    await peerConnection.setLocalDescription(answer);

    socket.emit("answer", {
        answer,
        to: peerId
    });

});

socket.on("answer", async ({answer}) => {

    await peerConnection.setRemoteDescription(answer);

});

socket.on("ice-candidate", async ({candidate}) => {

    try{

        await peerConnection.addIceCandidate(candidate);

    }catch(err){

        console.log(err);

    }

});

sendBtn.addEventListener("click", () => {

    const message = messageInput.value;

    if(message.trim() === "") return;

    if(message.length > 200){

        alert("Message too large for low bandwidth mode");

        return;
    }

    addMessage("You: " + message);

    if(dataChannel && dataChannel.readyState === "open"){

        dataChannel.send(message);

    }else{

        alert("Peer not connected");

    }

    messageInput.value = "";

});

messageInput.addEventListener("keypress", (event) => {

    if(event.key === "Enter"){

        sendBtn.click();

    }

});

locationBtn.addEventListener("click", () => {

    if(!navigator.geolocation){

        alert("Geolocation not supported");

        return;
    }

    navigator.geolocation.getCurrentPosition((position) => {

        const latitude = position.coords.latitude;

        const longitude = position.coords.longitude;

        const locationData = JSON.stringify({
            type: "location",
            latitude,
            longitude
        });

        if(dataChannel && dataChannel.readyState === "open"){

            dataChannel.send(locationData);

        }else{

            alert("Peer not connected");

        }

        const myLocationLink =
            `https://maps.google.com/?q=${latitude},${longitude}`;

        addLocationMessage(
            "You shared location",
            myLocationLink
        );

    });

});

function addMessage(message){

    const div = document.createElement("div");

    div.classList.add("message");

    div.innerText = message;

    chatBox.appendChild(div);

}

function addLocationMessage(text, link){

    const div = document.createElement("div");

    div.classList.add("message");

    div.innerHTML = `
        ${text}<br><br>
        <a 
            href="${link}" 
            target="_blank"
            style="color:#93c5fd;"
        >
            Open Location
        </a>
    `;

    chatBox.appendChild(div);

}