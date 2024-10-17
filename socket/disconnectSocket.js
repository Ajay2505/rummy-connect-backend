const { leaveLobby, getLobby } = require("../controllers/lobby");
const { getMatch } = require("../controllers/match");
const { resetPlayerCurrState } = require("../controllers/player");
const { generateUpdate } = require("../helpers/utils");

const disconnectSocket = ({ socket, io }) => {
    return new Promise(async resolve => {
        try {
            const { room } = await getLobby({ "players.socketID": socket.id });
            const player = room.players.find(p => p.socketID.toString() === socket.id.toString());

            // Room in Lobby   
            if (!room.currentMatch) {
                const { players } = await leaveLobby({ roomID: room.roomID, userName: player.userName });
                socket.leave(room.roomID);
                await resetPlayerCurrState({ userName: player.userName });
        
                io.to(room.roomID).emit("updatePlayers", { players });
                        
                io.to(room.roomID).emit("updates", generateUpdate({ message: `${player.userName} has left the room` }));
                return resolve();
            }

            const { match } = await getMatch({ matchID: room.currentMatch, "players.userName": player.userName });
            const playerIdx = match.players.findIndex(p => p.userName === player.userName);
            if (match.players[playerIdx].playerStatus !== "Lost") {
                match.players[playerIdx].playerStatus = "Offline";                
                await match.save();
            }

            await resetPlayerCurrState({ userName: player.userName });
            
            socket.leave(room.roomID);
            
            io.to(match.roomID).emit("updatePlayers", { players: match.players });
            io.to(match.roomID).emit("updates", generateUpdate({ message: `${player.userName} has left the match` }));
            
            resolve();
        } catch (error) {
            resolve();
        }
    });

}

module.exports = disconnectSocket;