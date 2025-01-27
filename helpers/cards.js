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

function isValidSeqSuit({ cards }) {
    let mainSuit = "";
    let seqNormalCardsCount = 0;
    for (let i = 0; i < cards.length; i++) {
        const cardObj = cards[i];
        if (!cardObj.isPowerCard) {
            seqNormalCardsCount++;
            if (!mainSuit) {
                mainSuit = cardObj.cardSuitValue.suit;
            }
            if (cardObj.cardSuitValue.suit !== mainSuit) {
                return { isValid: false };
            }
        }
    }

    // Minimum 2 cards must be normal
    if (seqNormalCardsCount < 2) {
        return { isValid: false, err: "Minimum 2 cards must be normal in a sequence (Not jokers)" };
    }

    return { isValid: true };
}

function getAceIndex({ cards }) {
    for (let i = 0; i < cards.length; i++) {
        const cardObj = cards[i];
        if (!cardObj.isPowerCard && cardObj.cardSuitValue.value === 1) {
            return i;
        }
    }
    return -1;
}


function sequenceSorter({ cards }) {
    const seqNormalCards = cards.filter(card => !card.isPowerCard);
    const seqPowerCards = cards.filter(card => card.isPowerCard);

    seqNormalCards.sort((a, b) => a.cardSuitValue.value - b.cardSuitValue.value);

    const sortedArray = [];
    let prevValue = null;

    for (let i = 0; i < seqNormalCards.length; i++) {
        const currentCard = seqNormalCards[i];

        if (prevValue !== null) {
            const expectedValue = prevValue + 1;
            while (expectedValue < currentCard.cardSuitValue.value && seqPowerCards.length > 0) {
                const powerCard = seqPowerCards.shift();
                sortedArray.push(powerCard);
                prevValue = expectedValue;
            }
        }

        sortedArray.push(currentCard);
        prevValue = currentCard.cardSuitValue.value;
    }

    sortedArray.push(...seqPowerCards);
    
    return sortedArray;
}

function isValidSequence({ cards }) {
    let prevValue = null; // Track the previous card value
    let powerCardCount = 0; // Count available power cards
    let isPure = true;

    for (const card of cards) {
        if (card.isPowerCard) {
            powerCardCount++;
            isPure = false;
            continue; // Skip power cards for now
        }

        if (prevValue !== null) {
            const gap = card.cardSuitValue.value - prevValue;

            if (gap === 0) {
                // Duplicate values are not allowed
                return { isValid: false, isPure: false };
            }

            if (gap > 1) {
                // Check if we have enough power cards to fill the gap
                if (gap - 1 > powerCardCount) {
                    return { isValid: false, isPure: powerCardCount === 0 };
                }
                // Use power cards to fill the gap
                powerCardCount -= gap - 1;
            }
        }

        // Update previous value
        prevValue = card.cardSuitValue.value;
    }

    return { isValid: true, isPure };
}

function validateSequence({ cards }) {
    const validSeqSuits = isValidSeqSuit({ cards });
    if (!validSeqSuits.isValid) {
        return { isValid: false, err: validSeqSuits?.err || "" };
    }
    
    const sortedArr = sequenceSorter({ cards });    

    const aceIndex = getAceIndex({ cards: sortedArr });

    if (aceIndex !== -1) {
        const res = isValidSequence({ cards: sortedArr });
        if (res.isValid === true) {
            return res;
        }
        sortedArr[aceIndex].cardSuitValue.value = 14;
        
        return isValidSequence({ cards: sequenceSorter({ cards: sortedArr }) });
    }
    return isValidSequence({ cards: sortedArr });
}

function validateSet({ cards }) {
    const setSuits = [];
    let setValue = -1;    
    for(let i = 0; i < cards.length; i++) {
        const cardObj = cards[i];
        if (!cardObj.isPowerCard) {
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

that.validateShow = ({ playerCards }) => {
    let hasPureSequence = false;
    let sequenceCount = 0;
    let singleCardGroup = 0;
    return new Promise((resolve, reject) => {
        try {
            playerCards.forEach(cards => {   
                if (cards.length < 1) {
                    throw new Error();
                }
                if (cards.length === 1) {
                    singleCardGroup++;
                }
                if (singleCardGroup > 1 || cards.length === 2) {
                    throw new Error();
                } 
                if (cards.length > 2) {
                    const seq = validateSequence({ cards });
                    if (seq.isValid === false) {
                        if (seq?.err) {
                            throw new Error(seq.err);
                        }
                        const set = validateSet({ cards });
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
            if (singleCardGroup > 1) {
                throw new Error();
            }
            if (sequenceCount > 0 && !hasPureSequence) {
                throw new Error("Minimum one sequence must be pure! (Without Joker)");
            }
            return resolve("Valid Show");
        } catch (error) {
            return reject({ err: error.message || "Invalid Show!" });
        }
    });
}

that.getPlayerPoints = ({ playerCards }) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (!playerCards) {
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
                    const seq = validateSequence({ cards });
                    if (seq?.isValid === false) {                    
                        const set = validateSet({ cards });
                        if (set?.isValid === false) {
                            cards.forEach(cardObj => {
                                points += cardObj.cardSuitValue.value;
                            });
                        }
                    }
                }
            });
            // Pending Verification
            resolve({ points: points > 80 ? 80 : points });
        } catch (error) {
            reject({ err: error.err || error.message || "Something went wrong. Please try again!" });
        }
    });
}
// Show validation END

that.setAndValidateCards = ({ playerCards, cards, joker, powerCards }) => {
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
                    // cardsGroup.push({ id: i + "-" + j, card: cardObj.card, cardSuitValue });
                    cardsGroup.push({
                        id: i + "-" + j,
                        card: cardObj.card,
                        cardSuitValue,
                        isPowerCard: powerCards.includes(cardObj.card)
                    });
                }
            }
            updatedArr.push(cardsGroup);
        }

        resolve(updatedArr);
    });
}


module.exports = that;