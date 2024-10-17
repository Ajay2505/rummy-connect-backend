const { getPlayerPoints, setAndValidateCards } = require("../helpers/cards");
const PlayerState = require("../models/playerState");

const that  = {};

that.setAllPlayerCards = ({ matchID, playerCards, playerUserNames }) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (playerCards.length !== playerUserNames.length) {
                return reject({ err: "The length of playerCards and playerUserNames must be the same", status: 400 });
            }
        
            const playerStates = playerUserNames.map((userName, index) => ({
                matchID,
                userName,
                startState: playerCards[index],
                playerAction: "None",
            }));
        
            await PlayerState.insertMany(playerStates);
            resolve();
        } catch (error) {
            reject({ err: error.message || "Something went wrong. Please try again!", status: 500 });
        }
    });
};

that.getPlayerState = ({ userName, matchID }) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (!userName || !matchID) {
                throw new Error("One or more required fields are empty!");
            }
            
            const playerState = await PlayerState.findOne({ userName, matchID });
            if (!playerState) {
                throw new Error();
            }
    
            resolve({ playerState });
        } catch (error) {
            
            reject({ err: error.message || "Something went wrong. Please try again!", status: 500 });
        }
    });
}

that.validatePlayerCards = ({ userName, matchID, playerCards, joker }) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (!userName || !matchID || !playerCards || !Array.isArray(playerCards) || !playerCards.every(Array.isArray)) {
                throw new Error();
            }

            const playerState = await PlayerState.findOne({ userName, matchID });
            if (!playerState) {
                throw new Error();
            }
            
            const finalCards = await setAndValidateCards({ 
                playerCards: [...playerCards],
                joker,
                cards: (playerState.currentState && playerState.currentState.length && Array.isArray(playerState.currentState)) ? 
                [...playerState.currentState] : 
                [...playerState.startState],  
            });

            resolve(finalCards);

        } catch (error) {
            reject({ err: error.err || error.message || "Something went wrong. Please try again!" });
        }
    });
}

that.appendPickedCard = ({ userName, matchID, card }) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (!userName || !matchID) {
                throw new Error("One or more required fields are empty!");
            }
            
            const playerState = await PlayerState.findOne({ userName, matchID });
            if (!playerState) {
                throw new Error();
            }
            if (!playerState.currentState || !playerState.currentState.length) {
                playerState.currentState = [...playerState.startState, card];
            } else {
                playerState.currentState.push(card);
            }
            
            await playerState.save();
    
            resolve();
        } catch (error) {
            
            reject({ err: error.message || "Something went wrong. Please try again!" });
        }
    });
}

that.dropPlayerCard = ({ userName, matchID, card }) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (!userName || !matchID) {
                throw new Error("One or more required fields are empty!");
            }
            
            const playerState = await PlayerState.findOne({ userName, matchID });
            if (!playerState) {
                throw new Error();
            }
    
            if (!playerState.currentState || !playerState.currentState.length) {
                throw new Error();
            }

            const cardIndex = playerState.currentState.indexOf(card);
            if (cardIndex > -1) {
                playerState.currentState.splice(cardIndex, 1);
            } else {
                throw new Error("Card not found! Something went wrong!");
            }
    
            await playerState.save();
    
            resolve();
        } catch (error) {
            
            reject({ err: error.message || "Something went wrong. Please try again!" });
        }
    });
}

that.setDropPlayerPoints = ({ userName, matchID }) => {
    return new Promise(async (resolve, reject) => {
        try {
            const playerState = await PlayerState.findOne({ userName, matchID, inGame: true });
            if (!playerState) {
                throw new Error();
            }            
            if (playerState.currentState && playerState.currentState.length) {
                playerState.points = 40;
            } else {
                playerState.points = 20;
            }

            playerState.matchEndState = "Player dropped from match!";
            playerState.inGame = false;
            await playerState.save();
            resolve();
        } catch (error) {
            reject({ err: error.err || error.message || "Something went wrong. Please try again!" });
        }
    });
}

that.setPlayersPoints = ({ players, matchID }) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (!players || !players.length || !matchID) {
                throw new Error();
            }

            for (let i = 0; i < players.length; i++) {
                const player = players[i];
                const playerState = await PlayerState.findOne({ userName: player.userName, matchID, inGame: true });
                if (playerState) {
                    playerState.points = player.points;
                    playerState.matchEndState = player?.matchEndState; //Pending

                    if (player.playerCards && player.playerCards.length > 1) {
                        playerState.playerCards = player.playerCards.map(innerArray => 
                            innerArray.map(obj => obj.card)
                        );
                    }
                    
                    playerState.inGame = player.inGame || false;

                    await playerState.save();
                }
            }

            resolve();
        } catch (error) {
            reject({ err: error.err || error.message || "Somthing went wrong. Please try again!" });
        }
    });
}

that.setLeavePLayerState = ({ userName, matchID, dropCard, matchEndState }) => {
    return new Promise(async (resolve, reject) => {
        try {
            const playerState = await PlayerState.findOne({ userName, matchID, inGame: true });
            if (playerState) {
                playerState.points = 80;
                playerState.matchEndState = matchEndState;
                const removedCard = {};
                if (dropCard && dropCard.length > 1) {
                    const cards = playerState.currentState.splice(playerState?.currentState?.findIndex(c => c === dropCard), 1) || "Joker";
                    removedCard["card"] = cards[0];
                }

                await playerState.save();
                return resolve({ card: removedCard["card"] || "" });
            }
            reject({ err: "Can't find the player" });
        } catch (error) {
            reject({ err: error.err || error.message || "Something went wrong. Please try again!" });
        }
    });
}

that.calcAndSetPlayerPoints = ({ userName, playerCards, match, inGame }) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (!userName || !match) {
                throw new Error();
            }

            const playerState = await PlayerState.findOne({ userName, matchID: match.matchID, inGame: true });
            if (!playerState) {
                throw new Error();
            }            

            const finalCards = await setAndValidateCards({ 
                playerCards: [...playerCards],
                joker: match.joker,
                cards: (playerState.currentState && playerState.currentState.length) ? 
                [...playerState.currentState] : 
                [...playerState.startState],
            });

            const { points } = await getPlayerPoints({
                playerCards: [...finalCards],
                joker: match.joker,
                powerCards: match.powerCards,
            });
                        
            playerState.points = points || 80;
            playerState.inGame = inGame || false;
            playerState.playerCards = finalCards.map(innerArray => 
                innerArray.map(obj => obj?.card)
            );
            
            await playerState.save();

            resolve({ playerState });
        } catch (error) {
            
            reject({ err: error.err || error.message || "Something went wrong. Please try again!" });
        }
    });
}

that.getPlayerResults = ({ matchID }) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (!matchID) {
                return reject({ err: "Sorry can't find the match cards!", status: 404 });
            }

            const playerStates = await PlayerState.find({ matchID }).sort({ points: 1 });
            
            if (!playerStates || playerStates.length === 0) {
                return reject({ err: "Something went wrong. Please try again!", status: 404 });
            }

            const playerStatesWithPoints = playerStates.map(playerState => {
                const stateObj = playerState.toObject(); 
                stateObj.points = playerState.points;    
                stateObj.playerCards = playerState.playerCards;    
                stateObj.matchEndState = playerState.matchEndState;
                return stateObj;
            });

            resolve({ playerStates: playerStatesWithPoints });
        } catch (error) {
            reject({ err: error.message || "Something went wrong. Please try again!", status: 500 });
        }
    });
}

module.exports = that;