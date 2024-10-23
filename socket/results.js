const { getMatchResults, getMatch } = require("../controllers/match");
const { calcAndSetPlayerPoints } = require("../controllers/playerState");
const { verifySocketToken } = require("../helpers/jwt");

const resultsSocket = ({ io, socket }) => {
    socket.on("view-result", async ({ token, matchID }, callback) => {
        try {
            if (!token) {
                throw new Error("Unauthorized Access!");
            }
            
            if (!matchID) {
                throw new Error("Sorry can't find the match you are looking for!");
            }

            const { player } = await verifySocketToken({ token });
    
            const { results, lobbyURL, roomID } = await getMatchResults({ matchID, userName: player.userName });
            
            socket.join("viewResults" + matchID);
    
            callback({ results, userName: player.userName, lobbyURL, roomID, matchID });
        } catch (error) {
            console.log(error, "view-result");
            callback({ err: error.err || error.message || "Something went wrong. Please try again!" });
        }
    });

    socket.on("setMyPoints", async ({ token, playerCards, matchID, inGame }, callback) => {
        try {
            if (!token) {
                throw new Error("Unauthorized Access!");
            }

            if (!playerCards) {
                throw new Error();
            }

            const { player } = await verifySocketToken({ token });

            const { match } = await getMatch({ matchID, "players.userName": player.userName, hasEnded: true });            
            
            const inTime = Date.now() < (parseInt(match.matchEndedAt) + 1000 + (parseInt(match.timeLimit) * 1000));

            const { playerState } = await calcAndSetPlayerPoints({
                userName: player.userName,
                playerCards,
                match,
                inGame: inTime && inGame,
            });

            setTimeout(() => {
                io.to("viewResults" + match.matchID).emit("updatePlayersResult", { playerStates: [playerState] });
            }, 1000);
        } catch (error) {
            console.log(error, "setMyPoints");
            callback({ err: error.err || error.message || "Something went wrong. Please try again!" });
        }
    });

    socket.on("leave-results", async ({ token, matchID }) => {
        try {
            if (!token) {
                throw new Error("Unauthorized Access!");                
            }
            
            if (!matchID) {
                throw new Error("Sorry can't find the match you are looking for!");
            }

            await verifySocketToken({ token });

            socket.leave("viewResults" + matchID);
        } catch (error) {
            console.log(error, "leave-results");
        }
    });
}

module.exports = resultsSocket;