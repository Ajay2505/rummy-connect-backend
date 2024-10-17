const { addSocketID } = require("../controllers/lobby");
const { verifySocketToken } = require("../helpers/jwt");
const { generateUpdate } = require("../helpers/utils");
const { resetPlayerCurrState } = require("../controllers/player");
const { calcAndSetPlayerPoints } = require("../controllers/playerState");
const { getMatch, setNextPlayerTurn, pickCard, dropCard, matchDrop, matchShow } = require("../controllers/match");

const matchSocket = ({ io, socket }) => {

    socket.on("startMatch", async ({ token, roomID, matchID }, callback) => {
        if (!roomID || !matchID || !token) {
            callback({ err: "One or more required fields are missing!" });
        }
        try {
            const { player } = await verifySocketToken({ token });

            const { match } = await getMatch({ roomID, matchID, "players.userName": player.userName });
            io.to(roomID).emit("redirect", { redirectURL: `/game?match_id=${matchID}` });

            setTimeout(async () => {
                const { nextPlayer } = await setNextPlayerTurn({ matchID: match.matchID });

                io.to(roomID).emit("setPlayerAction", { playerTurn: nextPlayer.userName, playerAction: "Pick", turnStartedAt: nextPlayer.turnStartedAt });
            }, (parseInt(Date.now()) + 200 + ((parseInt(match.timeLimit)) * 1000)) - Date.now());
        } catch (error) {
            if (error.redirectURL && error.roomID) {
                io.to(error.roomID).emit("redirect", { redirectURL: error.redirectURL });
                return;
            }
            return callback(error.err || "Please join in a room!");
        }
    });

    socket.on("joinMatch", async ({ token }, callback) => {
        try {
            if (!token) {
                throw new Error("Unauthorized Access!");
            }

            const { player } = await verifySocketToken({ token });

            if (player.currState.playerIn !== "InGame") {
                throw new Error("Please join a match!");
            }

            const { match } = await getMatch({ matchID: player.currState.collectionID, "players.userName": player.userName });
            const playerIdx = match.players.findIndex(p => p.userName === player.userName);
            if (match.players[playerIdx].playerStatus === "Offline") {
                match.players[playerIdx].playerStatus = "InGame";
                await match.save();
            }

            socket.join(match.roomID);

            await addSocketID({ socketID: socket.id, userName: player.userName, roomID: match.roomID });

            socket.to(match.roomID).emit("updatePlayers", { players: match.players });
            socket.to(match.roomID).emit("updates", generateUpdate({ message: `${player.userName} has joined the match` }));

        } catch (error) {
            return callback(error.err || error.message || "Please join in a room!");
        }
    });

    socket.on("leaveMatch", async ({ token }) => {
        try {
            if (!token) {
                throw new Error("Unauthorized Access!");
            }

            const { player } = await verifySocketToken({ token });

            if (player.currState.playerIn !== "InGame") {
                throw new Error("Please join a match!");
            }

            const { match } = await getMatch({ matchID: player.currState.collectionID, "players.userName": player.userName, hasEnded: false });
            const playerIdx = match.players.findIndex(p => p.userName === player.userName);
            match.players[playerIdx].playerStatus = "Offline";

            await resetPlayerCurrState({ userName: player.userName });

            await match.save();

            socket.leave(match.roomID);

            io.to(match.roomID).emit("updatePlayers", { players: match.players });
            io.to(match.roomID).emit("updates", generateUpdate({ message: `${player.userName} has left the match` }));
        } catch (error) {
            // return callback(error.err || error.message || "Please join in a match!");
        }
    });

    socket.on("pickCard", async ({ token, cardType, timeStamp }, callback) => {
        try {
            if (!token) {
                throw new Error("Unauthorized Access!");
            }

            if (!timeStamp) {
                throw new Error();
            }

            const { player } = await verifySocketToken({ token });

            if (player.currState.playerIn !== "InGame") {
                throw new Error("Please join a match!");
            }

            const { roomID, update, card } = await pickCard({ userName: player.userName, matchID: player.currState.collectionID, cardType, timeStamp });
            if (!card || !update || !roomID) {
                return callback({ error: "Something went wrong!" });
            }
            callback({ playerAction: "Drop", addCard: card });

            socket.to(roomID).emit("pickCardAnimate", { cardType, userName: player.userName });
            io.to(roomID).emit("updates", update);
        } catch (error) {
            return callback({ err: error.err || error.message || "Something went wrong. Please try again!" });
        }

    });

    socket.on("dropCard", async ({ token, card }, callback) => {
        try {
            if (!token) {
                throw new Error("Unauthorized Access!");
            }

            if (!timeStamp || !card) {
                throw new Error();
            }

            const { player } = await verifySocketToken({ token });

            if (player.currState.playerIn !== "InGame") {
                throw new Error("Please join a match!");
            }

            const { matchID, roomID, update } = await dropCard({ userName: player.userName, matchID: player.currState.collectionID, card });
            if (!update || !roomID || !matchID) {
                callback({ error: "Something went wrong!" });
                return;
            }

            socket.to(roomID).emit("dropCardAnimate", { userName: player.userName, card });

            io.to(roomID).emit("updates", update);

            const { nextPlayer } = await setNextPlayerTurn({ matchID });

            io.to(roomID).emit("setPlayerAction", { playerTurn: nextPlayer.userName, playerAction: "Pick", turnStartedAt: nextPlayer.turnStartedAt });

            callback();
        } catch (error) {
            if (error.redirectURL && error.roomID) {
                io.to(error.roomID).emit("redirect", { redirectURL: error.redirectURL });
                return;
            }
            callback({ err: error.message });
        }
    });

    socket.on("matchDrop", async ({ token }, callback) => {
        try {
            if (!token) {
                throw new Error("Unauthorized Access!");
            }

            const { player } = await verifySocketToken({ token });

            if (player.currState.playerIn !== "InGame") {
                throw new Error("Please join a match!");
            }

            const { players, nextPlayer, roomID } = await matchDrop({ userName: player.userName, matchID: player.currState.collectionID });

            io.to(roomID).emit("updatePlayers", { players });

            const update = generateUpdate({ message: `${player.userName} has dropped from match!` });
            io.to(roomID).emit("updates", update);

            io.to(roomID).emit("setPlayerAction", { playerTurn: nextPlayer.userName, playerAction: nextPlayer.playerAction, turnStartedAt: nextPlayer.turnStartedAt });

            socket.emit("playerLost");

            callback("");
        } catch (error) {
            if (error.redirectURL && error.player && error.roomID) {
                const update = generateUpdate({ message: `${error.player.userName} has dropped from match!` });
                io.to(error.roomID).emit("updates", update);
                io.to(error.roomID).emit("redirect", { redirectURL: error.redirectURL });
                return;
            }
            callback({ err: error.err || error.message || "Something went wrong. Please try again!" });
        }
    });

    socket.on("matchShow", async ({ token, playerCards }, callback) => {
        try {
            if (!token) {
                throw new Error("Unauthorized Access!");
            }

            if (!playerCards) {
                throw new Error();
            }

            const { player } = await verifySocketToken({ token });

            if (player.currState.playerIn !== "InGame") {
                throw new Error("Please join a match!");
            }

            const { roomID, timeLimit, redirectURL } = await matchShow({ userName: player.userName, matchID: player.currState.collectionID, playerCards });

            socket.to(roomID).emit("matchEndTimer", { redirectURL, timeLimit, showBy: player.userName });

            socket.emit("redirect", { redirectURL });

            // setTimeout(() => {
            //     io.to(roomID).emit("redirect", { redirectURL });
            // }, parseInt(timeLimit) * 1000);
        } catch (error) {
            callback({ err: error.err || error.message || "Something went wrong. Please try again!" });
        }
    });

    socket.on("setMyPoints", async ({ token, playerCards, matchID }, callback) => {
        try {
            if (!token) {
                throw new Error("Unauthorized Access!");
            }

            if (!playerCards) {
                throw new Error();
            }

            const { player } = await verifySocketToken({ token });

            const { match } = await getMatch({ matchID, "players.userName": player.userName, hasEnded: true });            
            
            const { playerState } = await calcAndSetPlayerPoints({
                userName: player.userName,
                playerCards,
                match,
                inGame: Date.now() < (parseInt(match.matchEndedAt) + 1000 + (parseInt(match.timeLimit) * 1000)),
            });

            setTimeout(() => {
                io.to(match.roomID).emit("updatePlayerResult", { playerState });                
            }, 1000);
            // Pending
            // callback({ redirectURL: `/results?match_id=${match.matchID}` });
        } catch (error) {
            callback({ err: error.err || error.message || "Something went wrong. Please try again!" });
        }
    });
}

module.exports = matchSocket;