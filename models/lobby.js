const Mongoose = require("mongoose");

const lobbySchema = new Mongoose.Schema({
    roomName: {
        type: String,
        required: true,
    },
    roomID: {
        type: String, // uuid
        required: true,
        unique: true,
    },
    lobbyStatus: {
        type: String,
        required: true,
        default: "InLobby",
        enum: ["InLobby", "InGame", "hasEnded"], // Only allow these three values
    },
    maxPlayers: {
        type: Number,
        required: true,
        min: 2,
        max: 5,
    },
    timeLimit: {
        type: Number,
        required: true,
        default: 60,
        min: 20,
        max: 100
    },
    isPublicRoom: {
        type: Boolean,
        required: true,
        default: false,
    },
    players: [
        {
            userName: { type: String, required: true },
            socketID: { type: String },
            isAdmin: { type: Boolean, required: true, default: false },
            playerStatus: { type: String, enum: ["InGame", "Offline", "InLobby"], default: "InLobby", required: true } //Pending Doubt
        }
    ],
    matches: [
        {
            type: String,
        }
    ],
    currentMatch: {
        type: String,
        unique: true,
        default: undefined,
        sparse: true,  // Allows null and undefined to not violate uniqueness constraint
    },
}, { timestamps: true, });

lobbySchema.methods.toJSON = function () {
    const lobbyObject = this.toObject();

    delete lobbyObject._id;
    delete lobbyObject.createdAt;
    delete lobbyObject.updatedAt;
    
    if (lobbyObject.players) {
        lobbyObject.players = lobbyObject.players.map(player => {
            const { socketID, ...playersWithoutID } = player;
            return playersWithoutID;
        });
    }
    
    return lobbyObject;
};

const Lobby = Mongoose.model("Lobby", lobbySchema);

module.exports = Lobby;