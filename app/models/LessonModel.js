const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Create Schema
const LessonSchema = new Schema({
  number: {
    type: String,
    unique: true
  },
  isUploadingFtp: Boolean,
  uploadingFile: String,
  uploadingPercentage: Number,
  title: String,
  complete: Number,
  details: {
      globalImages: [{
        fileName: String,
        isInFtp: Number
      }],
      audioFiles: [{
        fileName: String,
        received: Boolean,
        duration: Number,
        isInFtp: Number,
        imageCount: Number,
        imageFiles: [{
          fileName: String, //Without Extension
          minute: Number,
          second: Number,
          "tp": Boolean,
          "sp": Boolean,
          "tl": Boolean,
          "sl": Boolean,
          isInFtp_tp: Number,
          isInFtp_sp: Number,
          isInFtp_tl: Number,
          isInFtp_sl: Number
        }]
      }],
  }
});

module.exports = LessonCollection = mongoose.model("lesson", LessonSchema);
