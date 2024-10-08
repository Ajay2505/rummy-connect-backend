const that = {};

const allCards = [
    "Club Ace", "Club 2", "Club 3", "Club 4", "Club 5", "Club 6", "Club 7", "Club 8", "Club 9", "Club 10", "Club Jack", "Club Queen", "Club King",
    "Diamond Ace", "Diamond 2", "Diamond 3", "Diamond 4", "Diamond 5", "Diamond 6", "Diamond 7", "Diamond 8", "Diamond 9", "Diamond 10", "Diamond Jack", "Diamond Queen", "Diamond King",
    "Heart Ace", "Heart 2", "Heart 3", "Heart 4", "Heart 5", "Heart 6", "Heart 7", "Heart 8", "Heart 9", "Heart 10", "Heart Jack", "Heart Queen", "Heart King",
    "Spade Ace", "Spade 2", "Spade 3", "Spade 4", "Spade 5", "Spade 6", "Spade 7", "Spade 8", "Spade 9", "Spade 10", "Spade Jack", "Spade Queen", "Spade King",
    
    "Club Ace", "Club 2", "Club 3", "Club 4", "Club 5", "Club 6", "Club 7", "Club 8", "Club 9", "Club 10", "Club Jack", "Club Queen", "Club King",
    "Diamond Ace", "Diamond 2", "Diamond 3", "Diamond 4", "Diamond 5", "Diamond 6", "Diamond 7", "Diamond 8", "Diamond 9", "Diamond 10", "Diamond Jack", "Diamond Queen", "Diamond King",
    "Heart Ace", "Heart 2", "Heart 3", "Heart 4", "Heart 5", "Heart 6", "Heart 7", "Heart 8", "Heart 9", "Heart 10", "Heart Jack", "Heart Queen", "Heart King",    
    "Spade Ace", "Spade 2", "Spade 3", "Spade 4", "Spade 5", "Spade 6", "Spade 7", "Spade 8", "Spade 9", "Spade 10", "Spade Jack", "Spade Queen", "Spade King",
    
    "Joker"
];

const shuffleCards = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]]; // Swap elements
    }
    return array;
}

function getCardSuit(card, joker) {
    return card === "Joker" ? joker.split(" ")[0] : card.split(" ")[0];
}

function getCardValue(card, joker) {
    return card === "Joker" ? joker.split(" ")[1] : card.split(" ")[1];
}

function getCardRank(card, joker) {
    const cardValue = getCardValue(card, joker);
    if (cardValue === "Ace") return 1;
    if (cardValue === "Jack") return 11;
    if (cardValue === "Queen") return 12;
    if (cardValue === "King") return 13;
    return parseInt(cardValue);
}

function getSuitAndValue(card, joker) {
    return {
        suit: getCardSuit(card, joker),
        value: getCardRank(card, joker),
    }
}

function getPowerCards(joker) {
    const redSuits = ["Heart", "Diamond"];
    const blackSuits = ["Club", "Spade"];
    const powerCards = [];
    if (joker === "Joker") {
        powerCards.push("Club Ace", "Spade Ace");
    } else {
        const jokerSuit = getCardSuit(joker);
        const jokerValue = getCardValue(joker);
        if (redSuits.indexOf(jokerSuit) > -1) {
            powerCards.push(`${blackSuits[0]} ${jokerValue}`, `${blackSuits[1]} ${jokerValue}`);
        }
        if (blackSuits.indexOf(jokerSuit) > -1) {
            powerCards.push(`${redSuits[0]} ${jokerValue}`, `${redSuits[1]} ${jokerValue}`);
        }
    }
    
    return powerCards;
}

const getCards = () => {
    const cards = [...allCards];
    const randomIndex = Math.floor(Math.random() * cards.length);
    const joker = cards.splice(randomIndex, 1)[0];
    const shuffledCards = shuffleCards(cards);
    return { cards: shuffledCards, joker };
} 

// Helpers END

// SET Match Cards
that.setMatchCards = playersCount => {
    if (playersCount < 2 || playersCount > 5) {
        throw new Error("Players count should be between 2 and 5");
    }
    
    const { cards, joker } = getCards();
    const playerHands = Array.from({ length: playersCount }, () => []);
    
    for (let i = 0; i < playersCount * 13; i++) {
        playerHands[i % playersCount].push(cards.shift());
    }

    const openCard = cards.shift();

    const remainingCards = cards;    
    
    const powerCards = getPowerCards(joker);
    
    return {
        playerHands,
        remainingCards,
        joker,
        openCard,
        powerCards,
        shuffleCardsCount: remainingCards.length
    };
}

// Show Valiation Start

function getMainSuit({ cards, powerCards }) {
    let mainSuit = cards[0].cardSuitValue.suit;
    for (let i = 0; i < cards.length; i++) {
        const cardObj = cards[i];
        if (!powerCards.includes(cardObj.card)) {
            return cardObj.cardSuitValue.suit;
        }
    }
    return mainSuit;
}

function isValidSeqSuit({ cards, powerCards, mainSuit }) {
    let normalCardsCount = 0;
    for (let i = 0; i < cards.length; i++) {
        const cardObj = cards[i];
        if (!powerCards.includes(cardObj.card)) {
            normalCardsCount++;
            if (cardObj.cardSuitValue.suit !== mainSuit) {
                return false;
            }
        }
    }

    // Minimum 2 cards must be normal
    if (normalCardsCount < 2) {
        return false;
    }

    return true;
}

function getAceIndex({ cards, powerCards }) {
    for (let i = 0; i < cards.length; i++) {
        const cardObj = cards[i];
        if (!powerCards.includes(cardObj.card) && cardObj.cardSuitValue.value === 1) {
            return i;
        }
    }
    return -1;
}

function isValidSequence({ cards, powerCards }) {
    let powerCardCount = 0;
    let prevCardValue = -4;
    for(let i = 0; i < cards.length; i++) {
        if (!powerCards.includes(cards[i].card)) {
            if (prevCardValue < 1) {
                prevCardValue = cards[i].cardSuitValue.value;
            }
            if ((prevCardValue > 0) && (i + 1 < cards.length) && 
                (!powerCards.includes(cards[i + 1].card)) && 
                (prevCardValue + 1 !== cards[i + 1].cardSuitValue.value)) {
                return { isValid: false };
            }
        } else {
            powerCardCount++;
        }
        prevCardValue++;
    }

    return { isValid: true, isPure: powerCardCount < 1 }
}

function validateSequence({ cards, powerCards, mainSuit }) {
    const validSeqSuits = isValidSeqSuit({ cards, powerCards, mainSuit });
    if (!validSeqSuits) {
        return { isValid: false };
    }
    const aceIndex = getAceIndex({ cards, powerCards });
    if (aceIndex !== -1) {
        const res = isValidSequence({ cards, powerCards });
        if (res.isValid === true) {
            return res;
        }
        cards[aceIndex].cardSuitValue.value = 14;
        return isValidSequence({ cards, powerCards });        
    }
    return isValidSequence({ cards, powerCards });
}

function validateSet({ cards, powerCards }) {
    const setSuits = [];
    let setValue = -1;    
    for(let i = 0; i < cards.length; i++) {
        const cardObj = cards[i];
        if (!powerCards.includes(cardObj.card)) {
            if (setValue < 1) {
                setValue = cardObj.cardSuitValue.value;
            } else if (cardObj.cardSuitValue.value !== setValue) {
                return { isValid: false };
            }
            if (setSuits.includes(cardObj.cardSuitValue.suit)) {
                return { isValid: false };                
            } else {
                setSuits.push(cardObj.cardSuitValue.suit);
            }
        }
    }

    return { isValid: true };
}

that.validateShow = ({ playerCards, joker, powerCards }) => {
    let hasPureSequence = false;
    let sequenceCount = 0;
    let singleCardGroup = 0;
    return new Promise((resolve, reject) => {
        try {
            playerCards.forEach(cards => {
                if (singleCardGroup > 1) {
                    throw new Error();
                }
                if (cards.length < 3) {
                    singleCardGroup++;
                } else {
                    const mainSuit = getMainSuit({ cards, powerCards });
                    const seq = validateSequence({ cards, powerCards, joker, mainSuit });
                    if (seq?.isValid === false) {                    
                        const set = validateSet({ cards, powerCards, joker });
                        if (set?.isValid === false) {
                            throw new Error();
                        }
                    }
                    if (seq.isValid === true) {
                        sequenceCount++;
                        if (seq.isPure === true) {
                            hasPureSequence = true;
                        }
                    }
                }
            });
            if (!hasPureSequence) {
                throw new Error("Minimum one sequence must be pure!");
            }
            return resolve("Valid Show");
        } catch (error) {
            console.log(error, "validateShow");
            return reject({ err: error.message || "Invalid Show!" });
        }
    });
}

that.getPlayerPoints = ({ playerCards, joker, powerCards }) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (!playerCards || !joker || !powerCards) {
                throw new Error();
            }

            let points = 0;

            playerCards.forEach(cards => {
                if (!cards || !cards.length || !Array.isArray(cards)) {
                    return reject({ err: "Somthing went wrong. Please try again!" });
                }
                if (cards.length < 3) {
                    cards.forEach(cardObj => {
                        points += cardObj.cardSuitValue.value;
                    });
                } else {
                    const mainSuit = getMainSuit({ cards, powerCards });
                    const seq = validateSequence({ cards, powerCards, joker, mainSuit });
                    if (seq?.isValid === false) {                    
                        const set = validateSet({ cards, powerCards, joker });
                        if (set?.isValid === false) {
                            cards.forEach(cardObj => {
                                points += cardObj.cardSuitValue.value;
                            });
                        }
                    }
                }
            });
            // Pending Verification
            resolve({ points });
        } catch (error) {
            console.log(error, "getPlayerPoints");
            reject({ err: error.err || error.message || "Something went wrong. Please try again!" });
        }
    });
}
// Show validation END

that.setAndValidateCards = ({ playerCards, cards, joker }) => {
    return new Promise(async (resolve, reject) => {
        const updatedArr = [];
        for (let i = 0; i < playerCards.length; i++) {
            const cardsArr = playerCards[i];
            const cardsGroup = [];
            for (let j = 0; j < cardsArr.length; j++) {
                const cardObj = cardsArr[j];
                const cardIdx = cards.findIndex(c => c === cardObj.card);
                if (cardIdx === -1) {
                    return reject({ err: "Invalid Cards!" });
                } else {
                    cards.splice(cardIdx, 1);
                    const cardSuitValue = getSuitAndValue(cardObj.card, joker);
                    cardsGroup.push({ id: i + "-" + j, card: cardObj.card, cardSuitValue });
                }
            }
            updatedArr.push(cardsGroup);
        }

        resolve(updatedArr);
    });
}


module.exports = that;