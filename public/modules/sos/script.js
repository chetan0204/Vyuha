const socket = io();

const activeMarkers = {};

/* CONNECTION STATUS */

const dot =
  document.getElementById(
    "connectionDot"
  );

const text =
  document.getElementById(
    "connectionText"
  );

socket.on(
  "connect",
  () => {

    dot.style.background =
      "#00ff99";

    text.innerText =
      "Connected";
  }
);

socket.on(
  "disconnect",
  () => {

    dot.style.background =
      "red";

    text.innerText =
      "Disconnected";
  }
);

/* EMERGENCY POPUP */

function showEmergencyPopup(data) {

  const existing =
    document.getElementById(
      "emergencyPopup"
    );

  if (existing) {

    existing.remove();
  }

  const popup =
    document.createElement("div");

  popup.id =
    "emergencyPopup";

  popup.innerHTML = `

    <div style="
      position:fixed;
      top:30px;
      right:30px;
      width:340px;
      background:#101826;
      border:1px solid rgba(255,255,255,0.08);
      border-left:6px solid #ff3b3b;
      border-radius:20px;
      padding:22px;
      z-index:999999;
      color:white;
      box-shadow:0 0 40px rgba(0,0,0,0.45);
      backdrop-filter:blur(14px);
      font-family:sans-serif;
    ">

      <div style="
        font-size:18px;
        font-weight:bold;
        color:#ff4d4d;
        margin-bottom:14px;
      ">
        🚨 LIVE SOS ALERT
      </div>

      <div style="
        line-height:1.8;
        font-size:14px;
      ">

        <b>Disaster:</b>
        ${data.disasterType}

        <br><br>

        <b>Assessment:</b>
        ${data.assessment}

        <br><br>
<b>Coordinates:</b>

${Number(data.lat).toFixed(5)},
${Number(data.lng).toFixed(5)}

<br><br>

<b>Accuracy:</b>
${Math.round(data.accuracy)}m

      </div>

      <button
        onclick="
          document.getElementById(
            'emergencyPopup'
          ).remove()
        "

        style="
          margin-top:18px;
          width:100%;
          background:#ff3b3b;
          border:none;
          color:white;
          padding:12px;
          border-radius:12px;
          cursor:pointer;
          font-weight:bold;
        "
      >
        CLOSE ALERT
      </button>

    </div>
  `;

  document.body.appendChild(
    popup
  );

  setTimeout(() => {

    const popup =
      document.getElementById(
        "emergencyPopup"
      );

    if (popup) {

      popup.remove();
    }

  }, 10000);
}

/* MAP */

const map =
  L.map("map").setView(
    [20.5937, 78.9629],
    5
  );

L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    attribution:
      "OpenStreetMap"
  }
).addTo(map);

/* LOAD LIVE DISASTERS */

async function loadDisasters() {

  try {

    const response =
      await fetch(
        "/api/disasters"
      );

    const disasters =
      await response.json();

    disasters.forEach(
      (d) => {

        let color =
          "#00ff99";

        if (
          d.type ===
          "tsunami"
        ) {

          color =
            "#3ba4ff";
        }

        if (
          d.type ===
          "severe weather"
        ) {

          color =
            "#ffcc00";
        }

        const zone =
          L.circle(
            [
              d.coordinates.lat,
              d.coordinates.lng
            ],
            {
              radius:
                d.radius || 50000,

              color,

              fillColor:
                color,

              fillOpacity:
                0.12
            }
          ).addTo(map);

        const marker =
          L.circleMarker(
            [
              d.coordinates.lat,
              d.coordinates.lng
            ],
            {
              radius: 8,

              color,

              fillOpacity:
                0.9
            }
          ).addTo(map);

        marker.bindPopup(`
          <div style="
            color:white;
            line-height:1.8;
            font-family:sans-serif;
          ">

            <div style="
              font-size:16px;
              font-weight:bold;
              color:${color};
              margin-bottom:10px;
            ">
              ${d.type.toUpperCase()}
            </div>

            <div>
              ${d.title}
            </div>

            <div style="
              margin-top:10px;
            ">
              Magnitude:
              <b>
                ${d.magnitude}
              </b>
            </div>

          </div>
        `);

      }
    );

  } catch (err) {

    console.error(
      "Disaster API failed",
      err
    );
  }
}

loadDisasters();

/* ADD SOS MARKER */

function addSOSMarker(data) {

  if (
    activeMarkers[data.id]
  ) return;

  const marker =
    L.circleMarker(
      [data.lat, data.lng],
      {
        radius: 10,

        color:
          "#ff3b3b",

        fillOpacity:
          0.9
      }
    ).addTo(map);

  const accuracyCircle =
    L.circle(
      [data.lat, data.lng],
      {
        radius:
          data.accuracy || 50,

        color:
          "#ff3b3b",

        fillOpacity:
          0.08,

        weight: 1
      }
    ).addTo(map);

  marker.bindPopup(`
    <div style="
      color:white;
      line-height:1.8;
      font-family:sans-serif;
    ">

      <div style="
        font-size:16px;
        font-weight:bold;
        color:#ff4d4d;
        margin-bottom:10px;
      ">
        🚨 SOS ALERT
      </div>

      <div>
        ${data.disasterType}
      </div>

      <div style="
        margin-top:10px;
      ">
        ${data.assessment}
      </div>

      <div style="
        margin-top:10px;
      ">
        Accuracy:
        ${Math.round(
          data.accuracy
        )}m
      </div>

    </div>
  `);

  activeMarkers[data.id] = {
    marker,
    circle:
      accuracyCircle
  };
}

/* APPEND SOS FEED */

function appendSOSFeed(data) {

  const feed =
    document.getElementById(
      "feedContainer"
    );

  if (
    document.getElementById(
      `sos-${data.id}`
    )
  ) return;

  feed.innerHTML += `

    <div
      id="sos-${data.id}"

      style="
        background:
          rgba(255,255,255,0.03);

        border:
          1px solid rgba(255,255,255,0.05);

        border-radius:20px;

        padding:20px;

        margin-bottom:18px;

        line-height:1.9;
      "
    >

      🚨 SOS RECEIVED

      <br><br>

      Disaster:
      ${data.disasterType}

      <br><br>

      Coordinates:
      ${Number(data.lat).toFixed(4)},
      ${Number(data.lng).toFixed(4)}

      <br><br>

      Accuracy:
      ${Math.round(
        data.accuracy
      )}m

      <br><br>

      <button
        onclick="
          acknowledgeSOS(
            '${data.id}'
          )
        "

        style="
          background:#00ff99;
          border:none;
          padding:12px 20px;
          border-radius:14px;
          font-weight:bold;
          cursor:pointer;
          margin-right:10px;
        "
      >
        I CAN HELP
      </button>

      <button
        onclick="
          resolveSOS(
            '${data.id}'
          )
        "

        style="
          background:#ff3b3b;
          border:none;
          padding:12px 20px;
          border-radius:14px;
          font-weight:bold;
          cursor:pointer;
          color:white;
        "
      >
        RESOLVED
      </button>

    </div>
  `;
}

/* SEND SOS */

async function triggerSOS() {

  if (
    !navigator.geolocation
  ) {

    alert(
      "Geolocation unsupported"
    );

    return;
  }

  navigator.geolocation.getCurrentPosition(

    (pos) => {

      const sosData = {

        id:
          Date.now(),

        lat:
          pos.coords.latitude,

        lng:
          pos.coords.longitude,

        accuracy:
          pos.coords.accuracy,

        disasterType:
          "EARTHQUAKE",

        assessment:
          "Nearby users alerted"
      };

      socket.emit(
        "send-sos",
        sosData
      );

      addSOSMarker(
        sosData
      );

      appendSOSFeed(
        sosData
      );

    },

    (err) => {

      alert(
        err.message
      );
    },

    {
      enableHighAccuracy:
        true,

      timeout: 15000,

      maximumAge: 10000
    }
  );
}

/* RECEIVE SOS */

socket.on(
  "receive-sos",
  (data) => {

    addSOSMarker(data);

    appendSOSFeed(data);

    showEmergencyPopup(data);

    map.setView(
      [data.lat, data.lng],
      12
    );

    const broadcast =
      document.getElementById(
        "broadcastText"
      );

    broadcast.innerHTML = `
      🚨 Emergency Broadcast Active

      <br><br>

      Disaster:
      <b>
        ${data.disasterType}
      </b>

      <br><br>

      Assessment:
      <b>
        ${data.assessment}
      </b>

      <br><br>

      Accuracy:
      ${Math.round(
        data.accuracy
      )}m
    `;
  }
);

/* ACTIVE SOS */

socket.on(
  "active-sos",
  (list) => {

    list.forEach(
      (data) => {

        addSOSMarker(data);

        appendSOSFeed(data);
      }
    );
  }
);

/* ACKNOWLEDGE */

function acknowledgeSOS(id) {

  socket.emit(
    "help-accepted",
    {
      id,
      helper:
        "Nearby User"
    }
  );
}

/* ACK RECEIVED */

socket.on(
  "helper-accepted",
  (data) => {

    showEmergencyPopup({
      disasterType:
        "HELP ACKNOWLEDGED",

      assessment:
        `${data.helper} is coming to help`,

      accuracy: 0
    });
  }
);

/* RESOLVE */

function resolveSOS(id) {

  socket.emit(
    "resolve-sos",
    id
  );
}

/* REMOVE RESOLVED */

socket.on(
  "sos-resolved",
  (id) => {

    const element =
      document.getElementById(
        `sos-${id}`
      );

    if (element) {

      element.remove();
    }

    if (
      activeMarkers[id]
    ) {

      map.removeLayer(
        activeMarkers[id]
          .marker
      );

      map.removeLayer(
        activeMarkers[id]
          .circle
      );

      delete activeMarkers[id];
    }
  }
);