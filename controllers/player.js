const { uid } = require("uid/secure");

const Player = require("../models/player");
const { generateToken } = require("../helpers/jwt");

const that = {};

that.getPlayer = (query) => {
    return new Promise(async (resolve, reject) => {
        try {
            const player = await Player.findOne(query);
            if (!player) {
                throw new Error("Cant find the player!");
            }
    
            resolve({ player });
        } catch (error) {
            console.log(error);
            reject({ err: error.message || "Something went wrong!" });
        }
    });
}

that.addGuest = () => {
    return new Promise(async (resolve, reject) => {
        try {
            const guestName = `Guest_${uid(6)}`;
            const email = guestName.toLowerCase() + "@gmail.com";
            const player = new Player({ userName: guestName, email });
            const token = await generateToken({ _id: player._id });
            player.tokens.push({ token });

            await player.save();
            
            resolve({ player, token });
        } catch (error) {
            console.log(error);
            reject({ err: error.err || error.message || "Something went wrong!" });
        }
    });
};

that.updatePlayer = async ({ playerInfo, updates }) => {
    // Pending
    try {
        const player = await Player.findOne(playerInfo);

        if (!player) {
            throw new Error();
        }

        Object.keys(updates).forEach(key => {
            player[key] = updates[key];
        });

        await player.save();

        return { player };
    } catch (error) {
        return { err: error.message || "Something went wrong! Please try again." };
    }
}

that.resetPlayerCurrState = (query) => {
    return new Promise(async (resolve, reject) => {
        try {
            const player = await Player.findOne(query);
            
            if (!player) {
                throw new Error();
            }

            player.currState = { playerIn: null, collectionID: "" }

            await player.save();
            
            resolve();
        } catch (error) {
            console.log(error);
            reject({ err: error.err || error.message || "Seomthing went wrong. Please try again!" });
        }
    });
}

that.updatePlayersCurrState = ({ players, playerIn, collectionID }) => {
    return new Promise(async (resolve, reject) => {
        try {
            const playerUserNames = players.map(player => player.userName);
    
            await Player.updateMany(
                { userName: { $in: playerUserNames } },
                {
                    $set: {
                        'currState.playerIn': playerIn,
                        'currState.collectionID': collectionID,
                    }
                }
            );

            resolve();
        } catch (error) {
            console.log(error);
            reject({ err: error.message });
        }
    });
}

that.sendPlayerBackToLobby = ({ players, matchID, roomID }) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (!players || !Array.isArray(players) || !matchID || !roomID) {
                throw new Error();
            }

            for (let i = 0; i < players.length; i++) {
                if (players[i].playerStatus !== "Offline") {
                    const player = await Player.findOne({ userName: players[i]?.userName, currState: { playerIn: "InGame", collectionID: matchID } });
                    if (player) {
                        player.currState = { playerIn: "InLobby", collectionID: roomID };
                        player.matchesHistory.push(matchID);
                        await player.save();
                    }                    
                }
            }

            resolve();
        } catch (error) {
            console.log(error);
            reject({ err: error.err || error.message || "Something went wrong", status: error.status || 500 });            
        }
    });
}

module.exports = that;