const { getLobby, leaveLobby, addSocketID } = require("../controllers/lobby");
const { verifySocketToken } = require("../helpers/jwt");
const { generateUpdate } = require("../helpers/utils");

const lobbySocket = ({ io, socket}) => {
    socket.on("joinLobby", async ({ token }, callback) => {
        try {
            if (!token) {
                throw new Error("Unauthorized Access!");
            }
    
            const { player } = await verifySocketToken({ token });
    
            if (player.currState.playerIn !== "InLobby") {
                throw new Error("Please join a Room!");
            }
    
            const { room } = await getLobby({ roomID: player.currState.collectionID, "players.userName": player.userName });  
    
            await addSocketID({ socketID: socket.id, userName: player.userName, roomID: player.currState.collectionID });
    
            socket.join(room.roomID);
            
            socket.to(room.roomID).emit("updatePlayers", { players: room.players });    

            socket.to(room.roomID).emit("updates", generateUpdate({ message: `${player.userName} has joined the room` }));
        } catch (error) {
            console.log(error);
            return callback(error.err || "Please join in a room!");
        }
    });

    socket.on("sendMessage", async ({ message }, callback) => {
        try {
            if (message.length > 256) {
                callback({ err: "Message characters limit reached!" });
                return;
            }
            
            const { room } = await getLobby({ "players.socketID": socket.id });

            const playerIndex = room.players.findIndex(player => player.socketID.toString() === socket.id.toString());
            if (playerIndex === -1) {
                throw new Error();
            }

            socket.to(room.roomID).emit("recieveMessage", { message, timeStamp: new Date().toLocaleString(), userName: room.players[playerIndex].userName });
            callback({ message, timeStamp: new Date().toLocaleString(), userName: room.players[playerIndex].userName });
        } catch (error) {
            callback({ err: error.message || "Something went wrong. Please try again!" });
        }
    });

    socket.on("leaveLobby", async ({ token }) => {
        try {
            if (!token) {
                throw new Error("Unauthorized Access!");
            }
    
            const { player } = await verifySocketToken({ token });
    
            if (player.currState.playerIn !== "InLobby") {
                throw new Error("Please join a Room!");
            }

            const roomID = player.currState.collectionID;
            
            const { players } = await leaveLobby({ roomID, userName: player.userName });

            socket.leave(roomID);

            io.to(roomID).emit("updatePlayers", { players });
            
            io.to(roomID).emit("updates", generateUpdate({ message: `${player.userName} has left the room` }));
        } catch (error) {
            // callback(error.err || error.message || "An error occurred while removing the player from the room.");
        }
    });
}

module.exports = lobbySocket;