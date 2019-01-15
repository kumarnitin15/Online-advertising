var mongoose = require("mongoose");
var passportLocalMongoose = require("passport-local-mongoose");

var userSchema = new mongoose.Schema({
    username: String,
    password: String,
    email: String,
    contact: Number,
    profilePicture: String,
    files: [],
    chats: [
        {
            username: String,
            unreadMessages: Number,
            user1: Boolean,
            user2: Boolean,
        }
    ],
    wishlist: [
        {
            displayfilename: String,
            itemname: String
        }    
    ],
    blockedSend: [],
    blockedRecieve: []
});

userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);