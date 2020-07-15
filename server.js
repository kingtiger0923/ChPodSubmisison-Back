const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { init } = require("./app/config/db-config");

const appPort = 3000;
const app = express();

app.use(cors());
require("./app/routes")(app);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

init().then(() => {
  console.log("Starting server on port " + appPort);
  app.listen(appPort);
});
