const Youtube = require("youtube-api");
const fs = require("fs");
const Lien = require("lien");
const opn = require("opn");
const prettyBytes = require("pretty-bytes");
const CREDENTIALS = require("./credentials.json");
const async = require("async");
const path = require("path");
const ffmpeg = require('ffmpeg');
const toUploadPATH = "D:\\Vidéos\\UploadList\\";
const uploadedPATH = "D:\\Vidéos\\Uploaded\\";
const encodedPath = "D:\\Vidéos\\Encoded\\";
const colors = require("colors");

let server = new Lien({
    host: "localhost",
    port: 5000
});

let oauth = Youtube.authenticate({
    type: "oauth",
    client_id: CREDENTIALS.web.client_id,
    client_secret: CREDENTIALS.web.client_secret,
    redirect_url: CREDENTIALS.web.redirect_uris[0]
});

opn(oauth.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/youtube.upload"]
}));

let uploadedVideos = 0;

// Handle oauth2 callback
server.addPage("/oauth2callback", lien => {   
    oauth.getToken(lien.query.code, (err, tokens) => {

        if (err) {
            lien.lien(err, 400);
            return console.log(err);
        }

        oauth.setCredentials(tokens);

        lien.end();
        let validVideos = [];
        fs.readdirSync(toUploadPATH).forEach((file, i) => {
            if(file.endsWith(".mp4")) {
                validVideos.push(file);
            }
        });

        async.eachSeries(validVideos, (item, next) => {
            const videoPath = toUploadPATH + item;
            fs.rename(videoPath, toUploadPATH + "video.mp4", function (err) {
                if (err) throw err;
            });
            try {
                const process = new ffmpeg(toUploadPATH + "video.mp4");
                console.log(colors.blue("Encoding: " + item));
                process.then(function (video) {
                    video
                    .setVideoSize('1920x1080?', true, true)
                    .setAudioChannels(2)
                    .setVideoFrameRate(60)
                    .save(encodedPath + "video.mp4", function (error, file) {
                        if (!error) {
                            console.log(colors.green(item + " encoded."));
                            uploadVideo(encodedPath + "video.mp4", item, next);
                        } else {
                            console.log(colors.red(error));
                        }
                    });
                }, function(err) {
                    console.log(colors.red(error));
                });
            } catch (e) {
                console.log(e.code);
                console.log(e.msg);
            }
        });
    });
});

function uploadVideo(videoPath, title, next) {
    console.log(colors.blue("Uploading " + title));
    var req = Youtube.videos.insert({
        resource: {
            // Video title and description
            snippet: {
                title: title,
                description: "Uploaded via ClipLoad\nhttps://github.com/aureleoules/ClipLoad"
            }
            // I don't want to spam my subscribers
        , status: {
                privacyStatus: "unlisted"
            }
        }
        // This is for the callback function
    , part: "snippet,status"

        // Create the readable stream to upload the video
    , media: {
            body: fs.createReadStream(videoPath)
        }
    }, (err, data) => {
        console.log(colors.green(title + " is now on youtube: " + "http://youtu.be/" + data.id + "\n"));
        
        fs.rename(videoPath, uploadedPATH + title + ".mp4", function (err) {
            if (err) throw err;
        });
        next();            
    });
}