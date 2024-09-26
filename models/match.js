const Mongoose = require("mongoose");

const matchSchema = new Mongoose.Schema({
    matchID: {
        type: String,
        required: true,
        unique: true,
    },
    roomID: {
        type: String,
        required: true,
    },
    joker: {
        type: String,
        required: true,
    },
    roundNumber: {
        type: Number,
        required: true,
        default: 0,
    },
    shuffleNumber: {
        type: Number,
        required: true,
        default: 0,
    },
    shuffledCards: [
        {
            type: String,
            required: true,
        }
    ],
    shuffleCardsCount: {
        type: Number,
        required: true,
    },
    timeLimit: {
        type: Number,
        required: true,
        default: 60,
    },
    hasEnded: {
        type: Boolean,
        required: true,
        default: false,
    },
    matchStartedAt: {
        type: String,
        required: true
    },
    players: [
        {
            userName: { type: String, required: true },
            position: { type: Number, required: true, default: 0 },
            isMyTurn: { type: Boolean, default: false, required: true },
            turnStartedAt: { type: String },
            playerAction: {
                type: String,
                default: "None",
                required: true,
                enum: ["Pick", "Drop", "None"],
            },
            playerStatus: { type: String, required: true, default: "Offline", enum: ["InGame", "Offline", "Lost"] },
        }
    ],
    cardsRotation: [
        {
            card: { type: String, required: true },
            userName: { type: String, required: true },
            timeStamp: { type: String, required: true },
            updateType: { type: String, required: true, enum: ["Drop", "Pick"] }
        }
    ],
    powerCards: [
        {
            type: String
        }
    ],
    droppedCards: [
        {
            card: { type: String, required: true },
            roundNumber: { type: Number, required: true },
            userName: { type: String, required: true },
        }
    ],
}, { timestamps: true, });

matchSchema.methods.toJSON = function () {
    const matchObject = this.toObject();

    delete matchObject.shuffleNumber;
    delete matchObject.shuffledCards;    
    delete matchObject._id;
    delete matchObject.createdAt;
    delete matchObject.updatedAt;

    return matchObject;
};

const Match = Mongoose.model("Match", matchSchema);

module.exports = Match;