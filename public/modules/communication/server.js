const express = require("express");

const http = require("http");

const { Server } = require("socket.io");

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(express.static("public"));

let waitingUser = null;

io.on("connection", (socket) => {

    console.log("User connected:", socket.id);

    if (
        waitingUser &&
        waitingUser !== socket.id &&
        io.sockets.sockets.has(waitingUser)
    ) {

        io.to(waitingUser).emit("peer-ready", socket.id);

        io.to(socket.id).emit("peer-ready", waitingUser);

        waitingUser = null;

    } else {

        waitingUser = socket.id;

    }

    socket.on("offer", ({offer, to}) => {

        io.to(to).emit("offer", {
            offer,
            from: socket.id
        });

    });

    socket.on("answer", ({answer, to}) => {

        io.to(to).emit("answer", {
            answer,
            from: socket.id
        });

    });

    socket.on("ice-candidate", ({candidate, to}) => {

        io.to(to).emit("ice-candidate", {
            candidate,
            from: socket.id
        });

    });

    socket.on("disconnect", () => {

        if (waitingUser === socket.id) {

            waitingUser = null;

        }

        console.log("User disconnected");

    });

});

const PORT = process.env.PORT || 4040;

server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Set a different PORT or stop the process using it.`);
        process.exit(1);
    } else {
        throw err;
    }
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
