var mongoose = require("mongoose");

var itemSechema = new mongoose.Schema({
    displayfilename: String,
    originalfilename: String,
    itemname: String,
    description: String,
    price: Number,
    seller: String,
    reviews: [
        {
            username: String,
            review: String
        }    
    ]
});

module.exports = mongoose.model("Item", itemSechema);