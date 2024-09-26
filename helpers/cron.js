const { setTimeEndedMatches } = require("../controllers/match");
const { generateUpdate } = require("./utils");

const that = {};

that.timeValidation = async ({ io }) => {
    try {
        const { player, nextPlayer, card } = await setTimeEndedMatches();
        io.to(match.roomID).emit("updates", generateUpdate({ message: `${player.userName} has been removed from match!` }));

        if (card && card.length > 1) {
            io.to(match.roomID).emit("dropCardAnimate", { userName: player.userName, card });
        }

        io.to(match.roomID).emit("setPlayerAction", { playerTurn: nextPlayer.userName, playerAction: "Pick", turnStartedAt: nextPlayer.turnStartedAt });

        return;
    } catch (error) {
        console.log(error);
        if (error && error.redirectURL && error.roomID) {
            io.to(error.roomID).emit("redirect", { redirectURL: error.redirectURL });
            return;
        }
        return;
    }
}

module.exports = that;
