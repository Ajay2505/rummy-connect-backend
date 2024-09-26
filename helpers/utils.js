const that = {};

that.generateUpdate = ({ message }) => {
    return { message, timeStamp: new Date() };
}

module.exports = that;