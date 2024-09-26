const express = require("express");
const router = new express.Router();
const validator = require("validator");
const bcrypt = require("bcrypt");
const { getPlayer } = require("../controllers/player");

router.post("/login", async (req, res) => {
    const keys = Object.keys(req.body);
    const allowed = ["email", "password"];
    const isValid = keys.every((key) => allowed.includes(key));

    if (!isValid) {
        return res.status(400).send("Invalid Information");
    }

    const { email, password } = req.body;

    if (typeof email !== "string" || !validator.isEmail(email)) return res.status(422).send({ message: "Invalid email!" });

    const { player } = await getPlayer({ email });

    if (!player) {
        return res.status(400).send({ message: "Incorrect Email or Password!" });
    }

    const passwordCheck = await bcrypt.compare(password, player.password);

    if (!passwordCheck) {
        return res.status(400).send({ message: "Incorrect Email or Password!" });
    }

    const { token, message } = await addToken(player);
    if (message) {
        return res.status(500).send({ message: "Something went wrong!" });
    }

    res.status(200).send({
        message: "Succesfully LoggedIn",
        playerData: { token, name: player.name },
    });
});

module.exports = router;