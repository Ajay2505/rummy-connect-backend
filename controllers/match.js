const Match = require("../models/match");
const { v4: uuidv4 } = require('uuid');

const { updatePlayersCurrState, sendPlayerBackToLobby } = require("./player");
const { setMatchCards, validateShow } = require("../helpers/cards");
const { generateUpdate } = require("../helpers/utils");
const { returnToLobby } = require("./lobby");
const { setAllPlayerCards, appendPickedCard, dropPlayerCard, getPlayerResults, setDropPlayerPoints, validatePlayerCards, setPlayersPoints, setLeavePLayerState } = require("./playerState");

const that = {};

that.getMatch = query => {
    return new Promise(async (resolve, reject) => {
        try {
            const match = await Match.findOne(query);
            if (!match) {
                return reject({ err: "Sorry! Can't find the match you are looking for.", status: 404 });
            }
            resolve({ match });
        } catch (error) {
            console.log(error);
            reject({ err: error.message || "Something went wrong. Please try again later!", status: 500 });
        }
    });
}

that.setTimeEndedMatches = () => {
    return new Promise(async (resolve, reject) => {
        try {
            // Pending
            const now = Date.now();

            const matches = await Match.aggregate([
                {
                    $match: {
                        hasEnded: false,
                    },
                },
                {
                    $addFields: {
                        playersExceededTimeLimit: {
                            $filter: {
                                input: "$players",
                                as: "player",
                                cond: {
                                    $and: [
                                        { $eq: ["$$player.isMyTurn", true] },
                                        {
                                            $lt: [
                                                {
                                                    $add: [
                                                        { $toLong: "$$player.turnStartedAt" }, // Directly use the timestamp
                                                        { $multiply: ["$timeLimit", 1000] }
                                                    ]
                                                },
                                                now + 2000
                                            ]
                                        }
                                    ]
                                }
                            }
                        }
                    }
                },
                {
                    $match: {
                        "playersExceededTimeLimit.0": { $exists: true },
                    }
                }
            ]);
            
            if (!matches || matches.length === 0) {
                return reject({ err: "No Matches Found!" });
            }

            for(let i = 0; i < matches.length; i++) {
                const matchData = matches[i];
                
                const match = await Match.findById(matchData._id); 
                
                const playerIdx = match.players.findIndex(player => player.isMyTurn === true);
                if (playerIdx > -1) {
                    
                    const player = match.players[playerIdx];

                    match.players[playerIdx].playerStatus = "Lost";

                    const activePlayers = getActivePlayersCount(match.players);
                    const { currentIndex, nextIndex } = getPlayerTurns(match.players);

                    if (activePlayers < 2) {
                        // MATCH END
                        await setPlayersPoints({
                            players: [
                                {
                                    userName: match.players[nextIndex]?.userName,
                                    points: 0,
                                },
                                {
                                    userName: match.players[playerIdx].userName,
                                    points: 80,
                                },
                            ],
                            matchID: match.matchID,
                        });
        
                        await endMatch({ match });
        
                        return reject({ redirectURL: "/results?match_id=" + match.matchID, roomID: match.roomID, player });
                    }

                    const dropCard = {};
                    // Player Drop Action
                    if (player.playerAction === "Drop") {
                        const lastCardRotation = match.cardsRotation[match.cardsRotation.length - 1];                    
                        if (lastCardRotation.updateType === "Pick" && lastCardRotation.userName === player.userName) {
                            dropCard["card"] = lastCardRotation.card;
                        }
                    }

                    const { card } = await setLeavePLayerState({ userName });

                    if (card && card.length > 1) {
                        match.droppedCards.push({
                            card,
                            roundNumber: 1,
                            userName: player.userName,
                        });
                    }

                    // Set Next Player Turn
                    if (currentIndex !== -1) {
                        match.players[currentIndex].isMyTurn = false;
                        match.players[currentIndex].turnStartedAt = null;
                        match.players[currentIndex].playerAction = "None";
                    }
                    
                    match.players[nextIndex].isMyTurn = true;
                    match.players[nextIndex].turnStartedAt = Date.now();
                    match.players[nextIndex].playerAction = "Pick";

                    await match.save();

                    resolve({ player, nextPlayer: match.players[nextIndex], card });
                }                
            }
            return reject();
        } catch (error) {
            reject({ err: error.err || error.message || "Something went wrong. Please try again!" });
        }
    });
}

that.createMatch = room => {
    return new Promise(async (resolve, reject) => {
        try {                
            if (!room || !room.players || room.players.length <= 1) {
                throw new Error("Minimum 2 Players required to start the match!");
            }
        
            if (room.players.length > 5) {
                throw new Error("Maximum only 5 Players are allowed in a match!");
            }
            const allCards = await setMatchCards(room.players.length || 0);
            const matchID = uuidv4();
            
            const match = new Match({
                matchID,
                roomID: room.roomID,
                joker: allCards.joker,
                shuffledCards: allCards.remainingCards,
                shuffleCardsCount: allCards.shuffleCardsCount,
                timeLimit: room.timeLimit,
                powerCards: allCards.powerCards,
                droppedCards: [
                    {
                        card: allCards.openCard,
                        roundNumber: 0,
                        userName: room.players[1].userName,
                    },
                ],
                matchStartedAt: parseInt(Date.now()) + 200 + parseInt(room.timeLimit) * 1000,
            });
                        
            room.players.forEach((player, idx) => {
                match.players.push({
                    userName: player.userName,
                    position: idx,
                    isMyTurn: false,
                    turnStartedAt: null,
                    playerStatus: "InGame",
                    playerAction: "None",
                });
            });
    
            await match.save();
            
            await setAllPlayerCards({ matchID, playerCards: allCards.playerHands, playerUserNames: room.players.map(player => player.userName) });
    
            resolve({ match });
        } catch (error) {
            console.log(error, "that.createMatch");
            reject({ err: error.message || "Something went wrong! Please try again.", status: 500 });
        }
    });
}

that.joinMatch = ({ userName, matchID }) => {
    return new Promise(async (resolve, reject) => {
        try {
            const match = await Match.findOne({ matchID, "players.userName": userName });
            if (!match) {
                throw new Error("Sorry cant find the match you are looking for!");
            }
            
            if (match.hasEnded === true) {
                return reject({ redirectURL: `/results?match_id=${match.matchID}`, textOnBtn: "View Results", message: "Match has already ended!" });
            }

            const playerIdx = match.players.findIndex(playerObj => {
                return playerObj.userName.toString() === userName.toString();
            });

            const prevStatus = match.players[playerIdx].playerStatus;
            if (prevStatus !== "Lost") {
                match.players[playerIdx].playerStatus = "InGame";
            }

            await updatePlayersCurrState({ players: [match.players[playerIdx]], playerIn: "InGame", collectionID: match.matchID });

            await match.save();
    
            resolve({ match });
        } catch (error) {
            console.log(error);
            reject({ err: error.message || "Something went wrong! Please try again.", status: 500 });
        }
    });
}

function getPlayerTurns(players) {
    const currentIndex = players.findIndex(player => player.isMyTurn);
    
    let nextIndex = currentIndex;
    let found = false;

    do {
        nextIndex = (nextIndex + 1) % players.length;

        if (players[nextIndex].playerStatus !== "Lost") {
            found = true;
        }
    } while (!found && nextIndex !== currentIndex);

    return { currentIndex, nextIndex };
}

function getActivePlayersCount(players) {
    let count = 0;
    if (!players || !players.length) {
        return count;
    }

    players.forEach(player => {
        if (player.playerStatus !== "Lost") {
            count++;
        }
    });

    return count;
}

function endMatch({ match }) {
    return new Promise(async (resolve, reject) => {
        try {
            if (!match) {
                throw new Error();
            }

            match.hasEnded = true;
            
            await sendPlayerBackToLobby({ matchID: match.matchID, roomID: match.roomID, players: match.players });

            await returnToLobby({ matchID: match.matchID, roomID: match.roomID, players: match.players });
            
            await match.save();

            resolve();
        } catch (error) {
            reject({ err: error.err || error.message || "Something went wrong", status: error.status || 500 });
        }
    });
}

that.matchDrop = ({ userName, matchID }) => {
    return new Promise(async (resolve, reject) => {
        try {
            const match = await Match.findOne({ matchID, "players.userName": userName });
            if (!match) {
                throw new Error("Can't find the match you are looking for!");
            }
            const playerIdx = match.players.findIndex(p => p.userName === userName);
            if (playerIdx === -1) {
                throw new Error();
            }

            const player = match.players[playerIdx];

            if (player.isMyTurn !== true || player.playerAction !== "Pick") {
                throw new Error("Please wait for your turn!");
            }           
            
            await setDropPlayerPoints({ userName: player.userName, matchID: match.matchID });
            match.players[playerIdx].playerStatus = "Lost";

            const activePlayers = getActivePlayersCount(match.players);
            const { currentIndex, nextIndex } = getPlayerTurns(match.players);

            if (activePlayers < 2) {
                // MATCH END
                await setPlayersPoints({ players: [{ userName: match.players[nextIndex]?.userName, points: 0 }], matchID: match.matchID });

                await endMatch({ match });

                return reject({ redirectURL: "/results?match_id=" + match.matchID, roomID: match.roomID, player });
            }

            // if (currentIndex === nextIndex) {
            //     // Pending doubt
            //     match.hasEnded = true;
            //     await match.save();
            //     return reject({ redirectURL: "/results?match_id=" + match.matchID, roomID: match.roomID, player });
            // }

            if (currentIndex !== -1) {
                match.players[currentIndex].isMyTurn = false;
                match.players[currentIndex].turnStartedAt = null;
                match.players[currentIndex].playerAction = "None";
            }
            
            match.players[nextIndex].isMyTurn = true;
            match.players[nextIndex].turnStartedAt = Date.now();
            match.players[nextIndex].playerAction = "Pick";
    
            await match.save();
    
            resolve({ players: match.players, nextPlayer: match.players[nextIndex], roomID: match.roomID });
        } catch (error) {
            reject({ err: error.err || error.message || "Something went wrong", status: error.status || 500 });
        }
    });
}

that.setNextPlayerTurn = ({ matchID }) => {
    return new Promise(async (resolve, reject) => {
        try {
            const match = await Match.findOne({ matchID });
            if (!match) {
                throw new Error("Can't find the match you are looking for!");
            }

            const activePlayers = getActivePlayersCount(match.players);
            const { currentIndex, nextIndex } = getPlayerTurns(match.players);

            if (activePlayers < 2) {
                // MATCH END
                await setPlayersPoints({ players: [{ userName: match.players[nextIndex]?.userName, points: 0 }], matchID: match.matchID });

                await endMatch({ match });

                return reject({ redirectURL: "/results?match_id=" + match.matchID, roomID: match.roomID, player });
            }
    
            if (currentIndex === nextIndex) {
                // Match END
                await setPlayersPoints({ players: [{ userName: match.players[nextIndex]?.userName, points: 0 }], matchID: match.matchID });
                
                await endMatch({ match });
                
                return reject({ redirectURL: "/results?match_id=" + match.matchID, roomID: match.roomID });
            }
            
            if (currentIndex !== -1) {
                match.players[currentIndex].isMyTurn = false;
                match.players[currentIndex].turnStartedAt = null;
                match.players[currentIndex].playerAction = "None";
            }
            
            match.players[nextIndex].isMyTurn = true;
            match.players[nextIndex].turnStartedAt = Date.now();
            match.players[nextIndex].playerAction = "Pick";
    
            await match.save();            
            
            resolve({ nextPlayer: match.players[nextIndex] });
        } catch (error) {
            console.log(error);
            reject({ err: error.message });
        }
    });
};

// that.playerTimeOutMatch = ({ match }) => {
//     return new Promise(async (resolve, reject) => {
//         try {
//             const playerIdx = match.players.findIndex(player => player.isMyTurn === true);
//             if (playerIdx > -1) {
                
//                 const player = match.players[playerIdx];

//                 match.players[playerIdx].playerStatus = "Lost";

//                 const activePlayers = getActivePlayersCount(match.players);
//                 const { currentIndex, nextIndex } = getPlayerTurns(match.players);

//                 if (activePlayers < 2) {
//                     // MATCH END
//                     await setPlayersPoints({
//                         players: [
//                             {
//                                 userName: match.players[nextIndex]?.userName,
//                                 points: 0,
//                             },
//                             {
//                                 userName: match.players[playerIdx].userName,
//                                 points: 80,
//                             },
//                         ],
//                         matchID: match.matchID,
//                     });
    
//                     await endMatch({ match });
    
//                     return reject({ redirectURL: "/results?match_id=" + match.matchID, roomID: match.roomID, player });
//                 }

//                 const dropCard = {};
//                 // Player Drop Action
//                 if (player.playerAction === "Drop") {
//                     const lastCardRotation = match.cardsRotation[match.cardsRotation.length - 1];                    
//                     if (lastCardRotation.updateType === "Pick" && lastCardRotation.userName === player.userName) {
//                         dropCard["card"] = lastCardRotation.card;
//                     }
//                 }

//                 const { card } = await setLeavePLayerState({ userName });

//                 if (card && card.length > 1) {
//                     match.droppedCards.push({
//                         card,
//                         roundNumber: 1,
//                         userName: player.userName,
//                     });
//                 }

//                 // Set Next Player Turn
//                 if (currentIndex !== -1) {
//                     match.players[currentIndex].isMyTurn = false;
//                     match.players[currentIndex].turnStartedAt = null;
//                     match.players[currentIndex].playerAction = "None";
//                 }
                
//                 match.players[nextIndex].isMyTurn = true;
//                 match.players[nextIndex].turnStartedAt = Date.now();
//                 match.players[nextIndex].playerAction = "Pick";

//                 await match.save();

//                 resolve({ player, nextPlayer: match.players[nextIndex], card });
//             }

//             return reject();
//         } catch (error) {
//             console.log(error, "playerTimeOutMatch");
//             reject({ err: error.err || error.message || "Something went wrong. Please try again." });
//             // reject({ err: error.err || error.message || "Something went wrong. Please try again!" });
//         }
//     });
// }

that.pickCard = ({ userName, matchID, timeStamp, cardType }) => {
    return new Promise(async (resolve, reject) => {
        try {            
            const match = await Match.findOne({ "players.userName": userName, matchID });
            if (!match) {
                throw new Error("Sorry, Can't find the match you are looking for!");
            }
        
            const playerIdx = match.players.findIndex(player => player.userName.toString() === userName.toString());
            if (playerIdx === -1) {
                console.log("No player");
                throw new Error("Please join the match!");
            }
        
            const playerObj = match.players[playerIdx];
        
            if (playerObj.isMyTurn !== true || playerObj.playerAction !== "Pick") {
                throw new Error("Please wait for your turn!");
            }
        
            // Time Validation Pending            

            match.players[playerIdx].playerAction = "Drop";
            let card = "";
            if (cardType === "dropped") {
                if (!match.droppedCards.length) {
                    throw new Error("No Dropped Card Available!");
                }
                const cardObj = match.droppedCards.pop();
                card = cardObj.card;
            }
            if (cardType === "newCard") {
                card = match.shuffledCards.shift();
                match.shuffleCardsCount--;
            }
            
            await appendPickedCard({ matchID, userName, card });
            
            match.cardsRotation.push({
                card,
                userName: playerObj.userName,
                timeStamp: new Date(),
                updateType: "Pick",
            });
        
            await match.save();
        
            const update = generateUpdate({ message: `${playerObj.userName} picked ${cardType === "dropped" ? card : "new card"}!` });
        
            resolve({ update, card, userName: playerObj.userName, roomID: match.roomID });
        } catch (error) {
            reject({ err: error.message || "Something went wrong. Please try again!" });
        }
    });
}

that.dropCard = ({ userName, matchID, card, timeStamp }) => {
    return new Promise(async (resolve, reject) => {
        try {
            const match = await Match.findOne({ "players.userName": userName, matchID });
            if (!match) {
                throw new Error("Something went wrong. Please try again!");
            }
        
            const playerIdx = match.players.findIndex(player => player.userName.toString() === userName.toString());
            if (playerIdx === -1) {
                throw new Error("Something went wrong. Please try again!");
            }
        
            const playerObj = match.players[playerIdx];
        
            if (playerObj.isMyTurn !== true || playerObj.playerAction !== "Drop") {
                throw new Error("Please wait for your turn!");
            }
        
            // Time Validation Pending
        
            match.players[playerIdx].playerAction = "None";
        
            await dropPlayerCard({ userName, matchID, card });
        
            match.droppedCards.push(
                {
                    card,
                    roundNumber: 1,
                    userName: playerObj.userName,
                }
            );
        
            match.cardsRotation.push({
                card,
                userName: playerObj.userName,
                timeStamp: new Date(),
                updateType: "Drop",
            });
                    
            await match.save();
        
            const update = generateUpdate({ message: `${playerObj.userName} dropped ${card}` });        
        
            resolve({ update, card, userName: playerObj.userName, roomID: match.roomID, matchID: match.matchID });
        } catch (error) {
            reject({ err: error.message || "Something went wrong. Please try again!" });
        }
    });
}

that.getMatchResults = ({ userName, matchID }) => {
    return new Promise(async (resolve, reject) => {
        try {
            const match = await Match.findOne({ matchID, "players.userName": userName, hasEnded: true });
            if (!match) {
                return reject({ message: "Sorry! Can't find the match you are looking for!", status: 404 });
            }

            if (match.hasEnded === false) {
                return reject({ redirectURL: `/game?match_id=${match.matchID}`, message: "Match still in progress!", status: 403 });
            }
            
            const { playerStates } = await getPlayerResults({ matchID: match.matchID });

            resolve({ results: playerStates, lobbyURL: `/room?room_id=${match.roomID}` });
        } catch (error) {
            reject({ err: error.err || error.message || "Something went wrong. Please try again!", status: error.status || 500 });
        }
    });
}

that.matchShow = ({ userName, matchID, playerCards }) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (!userName || !matchID) {
                throw new Error();
            }

            const match = await Match.findOne({ "players.userName": userName, matchID });

            if (!match) {
                throw new Error("Please join in a match!");
            }

            const playerIdx = match.players.findIndex(p => p.userName === userName);
            if (playerIdx === -1) {
                throw new Error();
            }

            const player = match.players[playerIdx];

            if (player.isMyTurn !== true || player.playerAction !== "Drop") {
                throw new Error("Please wait for your turn!");
            }

            const finalCards = await validatePlayerCards({ userName, matchID, playerCards, joker: match.joker });

            await validateShow({ playerCards: finalCards, joker: match.joker, powerCards: match.powerCards });

            await setPlayersPoints({ players: [{ userName: player.userName, points: 0 }], matchID: match.matchID });

            // Match END
            await endMatch({ match });

            resolve({ roomID: match.roomID, timeLimit: match.timeLimit, redirectURL: `/results?match_id=${match.matchID}` });
        } catch (error) {
            console.log(error, "that.matchShow");
            reject({ err: error.err || error.message || "Somthing went wrong. Please try again!" });
        }
    });
}

module.exports = that;