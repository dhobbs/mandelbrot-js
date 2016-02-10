'use strict';

importScripts('mandelbrotCalc.js');
importScripts('/socket.io/socket.io.js');

function processRequestData(data) {
    let reqs = JSON.parse(data);

    let results = [];
    for (let req of reqs) {
        let result = calcLineSuperSampled(req);
        results.push(result);
    }

    return results;
}
function process(e) {
    //console.log('Got request' + JSON.stringify(e.data));

    //let req = {
    //    sy: sy,
    //    ci: ci,
    //    ciStep: ciStep,
    //    offset: 0,
    //    crInit: xRange[0],
    //    crStep: dx,
    //    superSamples: superSamples,
    //    width: width,
    //    colorScheme: colorScheme,
    //    steps: steps,
    //    escapeRadius: escapeRadius
    //};
    socket.emit('send request', e.data);
}

self.addEventListener('message', process, false);

let socket = io();

socket.on('handle request', handleRequest);
socket.on('handle response',handleResponse);

function handleRequest(msg) {
    console.log('Handling request from server');
    let req = msg;
    let id = req.id;
    let results = processRequestData(req.data);
    socket.emit('send response', {id: id, data: results});
}

function handleResponse(msg) {
    //console.log('Handling reply from server: ' + msg);
    self.postMessage(msg);
}