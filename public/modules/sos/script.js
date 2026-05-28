const socket = io(
  "https://vyuha-backend.onrender.com"
);

let map;
let sosMarkers = {};
let disasterZones = [];

/* CONNECTION */

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

    if (dot)
      dot.style.background =
        "#00ff99";

    if (text)
      text.innerText =
        "Connected";
  }
);

socket.on(
  "disconnect",
  () => {

    if (dot)
      dot.style.background =
        "red";

    if (text)
      text.innerText =
        "Disconnected";
  }
);

/* MAP */

if (
  document.getElementById(
    "map"
  )
) {

  map =
    L.map("map").setView(
      [20.5937, 78.9629],
      5
    );

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution:
        "© OpenStreetMap"
    }
  ).addTo(map);
  setTimeout(() => {

  map.invalidateSize();

}, 300);
}

/* DISASTER API */

async function loadDisasters() {

  if (!map) return;

  try {

    const res =
      await fetch(
        "https://vyuha-backend.onrender.com/api/disasters"
      );

    const data =
      await res.json();

    disasterZones = [];

    data.forEach(
      (d) => {

        /* VALIDATE */

        if (
          !d.coordinates ||
          d.coordinates.lat == null ||
          d.coordinates.lng == null
        ) {

          return;
        }

        let color =
          "#00ff99";

        let radius =
          50000;

        /* DISASTER TYPE */

        if (
          d.type &&
          d.type.toLowerCase() ===
          "earthquake"
        ) {

          color =
            "#FFD93D";

          radius =
            60000;
        }

        else if (

          d.type &&
          d.type.toLowerCase() ===
          "tsunami"

        ) {

          color =
            "#3ba4ff";

          radius =
            90000;
        }

else if (

  d.type &&
  d.type.toLowerCase() ===
  "severe weather"

) {

  color =
    "#42D674";

  radius =
    70000;
}

        disasterZones.push({

          lat:
            d.coordinates.lat,

          lng:
            d.coordinates.lng,

          radius,

          type:
            d.type
        });

        /* ZONE */

        L.circle(

          [
            d.coordinates.lat,
            d.coordinates.lng
          ],

          {
            radius,

            color,

            fillColor:
              color,

            fillOpacity:
              0.12,

            weight:2
          }

        ).addTo(map);

        /* MARKER */

        L.circleMarker(

          [
            d.coordinates.lat,
            d.coordinates.lng
          ],

          {

            radius:8,

            color,

            fillColor:
              color,

            fillOpacity:
              0.9,

            weight:2
          }

        )

        .addTo(map)

        .bindPopup(`

          <b>
            ${d.type}
          </b>

          <br>

          ${d.title || "Live Disaster"}

          <br>

          Magnitude:
          ${d.magnitude || "N/A"}

        `)

        .openPopup();

      }
    );

    /* LEAFLET REFRESH */

    setTimeout(() => {

      map.invalidateSize();

    },300);

  }

  catch (err) {

    console.error(
      "Disaster load failed:",
      err
    );
  }
}
loadDisasters();

/* AI RISK */

function calculateRisk(
  lat,
  lng
) {

  let risk =
    "LOW";

  disasterZones.forEach(
    (z) => {

      const dist =
        map.distance(
          [lat, lng],
          [z.lat, z.lng]
        );

      if (
        dist <
        z.radius
      ) {

        risk =
          "HIGH";
      }
    }
  );

  const el =
    document.getElementById(
      "riskLevel"
    );

  if (el) {

    el.innerText =
      risk;

    el.className =
      "risk " +
      risk.toLowerCase();
  }

  return risk;
}

/* FEED */

function addFeed(
  data
) {

  const feed =
    document.getElementById(
      "feedContainer"
    );

  if (!feed)
    return;

  if (
    feed.innerText.includes(
      "Awaiting"
    )
  ) {

    feed.innerHTML =
      "";
  }

  if (
    document.getElementById(
      `sos-${data.id}`
    )
  ) return;

  feed.innerHTML += `
    <div
      id="sos-${data.id}"
      class="feed-item"
    >

      🚨 SOS RECEIVED

      <br><br>

      ${data.disasterType}

      <br><br>

      ${data.lat.toFixed(
        4
      )},
      ${data.lng.toFixed(
        4
      )}

      <br><br>

      <button
        onclick="
          acknowledgeSOS(
            '${data.id}'
          )
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
      >
        RESOLVED
      </button>

    </div>
  `;
}

/* MARKER */

function addSOSMarker(
  data
) {

  if (
    sosMarkers[data.id]
  ) return;

  const marker =
    L.circleMarker(
      [
        data.lat,
        data.lng
      ],
      {
        radius: 10,
        color:
          "#ff3b3b",
        fillOpacity:
          0.9
      }
    ).addTo(map);

  marker.bindPopup(`
    <b>🚨 SOS</b>
    <br>
    ${data.assessment}
  `);
  marker.openPopup();

  sosMarkers[data.id] =
    marker;
}

/* SOS */

function triggerSOS() {

  navigator.geolocation.getCurrentPosition(

    (pos) => {

      const lat =
        pos.coords.latitude;

      const lng =
        pos.coords.longitude;

      const risk =
        calculateRisk(
          lat,
          lng
        );

      const data = {

        id:
          Date.now(),

        lat,
        lng,

        disasterType:
          "Emergency",

        assessment:
          risk +
          " RISK AREA"
      };

      socket.emit(
        "send-sos",
        data
      );

      addSOSMarker(
        data
      );

      addFeed(
        data
      );

      map.setView(
        [lat, lng],
        13
      );

      const b =
        document.getElementById(
          "broadcastText"
        );

      if (b) {

        b.innerHTML = `
          🚨 SOS ACTIVE
          <br><br>
          ${lat.toFixed(
            4
          )},
          ${lng.toFixed(
            4
          )}
          <br><br>
          ${risk}
        `;
      }

    },

    (err) => {

      alert(
        err.message
      );
    },

    {
      enableHighAccuracy:
        true
    }
  );
}

/* RECEIVE */

socket.on(
  "receive-sos",
  (data) => {

    addSOSMarker(
      data
    );

    addFeed(
      data
    );
  }
);

socket.on(
  "active-sos",
  (list) => {

    list.forEach(
      addSOSMarker
    );

    list.forEach(
      addFeed
    );
  }
);

/* HELP */

function acknowledgeSOS(
  id
) {

  socket.emit(
    "help-accepted",
    {
      id,
      helper:
        "Nearby User"
    }
  );
}

socket.on(
  "helper-accepted",
  (d) => {

    alert(
      d.helper +
      " accepted help"
    );
  }
);

/* RESOLVE */

function resolveSOS(
  id
) {

  socket.emit(
    "resolve-sos",
    id
  );
}

socket.on(
  "sos-resolved",
  (id) => {

    if (
      sosMarkers[id]
    ) {

      map.removeLayer(
        sosMarkers[id]
      );

      delete
        sosMarkers[id];
    }

    const el =
      document.getElementById(
        `sos-${id}`
      );

    if (el)
      el.remove();
  }
);