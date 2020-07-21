const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Create Schema
const UserSchema = new Schema({
  email: {
    type: String,
    unique: true
  },
  userId: String,
  active: Boolean,
  admin: Boolean,
  assignments: Array
});

module.exports = UserCollection = mongoose.model("user", UserSchema);
