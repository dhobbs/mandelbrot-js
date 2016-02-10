'use strict';

importScripts('mandelbrotCalc.js');

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

    let reqs = JSON.parse(e.data);

    let results = [];
    for (let req of reqs) {
        let result = calcLineSuperSampled(req);
        results.push(result);
    }

    self.postMessage(JSON.stringify(results));

}

self.addEventListener('message', process, false);