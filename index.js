'use strict';

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var _ = require('lodash');

app.use(express.static(__dirname));

let sockets = [];
let responses = new Map();
let requests = [];

let reqCount = 0;
let resCount = 0;

let reqNsp = io.of('/requests');
let resNsp = io.of('/responses');

reqNsp.on('connection', function (socket) {
    console.log('a requesting user connected');
    sockets.push(socket);
    responses.set(socket.id, {socket: socket, queue: []});

    socket.on('disconnect', function () {
        console.log('user disconnected');
        _.remove(sockets, socket);
Inter        responses.delete(socket.id);
    });

    socket.on('send request', function (data) {
        //console.log('Got request from: ' + socket.id);
        console.log('Request number: ' + ++reqCount);
        let req = {id: socket.id, data: data};
        requests.push(req);
    });

    socket.on('send response', function (res) {
        //console.log('Sending response to: ' + res.id);
        console.log('Response number: ' + ++resCount);
        responses.get(res.id).queue.push(res);
    });
});

http.listen(3000, function () {
    console.log('listening on *:3000');
});

setInterval(processQueues, 50);

function processQueues() {
    if (sockets.length) {

        while (responses.length) {
            let res = responses.pop();
            let handler = sockets.shift();

            handler.to(res.id).emit('handle response', res.data, function () {
                console.log('Response handled');
                sockets.push(handler);
            });
        }

        if (requests.length) {
            let req = requests.pop();
            let handler = sockets.shift();

            handler.emit('handle request', req, function () {
                console.log('Request handled');
                sockets.push(handler);
            });
        }
    }

}