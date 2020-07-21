const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { init } = require("./app/config/db-config");
const connectDB = require("./app/config/connectDB");
var multer = require('multer');
var fs = require('fs');
const appPort = 3000;
const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var storage = multer.diskStorage({
  destination: 'tmp/uploads',
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

var upload = multer({storage: storage});


app.use(cors());
require("./app/routes")(app, upload, fs);


connectDB();

console.log("Starting server on port " + appPort);
app.listen(appPort);

