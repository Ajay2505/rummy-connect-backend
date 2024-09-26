const express = require("express");
const router = new express.Router();

const Filter = require("bad-words");

const { addGuest, updatePlayersCurrState } = require("../controllers/player");
const { createLobby, getOpenLobbies, getLobby, addPlayerToLobby } = require("../controllers/lobby");
const { verifyToken } = require("../helpers/jwt");
const { getMatch } = require("../controllers/match");

const filter = new Filter();

router.post("/create-room", verifyToken,  async (req, res) => {
    const keys = Object.keys(req.body);
    const allowed = ["roomName", "maxPlayers", "timeLimit", "roomType"];
    const isValid = keys.every((key) => allowed.includes(key));

    if (!isValid) {
        return res.status(400).send({ message: "Invalid Information" });
    }

    const { roomName, maxPlayers, timeLimit, roomType } = req.body;

    if (!roomName || !maxPlayers || !timeLimit || !roomType) {
        return res.status(422).send({ message: "One or many empty fields!" });
    }

    if (roomName && (typeof roomName !== "string" || roomName.length < 4)) {
        return res.status(422).send({ message: "Invalid Name!" });
    }

    if (filter.isProfane(roomName)) {
        return res.status(400).send({ message: "Bad words are not allowed as Room Name!" });
    }

    if (maxPlayers && (typeof maxPlayers !== "number")) {
        if (maxPlayers < 1) {
            return res.status(422).send({ message: "Minimum One Player needs to join the room!" });            
        }
        if (maxPlayers > 5) {
            return res.status(422).send({ message: "Maximum of Five Player are allowed to join the room!" });
        }
        return res.status(422).send({ message: "Invalid Number of players!" });
    }

    // if (betAmount && (typeof betAmount !== "number")) {
    //     if (betAmount < 100) {
    //         return res.status(422).send({ message: "Bet must be a minimum of 100 Coins!" });
    //     }
    //     if (betAmount > 1000) {
    //         return res.status(422).send({ message: "Maximum bet is of 1000 coins!" });
    //     }
    //     return res.status(422).send({ message: "Invalid Bet Amount is selected. Please try again!" });
    // }

    if (timeLimit && (typeof timeLimit !== "number")) {
        if (timeLimit < 40) {
            return res.status(422).send({ message: "Time Limit must be a minimum of 40 seconds!" });
        }
        if (timeLimit > 100) {
            return res.status(422).send({ message: "Maximum time limit is of 100 seconds!" });
        }
        return res.status(422).send({ message: "Invalid Time Limit is selected. Please try again!" });
    }

    if (roomType && (typeof roomType !== "string" || (roomType !== "Public" && roomType !== "Private"))) {
        return res.status(422).send({ message: "Please select a valid room type! (Public or Private)" });
    }

    try {
        const temp = {};

        if (req.addNewPlayer === true) {
            const { player, token } = await addGuest();
            if (!player || !token) {
                return res.status(500).send(err);
            }
            temp.player = player;
            temp.token = token;
        } else {
            temp.player = req.player;
            temp.token = req.token;
        }

        const query = {
            roomName, maxPlayers, timeLimit, isPublicRoom: roomType === "Public"
        };
    
        const { room } = await createLobby({ query, player: temp.player });
        res.status(200).send({ token: temp.token, room, player: temp.player });        
    } catch (error) {
        return res.status(error.status || 500).send({ err: error.err || "Something went wrong. Please try again!" });
    }

});

router.get("/public-rooms", async (req, res) => {
    try {
        const { rooms } = await getOpenLobbies(req.query);
        res.status(200).send({ rooms });        
    } catch (error) {
        return res.status(500).send(error?.err);
    }    
});

router.get("/join-room", verifyToken, async (req, res) => {
    if (!req.query.room_id) {
        return res.status(404).send({ message: "Please join in a room!" });
    }

    try {
        const { room } = await getLobby({ roomID: req.query.room_id });
        
        // Check If match has ended

        if (room.lobbyStatus === "hasEnded") {
            return res.status(400).send({ message: "Sorry! Room has been disbanded!" });
        }

        // Check If match already started

        if (room.lobbyStatus === "InGame") {
            if (req.addNewPlayer) {
                return res.status(400).send({ message: "Sorry! Match already started!" });
            }
            
            if (room.currentMatch) {
                const { match } = await getMatch({ matchID: room.currentMatch });
                
                // Check if player is in the match
                const userName = req.player.userName; 
                const playerInMatch = match.players.some(player => player.userName.toString() === userName.toString());

                if (playerInMatch) {
                    await updatePlayersCurrState({ players: [{ userName: req.player.userName}], playerIn: "InGame", collectionID: req.query.room_id });

                    return res.status(403).send({ redirectURL: `/game?match_id=${match.matchID}`, textOnBtn: "Rejoin", message: "Rejoin Match?" });
                } else {
                    return res.status(400).send({ message: "Sorry! Match already started!" });
                }
            }
        }

        // Room still in Lobby

        if (room.lobbyStatus === "InLobby") {
            if (!req.addNewPlayer) {
                // Check if player is already in Lobby
                const playerIndex = room.players.findIndex(obj => {
                    return obj.userName.toString() === req.player.userName.toString();
                });                

                if (playerIndex > -1) {

                    room.players[playerIndex].playerStatus = "InLobby";

                    await updatePlayersCurrState({ players: [{ userName: req.player.userName }], playerIn: "InLobby", collectionID: req.query.room_id });                    

                    await room.save();

                    return res.status(200).send({ player: req.player, room, token: req.token });
                }
            }
            if (room.maxPlayers > room.players.length) {
                const temp = {};

                if (req.addNewPlayer) {
                    const { player, token } = await addGuest();
                    if (!player || !token) {
                        return res.status(500).send(err);
                    }
                    temp.player = player;
                    temp.token = token;
                } else {
                    temp.player = req.player;
                    temp.token = req.token;
                }

                const { updatedRoom } = await addPlayerToLobby({ player: temp.player, room, token: temp.token });

                return res.status(200).send({ player: temp.player, room: updatedRoom, token: temp.token });
            } else {
                return res.status(400).send({ message: "Maximum players limit has reached!" });
            }
        }
    } catch (error) {        
        if (error.err) {
            return res.status(error.status || 500).send({ message: error.err || "Something went wrong. Please try again!" });
        }
    }    
});

module.exports = router;