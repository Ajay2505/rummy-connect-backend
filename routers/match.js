const express = require("express");
const router = new express.Router();

const { verifyToken } = require("../helpers/jwt");
const { getLobby, setCurrMatch } = require("../controllers/lobby");
const { createMatch, joinMatch, getMatchResults } = require("../controllers/match");
const { getPlayerState } = require("../controllers/playerState");

router.get("/create-match", verifyToken,  async (req, res) => {
    if (req.addNewPlayer) {
        return res.status(401).send("Unauthorized access!");
    }
    
    if (!req.query.room_id) {
        return res.status(404).send({ message: "Please join in a room!" });
    }

    try {
        const { room } = await getLobby({ roomID: req.query.room_id, "players.userName": req.player.userName });
        const playerIdx = room.players.findIndex(player => player.userName.toString() === req.player.userName.toString());        
    
        if (!room.players[playerIdx].isAdmin) {
            return res.status(401).send({ message: "Only room admin can start the match!" });
        }

        const inActivePlayerIdx = room.players.findIndex(player => player.playerStatus !== "InLobby");

        if (inActivePlayerIdx > -1) {
            return res.status(400).send({ message: `Waiting for ${room.players[inActivePlayerIdx].userName || "players"}` });
        }
    
        const { match } = await createMatch(room);
            
        await setCurrMatch({ room, matchID: match.matchID });

        res.status(200).send({ matchID: match.matchID });
    } catch (error) {
        return res.status(error.status || 500).send({ message: error.err || error.message || "Something went wrong. Please try again!" });
    }        
});

router.get("/join-match", verifyToken, async (req, res) => {
    if (req.addNewPlayer) {
        return res.status(401).send({ message: "Unauthorized access!" });
    }

    if (!req.query.match_id) {
        return res.status(404).send({ message: "Please join in a room!" });
    }

    try {
        const { match } = await joinMatch({ matchID: req.query.match_id, userName: req.player.userName });
    
        const player = match.players.find(playerObj => {
            return playerObj.userName.toString() === req.player.userName.toString();
        });
    
        if (!player) {
           return res.status(500).send({ message: "Something went wrong. Please try again!" });       
        }
    
        const { playerState } = await getPlayerState({ matchID: match.matchID, userName: req.player.userName });
    
        return res.status(200).send({ player: req.player, token: req.token, match, playerState: playerState.currentState.length > 0 ? playerState.currentState : playerState.startState, playerStatus: player.playerStatus });    
    } catch (error) {
        if (error.redirectURL) {
            return res.status(403).send({ redirectURL: error.redirectURL || "#", textOnBtn: error.textOnBtn || "Retry", message: error.message || "Somthing went wrong. Please try again!" });
        }
        return res.status(error.status || 500).send({ message: error.err || "Something went wrong. Please try again!" });        
    }    
});

router.get("/match-result", verifyToken, async (req, res) => {
    if (req.addNewPlayer) {
        return res.status(401).send({ message: "Unauthorized access!" });
    }

    if (!req.query.match_id) {
        return res.status(404).send({ message: "Please join in a room!" });
    }

    try {
        const { results, lobbyURL } = await getMatchResults({ matchID: req.query.match_id, userName: req.player.userName });

        return res.status(200).send({ results, userName: req.player.userName, lobbyURL });
    } catch (error) {
        console.log(error);
        if (error?.status === 403) {
            return res.status(403).send({ redirectURL: error.redirectURL, textOnBtn: "Rejoin", message: error.message || "Rejoin Match?" });
        }
        return res.status(error.status || 500).send({ message: error.err || "Something went wrong. Please try again!" });
    }
});

module.exports = router;