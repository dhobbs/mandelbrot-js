'use strict';

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var _ = require('lodash');

app.use(express.static(__dirname));

let sockets = [];

io.on('connection', function(socket){
    console.log('a user connected');
    sockets.push(socket);

    socket.on('disconnect', function(){
        console.log('user disconnected');
        _.remove(sockets, socket);
    });

    socket.on('send request', function(data) {
        console.log('Got request from: ' + socket.id);
        _.sample(sockets).emit('handle request', {id:socket.id, data: data});
    });

    socket.on('send response', function(res) {
        console.log('Sending response to: ' + res.id);

        socket.broadcast.to(res.id).emit('handle response', res.data);
    });
});

app.set('port', process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || 3002);
app.set('ip', process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1");


http.listen(app.get('port') ,app.get('ip'), function () {
    console.log("✔ Express server listening at %s:%d ", app.get('ip'),app.get('port'));
});