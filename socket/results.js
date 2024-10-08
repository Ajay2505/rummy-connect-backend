const { getMatchResults } = require("../controllers/match");
const { verifySocketToken } = require("../helpers/jwt");

const resultsSocket = ({ io, socket }) => {
    socket.on("view-result", async ({ token, matchID }, callback) => {
        if (!token) {
            throw new Error("Unauthorized Access!");
        }

        const { player } = await verifySocketToken({ token });

        const { results, lobbyURL } = await getMatchResults({ matchID, userName: player.userName });
        
        callback({ results, userName: player.userName, lobbyURL });
    });
}

module.exports = resultsSocket;