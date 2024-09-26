const jwt = require("jsonwebtoken");
const Player = require("../models/player");

const that = {};

that.generateToken = (playerInfo, options) => {
    return new Promise(async (resolve, reject) => {
        try {
            const token = jwt.sign(playerInfo, process.env.JWT, options || {});
    
            resolve(token);
        } catch (error) {
            reject({ err: error.message || "Something went wrong. Please try again!" });
        }
    });
};

that.verifyToken = async (req, res, next) => {
    if (req.header("Authorization")) {
        const token = req.header("Authorization");
        try {
            const decoded = jwt.verify(token, process.env.JWT);
    
            const player = await Player.findOne({
                _id: decoded._id,
                "tokens.token": token,
            });

            if (!player) {
                throw new Error();
            }
    
            req.token = token;
            req.player = player;
            req.addNewPlayer = false;
    
            next();
        } catch (err) {
            console.log(err);
            return res.status(401).send({ message: "Unauthorized Access!" });            
        }
    } else {
        try {
            req.addNewPlayer = true;

            next();
        } catch (error) {
            console.log(error);
            return res.status(500).send("Something went wrong!");
        }        
    } 
};

that.verifySocketToken = ({ token }) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (!token) {
                throw new Error("Unauthorized Access!");
            }
            const decoded = jwt.verify(token, process.env.JWT);
            
            const player = await Player.findOne({
                _id: decoded._id,
                "tokens.token": token,
            });
            
            if (!player) {
                throw new Error("Unauthorized Access!");
            }

            resolve({ player });
        } catch (error) {
            reject({ err: error.err || error.message || "Something went wrong!" });
        }
    });
}

module.exports = that;


// if (err.name === "TokenExpiredError") {
//     const removeToken = req.header("Authorization");
//     const player = await Player.findOne({ "tokens.token": removeToken });

//     if (!player) {
//         return;
//     }
//     player.tokens = player.tokens.filter((token) => {
//         return token.token !== removeToken;
//     });

//     await player.save();
// }