const { MongoClient, ObjectId } = require("mongodb");
const { connectionUrl, dbName } = require('../config/db-config');

const UserCollection = require("../models/UserModel");
const LessonCollection = require("../models/LessonModel");

module.exports = function(app, upload, fs) {
// User Login , SignUp
  app.post('/userLogin', (req, res) => {
    var email = req.body.email;
    var userId = req.body.userId;
    UserCollection.findOne({email}).then((user) => {
      if (user === null) {
        UserCollection.create({
          email,
          userId,
          active: false,
          admin: false,
          assignments: []
        });
      }
      return user;
    })
    .then((user) => {
      if (user.active === false) return res.send("Reg Success");
      return res.send(user._id);
    })
    .catch((err) => {
      console.log(err);
      return res.status(500).send("error");
    });
  });
  app.post('/getUserInfo', (req, res) => {
    var Userid = req.body.id;
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
    UserCollection.find({}).then((result) => {
      res.send(JSON.stringify(result));
    });
  });

  app.post('/getLessons', (req, res) => {
    var Userid = req.body.id;

    UserCollection.findOne({
      "_id": ObjectId(Userid)
    }).then((user) => {
      if (user !== null) {
        if( user.active ) {
          res.send(JSON.stringify({
            lessons: user.assignments
          }));
        } else {
          res.send("not activated");
        }
      } else {
        res.send("error");
      }
    });
  });

  app.post('/editUser', (req, res) => {
    var userData = req.body.user;
    
    UserCollection.findOne({
      "_id": ObjectId(userData._id)
    }).then((user) => {
      if (user !== null) {
        user.active = userData.active;
        user.admin = userData.admin;
        user.assignments = userData.assignments;
        user.save();
        res.send("success");
      } else {
        res.send("error");
      }
    });
  });
  app.post('/getLessonsDetail', (req, res) => {
    var lessons = req.body.lessons;
    var resObject = [];
    for( let i = 0; i < lessons.length; i ++ ) {
      LessonCollection.findOne({number: lessons[i]}).then((result) => {
        if( result === null ) {
          LessonCollection.create({
            number: lessons[i],
            title: "",
            complete: 0,
            details: {
              audioFiles: []
            }
          });
          resObject.push({
            number:  lessons[i],
            title: "",
            complete: 0
          });
        } else {
          resObject.push({
            number: result.number,
            title: result.title,
            complete: result.complete
          });
        }
        return i;
      }).then((idx) => {
        if( idx == lessons.length - 1 ){
          res.send(JSON.stringify(resObject));
        }
      });
    }
  });
  app.post('/getLessonAssets', (req, res) => {
    let number = req.body.number;
    LessonCollection.findOne({number}).then((lesson) => {
      if( lesson === null ) {
        res.send("error");
      } else {
        res.send(JSON.stringify(lesson));
      }
    });
  });
  app.post('/uploadassets', upload.array('files', 1) 
  ,(req, res, next) => {
    var LN = req.query.LN;
    for( var i = 0; i < req.files.length; i ++ ) {
      let filename = req.files[i].filename;
      let splits = filename.split(".");
      let group = splits[0];
      let exten = splits[splits.length - 1];
      let type = splits[splits.length - 2]; //For Image
      let duration = splits[1]; //For Audios

      if( !fs.existsSync("./draft") )
        fs.mkdirSync( "./draft" );
      if( !fs.existsSync("./draft/" + group) )
        fs.mkdirSync( "./draft/" + group );
      if( fs.existsSync('draft/' + group + '/' + filename) )
        continue;
      fs.renameSync('tmp/uploads/'+filename, 'draft/' + group + '/' + filename);

      LessonCollection.findOne({number: LN}).then((lesson) => {
        if( lesson === null ) {
          //
        } else {
          let exist = false;
          if( exten == 'wav' || exten == 'mp3' ) {
            for( let j = 0; j < lesson.details.audioFiles.length; j ++ )
            {
              if( filename.includes(lesson.details.audioFiles[j].fileName) ) {
                exist = true;
                lesson.details.audioFiles[j].received = true;
                lesson.details.audioFiles[j].duration = duration;
                lesson.details.audioFiles[j].fileName = filename;
                lesson.save();
                break;
              }
            }
            if( !exist ) {
              lesson.details.audioFiles.push({
                fileName: filename,
                received: true,
                duration: duration,
                imageCount: 0,
                imageFiles: []
              });
              lesson.save();
            }
          } else {
            let imageName = group;
            for( let j = 1; j < splits.length - 2; j ++ )
              imageName += ("." + splits[j]);

            let audioName = group + "." + duration + ".0000.";
            for( j = 0; j < lesson.details.audioFiles.length; j ++ )
            {
              if( lesson.details.audioFiles[j].fileName.includes(audioName) )
              {
                for( let k = 0; k < lesson.details.audioFiles[j].imageFiles.length; k ++ ) {
                  if( lesson.details.audioFiles[j].imageFiles[k].fileName == imageName ) {
                    exist = true;
                    if( !lesson.details.audioFiles[j].imageFiles[k][type] )
                      lesson.details.audioFiles[j].imageCount ++;
                    lesson.details.audioFiles[j].imageFiles[k][type] = true;
                  }
                }
                if( !exist ) {
                  lesson.details.audioFiles[j].imageFiles.push({
                    fileName: imageName,
                    "tp": false,
                    "sp": false,
                    "tl": false,
                    "sl": false,
                    "bg": false
                  });
                  lesson.details.audioFiles[j].imageFiles[lesson.details.audioFiles[j].imageFiles.length - 1][type] = true;
                }
                exist = true;
              }
            }

            if( !exist ) {
              lesson.details.audioFiles.push({
                fileName: audioName,
                received: false,
                duration: 0,
                imageCount: 1,
                imageFiles: [{
                  fileName: imageName,
                  "tp": type == "tp",
                  "sp": type == "sp",
                  "tl": type == "tl",
                  "sl": type == "sl",
                  "bg": type == "bg"
                }]
              });
            }
            
            lesson.save();
          }
        }
      });
    }
    res.send("success");
  });
}