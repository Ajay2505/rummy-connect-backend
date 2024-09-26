const mongoose = require("mongoose");

const uri =
  "mongodb+srv://" + process.env.MONGO_USERNAME + ":" +
  encodeURIComponent(process.env.MONGO_PASS) +
  "@" + process.env.MONGO_CLUSTER + ".mongodb.net/" + process.env.DB_NAME + "?retryWrites=true&w=majority";

async function dbConnect() {
  try {
    mongoose.set("strictQuery", false);
    await mongoose.connect(uri);
    console.log("Successfully connected to MongoDB!");
  } catch (e) {
    console.error(e);
  }
}

async function connectToDataBase() {
  await dbConnect();
} 

module.exports = connectToDataBase;