const { MongoClient, ObjectId } = require("mongodb");
const { connectionUrl, dbName } = require('../config/db-config');

module.exports = function(app) {
// User Login , SignUp
    app.post('/userLogin', (req, res) => {
        var email = req.query.email;
        var userId = req.query.userId;

        MongoClient.connect(connectionUrl, { useNewUrlParser: true }).then(
            (client) => {
                var db = client.db(dbName);
                var users = db.collection("users");
                users.find({
                    email: email
                }).toArray((err, result) => {
                    if( err ) {
                        console.log( " Error Number 101 " );
                    } else if ( result.length == 0 ) {
                        users.insertOne({
                            email: email,
                            userId: userId,
                            active: false,
                            admin: false,
                            assignments: []
                        }, function(err, res) {
                        });
                        users.find().sort({"_id": -1}).limit(1).toArray((err, result) => {
                            res.send("Reg Success");
                        });
                    } else {
                        if( result[0].active ) {
                            res.send(result[0]._id);
                        } else {
                            res.send("Reg Success1");
                        }
                    }
                });
            }
        );
    });
    app.post('/getUserInfo', (req, res) => {
        var Userid = req.query.id;
        MongoClient.connect(connectionUrl, { useNewUrlParser: true }).then(
            (client) => {
                var db = client.db(dbName);
                var users = db.collection("users");
                users.find({
                    "_id": ObjectId(Userid)
                }).toArray((err, result) => {
                    if( result.length > 0 ) {
                        if( result[0].active ) {
                            res.send(JSON.stringify({
                                email: result[0].email,
                                userName: result[0].userId,
                                admin: result[0].admin
                            }));
                        } else {
                            res.send("not activated");
                        }
                    } else {
                        res.send("error");
                    }
                });
            });
    })
    app.get('/getAllUsers', (req, res) => {
        MongoClient.connect(connectionUrl, { useNewUrlParser: true }).then(
            (client) => {
                var db = client.db(dbName);
                var users = db.collection("users");
                users.find().toArray((err, result) => {
                    res.send(JSON.stringify(result));
                });
            });
    });
}