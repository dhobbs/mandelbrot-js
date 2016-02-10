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

http.listen(8080, function(){
    console.log('listening on *:8080');
});