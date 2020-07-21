const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Create Schema
const LessonSchema = new Schema({
  number: {
    type: String,
    unique: true
  },
  title: String,
  complete: Number,
  details: {
      audioFiles: [{
        fileName: String,
        received: Boolean,
        duration: Number,
        imageCount: Number,
        imageFiles: [{
          fileName: String, //Without Extension
          minute: Number,
          second: Number,
          "tp": Boolean,
          "sp": Boolean,
          "tl": Boolean,
          "sl": Boolean,
          "bg": Boolean
        }]
      }],
  }
});

module.exports = LessonCollection = mongoose.model("lesson", LessonSchema);
