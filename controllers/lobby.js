const Lobby = require("../models/lobby");
const { v4: uuidv4 } = require('uuid');
const { updatePlayersCurrState } = require("./player");

const that = {};


that.getOpenLobbies = query => {
    return new Promise(async (resolve, reject) => {
        try {
            const lobbies = await Lobby.find({ isPublicRoom: true, lobbyStatus: "InLobby", ...query }) || [];        
            
            const rooms = lobbies.filter(lobby => lobby.players.length < lobby.maxPlayers);
            
            resolve({ rooms });
        } catch (error) {
            reject({ err: "Something went wrong. Please try again later!" });
        }
    });
}

that.createLobby = ({ query, player }) => {
    return new Promise(async (resolve, reject) => {
        try {
            const room = new Lobby({ ...query });
            room.players.push({ userName: player.userName, isAdmin: true });

            const roomID = uuidv4(); 
            room.roomID = roomID;
    
            player.currState = { playerIn: "InLobby", collectionID: roomID };
            
            // room.updates.push({ message: `${player.userName} has created the room!`, timeStamp: new Date() });
            
            await room.save();
    
            await player.save();
            
            resolve({ room });
        } catch (error) {
            console.log(error);
            reject({ err: "Something went wrong. Please try again later!" });
        }
    });
}

that.getLobby = query => {
    return new Promise(async (resolve, reject) => {
        try {
            const room = await Lobby.findOne(query);
            if (!room) {
                return reject({ err: "Sorry! Can't find the room you are looking for.", status: 404 });
            }
            resolve({ room });
        } catch (error) {
            console.log(error);
            reject({ err: "Something went wrong. Please try again later!", status: 500 });
        }
    });
}

that.returnToLobby = ({ roomID, matchID, players }) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (!roomID || !matchID) {
                throw new Error();
            }

            const room = await Lobby.findOne({ roomID, currentMatch: matchID, lobbyStatus: "InGame" });
            if (room) {
                room.lobbyStatus = "InLobby";
                room.currentMatch = undefined;
                room.matches.push(matchID);
                for (let i = 0; i < players.length; i++) {
                    if (players[i]?.playerStatus === "Offline") {
                        const playerIdx = room.players.findIndex(p => p.userName === players[i].userName);
                        if (playerIdx > -1) {
                            room.players.splice(playerIdx, 1);
                        }
                    }
                }

                await room.save();
            }

            resolve();
        } catch (error) {
            reject({ err: error.err || error.message || "Something went wrong", status: error.status || 500 });            
        }
    });
}

that.addPlayerToLobby = ({ player, room }) => {
    return new Promise(async (resolve, reject) => {
        try {        
            if (room.maxPlayers < room.players.length) {
                throw new Error("Maximum players limit has reached!");
            }
    
            room.players.push({ userName: player.userName, isAdmin: room.players.length === 0 });
    
            player.currState = { playerIn: "InLobby", collectionID: room.roomID };            
            
            await room.save();
    
            await player.save();
            
            resolve({ updatedRoom: room });
        } catch (error) {
            reject({ err: error.message, status: 500 });
        }
    });
}

that.addSocketID = ({ socketID, userName, roomID }) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (!socketID || !userName || !roomID) {
                throw new Error("Something went wrong! Please try again.");
            }
    
            const lobby = await Lobby.findOne({ roomID, "players.userName": userName });

            if (!lobby) {
                throw new Error("Something went wrong! Please try again.");            
            }

            const playerIndex = lobby.players.findIndex(player => player.userName === userName);
            if (playerIndex === -1) {
                throw new Error("Please join in the room!");
            }

            lobby.players[playerIndex].socketID = socketID;
            
            await lobby.save();

            resolve();
        } catch (error) {
            console.log(error);
            reject({ err: error.message });
        }
    });
}

that.setCurrMatch = ({ room, matchID }) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (!room || !matchID) {
                throw new Error("Something went wrong. Please try again later!");
            }
            room.currentMatch = matchID;
            room.lobbyStatus = "InGame";

            for (let i = 0; i < room.players.length; i++) {
                room.players[i].playerStatus = "InGame";
            }

            await room.save();
            await updatePlayersCurrState({ players: room.players, playerIn: "InGame", collectionID: matchID });
    
            resolve();
        } catch (error) {
            console.log(error, "setCurr");
            reject({ err: error.message || "Something went wrong. Please try again!", status: 500 });
        }
    });
}

that.leaveLobby = ({ roomID, userName }) => {
    return new Promise(async (resolve, reject) => {
        try {
            const room = await Lobby.findOne({ roomID, "players.userName": userName, lobbyStatus: "InLobby" });
            if (!room) {
                throw new Error("Something went wrong. Please try again!");
            }
            
            const playerIndex = room.players.findIndex(p => p.userName.toString() === userName.toString());
            if (playerIndex === -1) {
                throw new Error("Player not found in the room!");
            }
    
            const player = room.players[playerIndex];
            
            room.players.splice(playerIndex, 1);
            if (player.isAdmin === true && room.players.length > 0) {
                room.players[0].isAdmin = true;
            }
            
            await room.save();

            resolve({ players: room.players || [], player });
        } catch (error) {
            console.log(error.message);
            reject({ err: error.message || "Something went wrong. Please try again!" });
        }
    });
}

module.exports = that; 