'use strict';

importScripts('mandelbrotCalc.js');

function process(e) {
    //console.log('Got request' + JSON.stringify(e.data));

    //let req = {
    //    sy: sy,
    //    Ci: Ci,
    //    Ci_step: Ci_step,
    //    offset: 0,
    //    crInit: xRange[0],
    //    crStep: dx,
    //    samples: superSamples,
    //    width: width,
    //    colorScheme: colorScheme,
    //    steps: steps
    //};

    let reqs = JSON.parse(e.data);

    let results = [];
    for (let req of reqs) {
        var result = calcLineSuperSampled(req.sy, req.Ci, req.Ci_step,  req.offset, req.crInit, req.crStep, req.samples, req.width, req.colorScheme, req.steps, req.escapeRadius);
        results.push(result);
    }

    self.postMessage(results);

}

self.addEventListener('message', function (e) {
    process(e);
}, false);