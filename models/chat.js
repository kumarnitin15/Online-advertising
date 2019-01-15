var mongoose = require("mongoose");

var chatSchema = new mongoose.Schema({
    user1: String,
    user2: String,
    chat: [
        {
            username: String,
            message: String
        }
    ]
});

module.exports = mongoose.model("Chat", chatSchema);