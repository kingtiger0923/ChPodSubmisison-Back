const { MongoClient, ObjectId } = require("mongodb");
const { connectionUrl, dbName } = require('../config/db-config');
var Mutex = require('async-mutex').Mutex;

var mutex = new Mutex();
var isUploading = false;

var isUsingFtp = false;

var JSFtp = require('jsftp');
const ftpHost = "ec2-34-217-216-187.us-west-2.compute.amazonaws.com";
const ftpPort = 21;
const ftpUser = "ftpuser@user.com";
const ftpPass = "1234567";

const UserCollection = require("../models/UserModel");
const LessonCollection = require("../models/LessonModel");

module.exports = function(app, upload, fs) {
  app.post('/getFullData', (req, res) => {
    var id = req.body.id;
    UserCollection.findOne({_id: ObjectId(id)}).then(async (user) => {
      var users = [];
      var lessons = [];
      if( user.admin ) {
        users = await UserCollection.find();
      }
      for( let i = 0; i < user.assignments.length; i ++ ) {
        lessons.push(await LessonCollection.findOne({number: user.assignments[i]}).then((lesson) => {
          if( lesson === null ) {
            return LessonCollection.create({
              number: user.assignments[i],
              title: "",
              complete: 0,
              isUploadingFtp: false,
              uploadingFile: "",
              uploadingPercentage: 0,
              details: {
                globalImages: [],
                audioFiles: []
              }
            });
          }
          return lesson;
        }));
      }
      res.send(JSON.stringify({
        user,
        users,
        lessons
      }));
    })
    .catch((err) => {
      console.log(err);
      return res.status(500).send("error");
    });
  });
// User Login , SignUp
  app.post('/userLogin', (req, res) => {
    var email = req.body.email;
    var userId = req.body.userId;
    
    UserCollection.findOne({email}).then((user) => {
      if (user === null) {
        return UserCollection.create({
          email,
          userId,
          active: false,
          admin: false,
          assignments: []
        });
      }
      return user;
    })
    .then(async (user) => {
      if (user.active === false) return res.send("Reg Success");
      else {
        var users = [];
        var lessons = [];
        if( user.admin ) {
          users = await UserCollection.find();
        }
        for( let i = 0; i < user.assignments.length; i ++ ) {
          lessons.push(await LessonCollection.findOne({number: user.assignments[i]}).then((lesson) => {
            if( lesson === null ) {
              return LessonCollection.create({
                number: user.assignments[i],
                title: "",
                complete: 0,
                isUploadingFtp: false,
                uploadingFile: "",
                uploadingPercentage: 0,
                details: {
                  globalImages: [],
                  audioFiles: []
                }
              });
            }
            return lesson;
          }));
        }
        res.send(JSON.stringify({
          user,
          users,
          lessons
        }));
      }
    })
    .catch((err) => {
      console.log(err);
      return res.status(500).send("error");
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
  
  app.post('/uploadassets', upload.array('files', 1) 
  ,(req, res, next) => {
    var LN = req.query.LN;
    for( var i = 0; i < 1; i ++ ) {
      let filename = req.files[i].filename;
      console.log("Start", filename);
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

      let intervalId = setInterval(async function(){
      if( isUploading ) return;
      isUploading = true;
      LessonCollection.findOne({number: LN}).then(async (lesson) => {
        if( lesson === null ) {
        } else {
          isUploading = true;
          console.log("Operation-Start", filename);
          let exist = false;
          if( exten == 'wav' || exten == 'mp3' ) {
            console.log("audio", filename);
            for( let j = 0; j < lesson.details.audioFiles.length; j ++ )
            {
              if( filename.includes(lesson.details.audioFiles[j].fileName) ) {
                exist = true;
                console.log("Exist Audio", filename);
                lesson.details.audioFiles[j].received = true;
                lesson.details.audioFiles[j].duration = duration;
                lesson.details.audioFiles[j].fileName = filename;
                break;
              }
            }
            if( exist == false ) {
              lesson.details.audioFiles.push({
                fileName: filename,
                received: true,
                duration: duration,
                isInFtp: 0,
                imageCount: 0,
                imageFiles: []
              });
            }
            await lesson.save();
          } else if( exten == "jpg" && splits.length == 5 ){
            let imageName = group;
            let audioName = group + "." + duration + ".0000.";
            for( let j = 1; j < splits.length - 2; j ++ )
              imageName += ("." + splits[j]);

            for( j = 0; j < lesson.details.audioFiles.length; j ++ )
            {
              if( lesson.details.audioFiles[j].fileName.includes(audioName) )
              {
                for( let k = 0; k < lesson.details.audioFiles[j].imageFiles.length; k ++ ) {
                  if( lesson.details.audioFiles[j].imageFiles[k].fileName == imageName ) {
                    exist = true;
                    if( lesson.details.audioFiles[j].imageFiles[k][type] == false )
                      lesson.details.audioFiles[j].imageCount += 1;
                    lesson.details.audioFiles[j].imageFiles[k][type] = true;
                  }
                }
                if( exist == false ) {
                  lesson.details.audioFiles[j].imageCount += 1;
                  lesson.details.audioFiles[j].imageFiles.push({
                    fileName: imageName,
                    "tp": type == 'tp',
                    "sp": type == 'sp',
                    "tl": type == 'tl',
                    "sl": type == 'sl',
                    isInFtp_tp: 0,
                    isInFtp_sp: 0,
                    isInFtp_tl: 0,
                    isInFtp_sl: 0
                  });
                }
                exist = true;
              }
            }

            if( !exist ) {
              lesson.details.audioFiles.push({
                fileName: audioName,
                received: false,
                duration: 0,
                isInFtp: 0,
                imageCount: 1,
                imageFiles: [{
                  fileName: imageName,
                  "tp": type == "tp",
                  "sp": type == "sp",
                  "tl": type == "tl",
                  "sl": type == "sl",
                  isInFtp_tp: 0,
                  isInFtp_sp: 0,
                  isInFtp_tl: 0,
                  isInFtp_sl: 0
                }]
              });
            }
            
            await lesson.save();
          } else if( exten == "jpg" && splits.length == 4 ) {
            console.log(filename);
            let found = false;
            for( let j = 0; j < lesson.details.globalImages.length; j ++ ) {
              if( filename == lesson.details.globalImages[j].fileName ) {
                found = true;
              }
            }
            if( !found ) {
              lesson.details.globalImages.push({
                fileName: filename,
                isInFtp: 0
              });
              await lesson.save();
            }
          }
          console.log("Operation-End", filename);
          clearInterval(intervalId);
          isUploading = false;
        }
      });
      }, 350);
      console.log("End", filename);
    }
    res.send("success");
  });

  app.post('/uploadtoftp', (req, res) => {
    var lessonid = req.body.lessonid;
    isUsingFtp = true;
    let Ftp = new JSFtp({
      host: ftpHost,
      port: ftpPort,
    });
    Ftp.auth(ftpUser, ftpPass, function(hadErr) {
      Ftp.raw("mkd", "/" + lessonid, (err, data) => {
        console.error(err);
        console.log(data.text); // Show the FTP response text to the user
        isUsingFtp = false;
      });
    });
    LessonCollection.findOne({number: lessonid}).then((lesson) => {
      if( lesson == null ) {
      } else {          
        for( let i = 0; i < lesson.details.globalImages.length; i ++ ) {
          let fileName = lesson.details.globalImages[i].fileName;
          let group = fileName.split(".")[0];
          if( lesson.details.globalImages[i].isInFtp == 100 ) continue;
          fs.readFile("draft/"+ group +"/" + fileName, (err, buffer) => {
            if(err) {
              console.log(err);
            } else {
              let intervalId = setInterval(function() {
                if(isUsingFtp) return;
                isUsingFtp = true;
                let Ftp = new JSFtp({
                  host: ftpHost,
                  port: ftpPort,
                });
                Ftp.auth(ftpUser, ftpPass, function(hadErr) {
                  Ftp.put(buffer, group + "/" + fileName, (err) => {
                    if( err ) {
                      console.log(err);
                      lesson.details.globalImages[i].isInFtp = -1;
                    } else {
                      console.log("success");
                      lesson.details.globalImages[i].isInFtp = 100;
                    }
                    lesson.save();
                    Ftp.raw("quit", (err, data) => {
                      isUsingFtp = false;
                    });
                  });
                });
                clearInterval(intervalId);
              }, 300);
            }
          });
        }
        for( let i = 0; i < lesson.details.audioFiles.length; i ++ ) {
          let fileName = lesson.details.audioFiles[i].fileName;
          let group = fileName.split(".")[0];
          if( lesson.details.audioFiles[i].isInFtp == 100 ) continue;
          fs.readFile("draft/"+ group +"/" + fileName, (err, buffer) => {
            if(err) {
              console.log(err);
            } else {
              let intervalId = setInterval(function() {
                if(isUsingFtp) return;
                isUsingFtp = true;
                let Ftp = new JSFtp({
                  host: ftpHost,
                  port: ftpPort,
                });
                Ftp.auth(ftpUser, ftpPass, function(hadErr) {
                  Ftp.put(buffer, group + "/" + fileName, (err) => {
                    if( err ) {
                      console.log(err);
                      lesson.details.audioFiles[i].isInFtp = -1;
                    } else {
                      console.log("success");
                      lesson.details.audioFiles[i].isInFtp = 100;
                    }
                    lesson.save();
                    Ftp.raw("quit", (err, data) => {
                      isUsingFtp = false;
                    });
                  });
                  clearInterval(intervalId);
                });
              }, 300);
            }
          });
          for( let j = 0; j < lesson.details.audioFiles[i].imageFiles.length; j ++ ) {
            let imageName = lesson.details.audioFiles[i].imageFiles[j].fileName;
            if( lesson.details.audioFiles[i].imageFiles[j]['tp'] &&
            lesson.details.audioFiles[i].imageFiles[j].isInFtp_tp != 100 ) {
              fs.readFile("draft/"+ group +"/" + imageName + ".tp.jpg", (err, buffer) => {
                if(err) {
                  console.log(err);
                } else {
                  let intervalId = setInterval(function() {
                    if(isUsingFtp) return;
                    isUsingFtp = true;
                    let Ftp = new JSFtp({
                      host: ftpHost,
                      port: ftpPort,
                    });
                    Ftp.auth(ftpUser, ftpPass, function(hadErr) {
                      Ftp.put(buffer, group + "/" + imageName + ".tp.jpg", (err) => {
                        if( err ) {
                          console.log(err);
                          lesson.details.audioFiles[i].imageFiles[j].isInFtp_tp = -1;
                        } else {
                          console.log("success");
                          lesson.details.audioFiles[i].imageFiles[j].isInFtp_tp = 100;
                        }
                        lesson.save();
                        Ftp.raw("quit", (err, data) => {
                          isUsingFtp = false;
                        });
                      });
                    });
                    clearInterval(intervalId);
                  }, 300);
                }
              });
            }
            if( lesson.details.audioFiles[i].imageFiles[j]['sp'] &&
            lesson.details.audioFiles[i].imageFiles[j].isInFtp_sp != 100 ) {
              fs.readFile("draft/"+ group +"/" + imageName + ".sp.jpg", (err, buffer) => {
                if(err) {
                  console.log(err);
                } else {
                  let intervalId = setInterval(function() {
                    if(isUsingFtp) return;
                    isUsingFtp = true;
                    let Ftp = new JSFtp({
                      host: ftpHost,
                      port: ftpPort,
                    });
                    Ftp.auth(ftpUser, ftpPass, function(hadErr) {
                      Ftp.put(buffer, group + "/" + imageName + ".sp.jpg", (err) => {
                        if( err ) {
                          console.log(err);
                          lesson.details.audioFiles[i].imageFiles[j].isInFtp_sp = -1;
                        } else {
                          console.log("success");
                          lesson.details.audioFiles[i].imageFiles[j].isInFtp_s0 = 100;
                        }
                        lesson.save();
                        Ftp.raw("quit", (err, data) => {
                          isUsingFtp = false;
                        });
                      });
                    });
                    clearInterval(intervalId);
                  }, 300);
                }
              });
            }
            if( lesson.details.audioFiles[i].imageFiles[j]['tl'] &&
            lesson.details.audioFiles[i].imageFiles[j].isInFtp_tl != 100 ) {
              fs.readFile("draft/"+ group +"/" + imageName + ".tl.jpg", (err, buffer) => {
                if(err) {
                  console.log(err);
                } else {
                  let intervalId = setInterval(function() {
                    if(isUsingFtp) return;
                    isUsingFtp = true;
                    let Ftp = new JSFtp({
                      host: ftpHost,
                      port: ftpPort,
                    });
                    Ftp.auth(ftpUser, ftpPass, function(hadErr) {
                      Ftp.put(buffer, group + "/" + imageName + ".tl.jpg", (err) => {
                        if( err ) {
                          console.log(err);
                          lesson.details.audioFiles[i].imageFiles[j].isInFtp_tl = -1;
                        } else {
                          console.log("success");
                          lesson.details.audioFiles[i].imageFiles[j].isInFtp_tl = 100;
                        }
                        lesson.save();
                        Ftp.raw("quit", (err, data) => {
                          isUsingFtp = false;
                        });
                      });
                    });
                    clearInterval(intervalId);
                  }, 300);
                }
              });
            }
            if( lesson.details.audioFiles[i].imageFiles[j]['sl'] &&
                lesson.details.audioFiles[i].imageFiles[j].isInFtp_sl != 100 ) {
              fs.readFile("draft/"+ group +"/" + imageName + ".sl.jpg", (err, buffer) => {
                if(err) {
                  console.log(err);
                } else {
                  let intervalId = setInterval(function() {
                    if(isUsingFtp) return;
                    isUsingFtp = true;
                    let Ftp = new JSFtp({
                      host: ftpHost,
                      port: ftpPort,
                    });
                    Ftp.auth(ftpUser, ftpPass, function(hadErr) {
                      Ftp.put(buffer, group + "/" + imageName + ".sl.jpg", (err) => {
                        if( err ) {
                          console.log(err);
                          lesson.details.audioFiles[i].imageFiles[j].isInFtp_sl = -1;
                        } else {
                          console.log("success");
                          lesson.details.audioFiles[i].imageFiles[j].isInFtp_sl = 100;
                        }
                        lesson.save();
                        Ftp.raw("quit", (err, data) => {
                          isUsingFtp = false;
                        });
                      });
                    });
                    clearInterval(intervalId);
                  }, 300);
                }
              });
            }
          }
        }
      }
    });
    // fs.readFile("draft/2345/2345.3.0000.sp.jpg", (err, buffer) => {
    //   if(err) {
    //     console.log(err);
    //     res.send("erro");
    //   } else {
    //     Ftp.put(buffer, "123.jpg", (err) => {
    //       if( err ) {
    //         console.log(err);
    //         res.send("erro");
    //         Ftp.end();
    //       } else {
    //         console.log("success");
    //         res.send("success");
    //       }
    //     });
    //   }
    // });
    res.send("Success");
  });
}