const Mongoose = require("mongoose");

const playerStateSchema = new Mongoose.Schema({
    matchID: {
        type: String,
        required: true,
    },
    userName: { type: String, required: true },
    startState: [
        {
            type: String,
            required: true,
        },
    ],
    currentState: [
        {
            type: String,
        },
    ],
    points: {
        type: Number,
        required: true,
        default: 80,
    },
    playerCards: [[String]],
    inGame: {
        type: Boolean,
        required: true,
        default: true
    },
    matchEndState: {
        type: String
    },
}, { timestamps: true, });

playerStateSchema.methods.toJSON = function () {
    const playerStateObject = this.toObject();

    delete playerStateObject._id;
    delete playerStateObject.points;
    delete playerStateObject.createdAt;
    delete playerStateObject.updatedAt;
    delete playerStateObject.playerCards;
    delete playerStateObject.matchEndState;

    return playerStateObject;
};

const PlayerState = Mongoose.model("PlayerState", playerStateSchema);

module.exports = PlayerState;