require("dotenv").config();

const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const path = require('path');
const cors = require("cors");

const connectToDataBase = require("./config/database");

const loginRouter = require("./routers/login.js");
const lobbyRouter = require("./routers/lobby.js");
const matchRouter = require("./routers/match.js");

const lobbySocket = require("./socket/lobby.js");
const disconnectSocket = require("./socket/disconnectSocket.js");
const matchSocket = require("./socket/match.js");
const { setTimeEndedMatches } = require("./controllers/match.js");
const resultsSocket = require("./socket/results.js");

const allowedOrigins = process.env.FRONTEND_ORIGIN.split(',');

const app = express();
const server = http.createServer(app);
const io = socketio(server, { path: '/ws',
 cors: {
        origin: allowedOrigins,
        methods: ["GET", "PUT", "POST", "DELETE", "PATCH"],
        allowedHeaders: ["Content-Type", "Authorization"],
    },
 });

app.use(express.json());

connectToDataBase();

const corsOptions = {
    origin: allowedOrigins,
    methods: ["GET", "PUT", "POST", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(express.static(path.join(__dirname, 'build')));

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.use('/', loginRouter);
app.use('/', lobbyRouter);
app.use('/', matchRouter);

io.on("connection", socket => {
    // console.log("Connected", socket.id);

    setTimeEndedMatches({ io });

    lobbySocket({ io, socket });
    matchSocket({ io, socket });
    resultsSocket({ io, socket });
    
    socket.on("disconnect", () => disconnectSocket({ io, socket }));
}); 

server.listen(process.env.PORT, () => {
    console.log("Server is running on port " + process.env.PORT);
});