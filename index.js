require("dotenv").config();

const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const cron = require('node-cron');

const cors = require("cors");

const connectToDataBase = require("./config/database");

const loginRouter = require("./routers/login.js");
const lobbyRouter = require("./routers/lobby.js");
const matchRouter = require("./routers/match.js");

const lobbySocket = require("./socket/lobby.js");
const disconnectSocket = require("./socket/disconnectSocket.js");
const matchSocket = require("./socket/match.js");
const { timeValidation } = require("./helpers/cron.js");

const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.use(express.json());

connectToDataBase();

const corsOptions = {
    origin: 'http://localhost:3000', // Allow requests from this origin
    methods: ["GET", "PUT", "POST", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(loginRouter);
app.use(lobbyRouter);
app.use(matchRouter);

io.on("connection", socket => {
    console.log("Connected", socket.id);
    
    cron.schedule('*/5 * * * * *', async () => {
        await timeValidation({ io });
    });

    lobbySocket({ io, socket });
    matchSocket({ io, socket });

    socket.on("disconnect", () => disconnectSocket({ io, socket }));
});

server.listen(process.env.PORT, () => {
    console.log("Server is running on port " + process.env.PORT);
});