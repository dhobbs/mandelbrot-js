'use strict';
/*
 * The Mandelbrot Set, in HTML5 canvas and javascript.
 * https://github.com/cslarsen/mandelbrot-js
 *
 * Copyright (C) 2012 Christian Stigen Larsen
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.  You may obtain
 * a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  See the
 * License for the specific language governing permissions and limitations
 * under the License.
 *
 */


/*
 * Just a shorthand function: Fetch given element, jQuery-style
 */
function $(id) {
    return document.getElementById(id);
}

function focusOnSubmit() {
    let e = $('submitButton');
    if (e) e.focus();
}


function getSamples() {
    let i = parseInt($('superSamples').value, 10);
    return i <= 0 ? 1 : i;
}

/*
 * Update URL's hash with render parameters so we can pass it around.
 */
function updateHashTag(samples, iterations) {
    let radius = $('escapeRadius').value;
    let scheme = $('colorScheme').value;

    location.hash = 'zoom=' + zoom + '&' +
        'lookAt=' + lookAt + '&' +
        'iterations=' + iterations + '&' +
        'superSamples=' + samples + '&' +
        'escapeRadius=' + radius + '&' +
        'colorScheme=' + scheme;
}

/*
 * Update small info box in lower right hand side
 */
function updateInfoBox() {
    // Update infobox
    $('infoBox').innerHTML =
        'x<sub>0</sub>=' + xRange[0] + ' y<sub>0</sub>=' + yRange[0] + ' ' +
        'x<sub>1</sub>=' + xRange[1] + ' y<sub>1</sub>=' + yRange[1] + ' ' +
        'w&#10799;h=' + canvas.width + 'x' + canvas.height + ' '
        + (canvas.width * canvas.height / 1000000.0).toFixed(1) + 'MP';
}

/*
 * Parse URL hash tag, returns whether we should redraw.
 */
function readHashTag() {
    let redraw = false;
    let tags = location.hash.split('&');

    for (let i = 0; i < tags.length; ++i) {
        let tag = tags[i].split('=');
        let key = tag[0];
        let val = tag[1];

        switch (key) {
            case '#zoom':
            {
                let z = val.split(',');
                zoom = [parseFloat(z[0]), parseFloat(z[1])];
                redraw = true;
            }
                break;

            case 'lookAt':
            {
                let l = val.split(',');
                lookAt = [parseFloat(l[0]), parseFloat(l[1])];
                redraw = true;
            }
                break;

            case 'iterations':
            {
                $('steps').value = String(parseInt(val, 10));
                $('autoIterations').checked = false;
                redraw = true;
            }
                break;

            case 'escapeRadius':
            {
                escapeRadius = parseFloat(val);
                $('escapeRadius').value = String(escapeRadius);
                redraw = true;
            }
                break;

            case 'superSamples':
            {
                $('superSamples').value = String(parseInt(val, 512));
                redraw = true;
            }
                break;

            case 'colorScheme':
            {
                $('colorScheme').value = String(val);
                redraw = true;
            }
                break;
        }
    }

    if (redraw)
        reInitCanvas = true;

    return redraw;
}

/*
 * Return number with metric units
 */
function metric_units(number) {
    let unit = ["", "k", "M", "G", "T", "P", "E"];
    let mag = Math.ceil((1 + Math.log(number) / Math.log(10)) / 3);
    return "" + (number / Math.pow(10, 3 * (mag - 1))).toFixed(2) + unit[mag];
}

/*
 * Convert hue-saturation-value/luminosity to RGB.
 *
 * Input ranges:
 *   H =   [0, 360] (integer degrees)
 *   S = [0.0, 1.0] (float)
 *   V = [0.0, 1.0] (float)
 */
function hsv_to_rgb(h, s, v) {
    if (v > 1.0) v = 1.0;
    let hp = h / 60.0;
    let c = v * s;
    let x = c * (1 - Math.abs((hp % 2) - 1));
    let rgb = [0, 0, 0];

    if (0 <= hp && hp < 1) rgb = [c, x, 0];
    if (1 <= hp && hp < 2) rgb = [x, c, 0];
    if (2 <= hp && hp < 3) rgb = [0, c, x];
    if (3 <= hp && hp < 4) rgb = [0, x, c];
    if (4 <= hp && hp < 5) rgb = [x, 0, c];
    if (5 <= hp && hp < 6) rgb = [c, 0, x];

    let m = v - c;
    rgb[0] += m;
    rgb[1] += m;
    rgb[2] += m;

    rgb[0] *= 255;
    rgb[1] *= 255;
    rgb[2] *= 255;
    return rgb;
}

/*
 * Adjust aspect ratio based on plot ranges and canvas dimensions.
 */
function adjustAspectRatio(xRange, yRange, canvas) {
    let ratio = Math.abs(xRange[1] - xRange[0]) / Math.abs(yRange[1] - yRange[0]);
    let sratio = canvas.width / canvas.height;
    if (sratio > ratio) {
        let xf = sratio / ratio;
        xRange[0] *= xf;
        xRange[1] *= xf;
        zoom[0] *= xf;
    } else {
        let yf = ratio / sratio;
        yRange[0] *= yf;
        yRange[1] *= yf;
        zoom[1] *= yf;
    }
}

function resetWorkers(workers) {
    console.log('reset workers');

    for (let worker of workers) {
        worker.terminate();
    }

    while (workers.length) {
        workers.pop();
    }

    for (let i = 0; i < cores; i++) {
        workers[i] = new Worker('mandelworker.js');
        workers[i].onmessage = receiveResults;
    }
}


function receiveResults(e) {
    let calcResult = e.data;
    window.requestAnimationFrame(function (num) {
        renderLines(calcResult)
    });
}

function submitJobs(jobs) {
    let jobChunks = _.chunk(jobs, 2);

    console.log('Sending ' + jobChunks.length + " jobs");

    for (let i = 0; i < jobChunks.length; i++) {
        workers[i % workers.length].postMessage(JSON.stringify(jobChunks[i]));
    }
}

function submitCalcRequest(request) {

}

function renderLine(result) {
    let off = result.off;
    let img = ctx.createImageData(canvas.width, 1);
    for (let x = 0; x < result.data.length;) {
        img.data[off++] = result.data[x++];
        img.data[off++] = result.data[x++];
        img.data[off++] = result.data[x++];
        img.data[off++] = result.data[x++];
    }

    ctx.putImageData(img, 0, result.sy);
}

function renderLines(results) {
    let img = ctx.createImageData(canvas.width, results.length);
    let off = 0;
    for (let r of results) {
        for (let x = 0; x < r.data.length;) {
            img.data[off++] = r.data[x++];
            img.data[off++] = r.data[x++];
            img.data[off++] = r.data[x++];
            img.data[off++] = r.data[x++];
        }
    }
    ctx.putImageData(img, 0, results[0].sy);
}

function draw(colorScheme, superSamples) {
    console.log("Draw");
    lookAt = lookAt || [-0.6, 0];
    zoom = zoom || [zoomStart, zoomStart];

    xRange = [lookAt[0] - zoom[0] / 2, lookAt[0] + zoom[0] / 2];
    yRange = [lookAt[1] - zoom[1] / 2, lookAt[1] + zoom[1] / 2];

    if (reInitCanvas) {
        reInitialiseCanvas();
    }

    let steps = parseInt($('steps').value, 10);

    if ($('autoIterations').checked) {
        let f = Math.sqrt(
            0.001 + 2.0 * Math.min(
                Math.abs(xRange[0] - xRange[1]),
                Math.abs(yRange[0] - yRange[1])));

        steps = Math.floor(223.0 / f);
        $('steps').value = String(steps);
    }

    let escapeRadius = Math.pow(parseFloat($('escapeRadius').value), 2.0);
    let dx = (xRange[1] - xRange[0]) / (0.5 + (canvas.width - 1));
    let dy = (yRange[1] - yRange[0]) / (0.5 + (canvas.height - 1));
    let Ci_step = (yRange[1] - yRange[0]) / (0.5 + (canvas.height - 1));

    updateHashTag(superSamples, steps);
    updateInfoBox();

    // Only enable one render at a time
    renderId += 1;


    function render(height, width) {
        console.log("Render");

        let start = (new Date).getTime();
        let startHeight = height;
        let startWidth = width;
        let lastUpdate = start;
        let updateTimeout = parseFloat($('updateTimeout').value);
        let Ci = yRange[0];
        let sy = 0;
        let ourRenderId = renderId;
        calcResults = [];

        //setTimeout(function () {
        //    renderLines(renderId, updateTimeout);
        //}, updateTimeout);

        let calcRequests = [];

        while (sy < height) {
            if (renderId != ourRenderId ||
                startHeight != height ||
                startWidth != width) {
                // Stop drawing
                console.log("Stop drawing");
                return;
            }

            calcRequests.push({
                sy: sy,
                ci: Ci,
                ciStep: Ci_step,
                offset: 0,
                crInit: xRange[0],
                crStep: dx,
                superSamples: superSamples,
                width: width,
                colorScheme: colorScheme,
                steps: steps,
                escapeRadius: escapeRadius
            });


            Ci += Ci_step;
            sy++;
        }

        submitJobs(calcRequests);
    }

    function scanline(sy, Ci, Ci_step, xRange, dx, superSamples, width, colorScheme, steps, imageData, context2D) {

        let result = calcLineSuperSampled(sy, Ci, Ci_step, 0, xRange[0], dx, superSamples, width, colorScheme, steps);
        renderLine(result, imageData, context2D);

        //    let now = (new Date).getTime();
        //
        //    /*
        //     * Javascript is inherently single-threaded, and the way
        //     * you yield thread control back to the browser is MYSTERIOUS.
        //     *
        //     * People seem to use setTimeout() to yield, which lets us
        //     * make sure the canvas is updated, so that we can do animations.
        //     *
        //     * But if we do that for every scanline, it will take 100x longer
        //     * to render everything, because of overhead.  So therefore, we'll
        //     * do something in between.
        //     */
        //    if (sy++ < height) {
        //        if ((now - lastUpdate) >= updateTimeout) {
        //            // show the user where we're rendering
        //            //drawSolidLine(0, [255, 59, 3, 255]);
        //            context2D.putImageData(imageData, 0, sy);
        //
        //            // Update speed and time taken
        //            let elapsedMS = now - start;
        //            $('renderTime').innerHTML = (elapsedMS / 1000.0).toFixed(1); // 1 comma
        //
        //            let speed = Math.floor(pixels / elapsedMS);
        //
        //            if (metric_units(speed).substr(0, 3) == "NaN") {
        //                speed = Math.floor(60.0 * pixels / elapsedMS);
        //                $('renderSpeedUnit').innerHTML = 'minute';
        //            } else
        //                $('renderSpeedUnit').innerHTML = 'second';
        //
        //            $('renderSpeed').innerHTML = metric_units(speed);
        //
        //            // yield control back to browser, so that canvas is updated
        //            lastUpdate = now;
        //            setTimeout(scanline, 0);
        //        } else
        //            scanline();
        //    }
    };


    render(canvas.height, canvas.width);
}



