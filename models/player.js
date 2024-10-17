const Mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcrypt");

const playerSchema = new Mongoose.Schema({
    userName: {
        type: String,
        required: true,
        trim: true,
        minlength: 4,
        unique: true
    },
    email: {
        type: String,
        unique: true,
        required: true,
        trim: true,
        validate(value) {
            if (!validator.isEmail(value)) {
                throw new Error("Invalid Email");
            }
        },
    },
    password: {
        type: String,
        trim: true,
        minlength: 7,
    },
    // InGameCoins: {
    //     type: Number,
    //     trim: true,
    //     default: 500,
    //     required: true,
    // },
    currState: {
        playerIn: { type: String, enum: ["InGame", "InLobby", null], default: null },
        collectionID: { type: String },
    },
    isGuest: {
        type: Boolean,
        required: true,
        default: true,
    },
    matchesHistory: [
        {
            type: String,
        }
    ],
    tokens: [
        {
            token: {
                type: String,
            },
        },
    ],
}, { timestamps: true, });
  
playerSchema.methods.toJSON = function () {
    const playerObject = this.toObject();

    delete playerObject.password;
    delete playerObject.tokens;
    delete playerObject._id;
    delete playerObject.matchesHistory;
    delete playerObject.createdAt;
    delete playerObject.updatedAt;

    return playerObject;
};

playerSchema.pre("save", async function (next) {
    if (this.isModified("password")) {
        this.password = await bcrypt.hash(this.password, 8);
    }

    next();
});

const Player = Mongoose.model("Player", playerSchema);

module.exports = Player;