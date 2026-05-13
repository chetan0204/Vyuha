const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

/* SERVE FRONTEND */

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

/* DANGER ZONES */

const dangerZones = [
  {
    lat: 17.385,
    lng: 78.486,
    radius: 5000,
    level: "HIGH"
  }
];

/* LIVE DISASTERS */

let liveDisasters = [];

/* CONNECTED USERS */

let connectedUsers = {};

/* ACTIVE SOS */

let activeSOS = [];

/* WEATHER API */

const WEATHER_API_KEY =
  "9196d3efbc112fad4a24095bf3a27ea1";

/* DISTANCE CALCULATION */

function getDistance(
  lat1,
  lon1,
  lat2,
  lon2
) {

  const R = 6371e3;

  const φ1 =
    lat1 * Math.PI / 180;

  const φ2 =
    lat2 * Math.PI / 180;

  const Δφ =
    (lat2 - lat1) *
    Math.PI / 180;

  const Δλ =
    (lon2 - lon1) *
    Math.PI / 180;

  const a =

    Math.sin(Δφ / 2) *
    Math.sin(Δφ / 2) +

    Math.cos(φ1) *
    Math.cos(φ2) *

    Math.sin(Δλ / 2) *
    Math.sin(Δλ / 2);

  const c =

    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return R * c;
}

/* DISASTER ASSESSMENT */

function getDisasterAssessment(
  lat,
  lng
) {

  let nearest = null;

  let minDistance =
    Infinity;

  for (
    const disaster
    of liveDisasters
  ) {

    const dist =
      getDistance(
        lat,
        lng,
        disaster.lat,
        disaster.lng
      );

    if (
      dist < minDistance
    ) {

      minDistance =
        dist;

      nearest =
        disaster;
    }
  }

  if (!nearest) {

    return {

      disasterType:
        "NONE",

      assessment:
        "No nearby disaster zones"
    };
  }

  return {

    disasterType:
      nearest.type,

    assessment:
      `${(
        minDistance / 1000
      ).toFixed(1)}km from disaster zone`
  };
}

/* FETCH LIVE DISASTERS */

async function fetchDisasters() {

  try {

    /* EARTHQUAKES */

    const eq =
      await axios.get(
        "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson"
      );

    const earthquakes =
      eq.data.features.map(
        (q) => {

          return {

            type:
              "EARTHQUAKE",

            lat:
              q.geometry.coordinates[1],

            lng:
              q.geometry.coordinates[0],

            magnitude:
              q.properties.mag || 0,

            place:
              q.properties.place,

            radius:
              q.properties.mag >= 6
                ? 100000
                : q.properties.mag >= 4
                ? 50000
                : 20000
          };
        }
      );

   /* LIVE WEATHER */

const weatherResponse =
  await axios.get(
    `https://api.openweathermap.org/data/2.5/weather?q=Visakhapatnam&appid=9196d3efbc112fad4a24095bf3a27ea1`
  );

const weatherData =
  weatherResponse.data;

const weather = [

  {

    type:
      "severe weather",

    title:
      weatherData.weather[0]
        .description,

    magnitude:
      weatherData.wind.speed,

    radius:
      90000,

    coordinates: {

      lat:
        weatherData.coord.lat,

      lng:
        weatherData.coord.lon
    }
  }
];

    /* COMBINE */

    liveDisasters = [

      ...earthquakes,

      ...weatherDisasters
    ];

    console.log(
      "🌍 Live disasters updated:",
      liveDisasters.length
    );

  } catch (err) {

    console.error(
      "Disaster fetch failed:",
      err.message
    );
  }
}

/* INITIAL FETCH */

fetchDisasters();

/* REFRESH */

setInterval(
  fetchDisasters,
  1000 * 60 * 5
);

/* SOCKET */

io.on(
  "connection",
  (socket) => {

    console.log(
      "User connected:",
      socket.id
    );

    /* SEND LIVE DATA */

    socket.emit(
      "live-disasters",
      liveDisasters
    );

    socket.emit(
      "active-sos",
      activeSOS
    );

    /* REGISTER USER */

    socket.on(
      "register-user",
      (data) => {

        connectedUsers[
          socket.id
        ] = {

          lat: data.lat,
          lng: data.lng
        };

        console.log(
          "📍 User registered:",
          socket.id
        );
      }
    );

    /* ACKNOWLEDGEMENT */

    socket.on(
      "responder-ack",
      (data) => {

        io.emit(
          "acknowledged",
          {
            sosId:
              data.sosId,

            message:
              "A responder is helping."
          }
        );
      }
    );

    /* RESOLVE SOS */

    socket.on(
      "resolve-sos",
      (id) => {

        /* REMOVE FROM ACTIVE LIST */

        activeSOS =
          activeSOS.filter(
            (s) =>
              s.id !== id
          );

        console.log(
          "✅ SOS Resolved:",
          id
        );

        /* BROADCAST REMOVAL */

        io.emit(
          "sos-resolved",
          id
        );
      }
    );

    /* DISCONNECT */

    socket.on(
      "disconnect",
      () => {

        delete connectedUsers[
          socket.id
        ];

        console.log(
          "❌ User disconnected:",
          socket.id
        );
      }
    );
  }
);

/* SOS API */

app.post(
  "/api/sos",
  (req, res) => {

    const data =
      req.body;

    const assessment =
      getDisasterAssessment(
        data.lat,
        data.lng
      );

    const payload = {

      id:
        Date.now(),

      ...data,

      disasterType:
        assessment.disasterType,

      assessment:
        assessment.assessment,

      resolved:
        false
    };

    console.log(
      "🚨 SOS:",
      payload
    );

    /* STORE ACTIVE */

    activeSOS.push(
      payload
    );

    /* NEARBY BROADCAST */

    for (
      const id
      in connectedUsers
    ) {

      const user =
        connectedUsers[id];

      const dist =
        getDistance(
          data.lat,
          data.lng,
          user.lat,
          user.lng
        );

      /* 50KM RANGE */

      if (dist <= 50000) {

        io.to(id).emit(
          "new-sos",
          payload
        );
      }
    }

    res.json({
      success: true,
      assessment
    });
  }
);

/* START SERVER */

server.listen(
  5000,
  () => {

    console.log(
      "Server running on http://localhost:5000"
    );
  }
);