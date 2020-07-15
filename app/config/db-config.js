const { MongoClient, ObjectId } = require("mongodb");

const connectionUrl = "mongodb://localhost:27017";
const dbName = "ChPod_Submittings";


const init = () =>
  MongoClient.connect(connectionUrl, { useNewUrlParser: true }).then(
    (client) => {
      var db = client.db(dbName);
      db.collection("users");
    }
  );

module.exports = { init, connectionUrl, dbName };
