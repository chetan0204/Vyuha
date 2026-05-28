const express = require("express");
const path = require("path");
const http = require("http");
const axios = require("axios");
const { Server } = require("socket.io");

const app = express();

const server =
  http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

/* MAIN WEBSITE */

app.use(
  express.static(
    path.join(__dirname, "../public")
  )
);

/* MISSING PERSON MODULE */

app.use(
  "/missing-person",
  express.static(
    path.join(
      __dirname,
      "../public/modules/missing-person"
    )
  )
);

/* COMMUNICATION MODULE */

app.use(
  "/communication",
  express.static(
    path.join(
      __dirname,
      "../public/modules/communication"
    )
  )
);

/* SOS MODULE */

app.use(
  "/sos",
  express.static(
    path.join(
      __dirname,
      "../public/modules/sos"
    )
  )
);

/* RESOURCES MODULE */

app.use(
  "/resources",
  express.static(
    path.join(
      __dirname,
      "..",
      "public",
      "modules",
      "resources"
    )
  )
);
/* LIVE DISASTER API */

app.get(
  "/api/disasters",
  async (req, res) => {

    try {

      /* EARTHQUAKES */

      const quakeResponse =
        await axios.get(
          "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson"
        );

      const earthquakes =
        quakeResponse.data.features.map(
          (q) => ({

            type:
              "earthquake",

            title:
              q.properties.place,

            magnitude:
              q.properties.mag,

            radius:
              50000,

            coordinates: {

              lat:
                q.geometry.coordinates[1],

              lng:
                q.geometry.coordinates[0]
            }
          })
        );

      /* TSUNAMI */

      const tsunami =
        earthquakes
          .filter(
            (q) =>
              q.magnitude >= 7
          )
          .map(
            (q) => ({

              type:
                "tsunami",

              title:
                `Potential tsunami near ${q.title}`,

              magnitude:
                q.magnitude,

              radius:
                120000,

              coordinates:
                q.coordinates
            })
          );

      /* LIVE WEATHER */

      const weatherResponse =
        await axios.get(
          "https://api.openweathermap.org/data/2.5/weather?q=Visakhapatnam&appid=9196d3efbc112fad4a24095bf3a27ea1"
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

      /* COMBINED */

      const disasters = [

        ...earthquakes,
        ...tsunami,
        ...weather
      ];

      res.json(
        disasters
      );

    } catch (err) {

      console.error(
        err.message
      );

      res.status(500).json({
        error:
          "Disaster fetch failed"
      });

    }

  }
);

/* VARIABLES */

let waitingUser = null;

let activeSOS = [];

/* SOCKET SERVER */

io.on(
  "connection",
  (socket) => {

    console.log(
      "User connected:",
      socket.id
    );

    /* COMMUNICATION */

    if (
      waitingUser &&
      waitingUser !== socket.id &&
      io.sockets.sockets.has(waitingUser)
    ) {

      io.to(waitingUser).emit(
        "peer-ready",
        socket.id
      );

      io.to(socket.id).emit(
        "peer-ready",
        waitingUser
      );

      waitingUser = null;

    } else {

      waitingUser = socket.id;

    }


    /* ACTIVE SOS */

    socket.emit(
      "active-sos",
      activeSOS
    );

    /* SEND SOS */

    socket.on(
      "send-sos",
      (data) => {

        activeSOS.push(data);

        io.emit(
          "receive-sos",
          data
        );

      }
    );

    /* HELP ACCEPTED */

    socket.on(
      "help-accepted",
      (data) => {

        io.emit(
          "helper-accepted",
          data
        );

      }
    );

    /* RESOLVE SOS */

    socket.on(
      "resolve-sos",
      (id) => {

        activeSOS =
          activeSOS.filter(
            (s) =>
              s.id != id
          );

        io.emit(
          "sos-resolved",
          id
        );

      }
    );

    /* COMMUNICATION */

socket.on(
  "offer",
  ({offer,to})=>{

    io.to(to).emit(
      "offer",
      {
        offer,
        from:socket.id
      }
    );

  }
);

socket.on(
  "answer",
  ({answer,to})=>{

    io.to(to).emit(
      "answer",
      {
        answer,
        from:socket.id
      }
    );

  }
);

socket.on(
  "ice-candidate",
  ({candidate,to})=>{

    io.to(to).emit(
      "ice-candidate",
      {
        candidate,
        from:socket.id
      }
    );

  }
);

    /* DISCONNECT */

    socket.on(
      "disconnect",
      () => {

        if (
          waitingUser === socket.id
        ) {

          waitingUser = null;

        }

        console.log(
          "User disconnected"
        );

      }
    );

  }
);

/* START SERVER */

const PORT = 5000;

server.listen(
  PORT,
  () => {

    console.log(
      `Server running on http://localhost:${PORT}`
    );

  }
);