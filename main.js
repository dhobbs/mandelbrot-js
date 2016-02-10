'use strict';

/*
 * Global variables:
 */
const zoomStart = 3.4;
let zoom = [zoomStart, zoomStart];
const lookAtDefault = [-0.6, 0];
let lookAt = lookAtDefault;
let xRange = [0, 0];
let yRange = [0, 0];
let escapeRadius = 100.0;
let reInitCanvas = true; // Whether to reload canvas size, etc
let dragToZoom = true;
let colors = [[0, 0, 0, 0]];
let renderId = 0; // To zoom before current render is finished
let calcResults = [];

/*
 * Initialize canvas
 */
let canvas;
let ccanvas;
//
let ctx;
//let img;

let cores = navigator.hardwareConcurrency || 4;
let workers = [];

function reInitialiseCanvas() {
    console.log("Reinit canvas");
    reInitCanvas = false;

    resetWorkers(workers);

    canvas = $('canvasMandelbrot');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    ccanvas = $('canvasControls');
    ccanvas.width = window.innerWidth;
    ccanvas.height = window.innerHeight;

    ctx = canvas.getContext('2d');
    //img = ctx.createImageData(canvas.width, 1);

    adjustAspectRatio(xRange, yRange, canvas);
}

function main() {
    console.log("main");
    reInitialiseCanvas();

    $('viewPNG').onclick = function (event) {
        window.location = canvas.toDataURL('image/png');
    };

    $('steps').onkeypress = function (event) {
        // disable auto-iterations when user edits it manually
        $('autoIterations').checked = false;
    };

    $('resetButton').onclick = function (even) {
        $('settingsForm').reset();
        setTimeout(function () {
            location.hash = '';
        }, 1);
        zoom = [zoomStart, zoomStart];
        lookAt = lookAtDefault;
        reInitCanvas = true;
        draw($("colorScheme").value, getSamples());
    };

    if (dragToZoom == true) {
        let box = null;

        $('canvasControls').onmousedown = function (e) {
            if (box == null)
                box = [e.clientX, e.clientY, 0, 0];
        };

        $('canvasControls').onmousemove = function (e) {
            if (box != null) {
                let c = ccanvas.getContext('2d');
                c.lineWidth = 1;

                // clear out old box first
                c.clearRect(0, 0, ccanvas.width, ccanvas.height);

                // draw new box
                c.strokeStyle = '#FF3B03';
                box[2] = e.clientX;
                box[3] = e.clientY;
                c.strokeRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
            }
        };


        let zoomOut = function (event) {
            let x = event.clientX;
            let y = event.clientY;

            let w = window.innerWidth;
            let h = window.innerHeight;

            let dx = (xRange[1] - xRange[0]) / (0.5 + (canvas.width - 1));
            let dy = (yRange[1] - yRange[0]) / (0.5 + (canvas.height - 1));

            x = xRange[0] + x * dx;
            y = yRange[0] + y * dy;

            lookAt = [x, y];

            if (event.shiftKey) {
                zoom[0] /= 0.5;
                zoom[1] /= 0.5;
            }

            draw($("colorScheme").value, getSamples());
        };

        $('canvasControls').onmouseup = function (e) {
            if (box != null) {
                /*
                 * Cleaer entire canvas
                 */
                let c = ccanvas.getContext('2d');
                c.clearRect(0, 0, ccanvas.width, ccanvas.height);

                // Zoom out?
                if (e.shiftKey) {
                    box = null;
                    zoomOut(e);
                    return;
                }


                /*
                 * Calculate new rectangle to render
                 */
                let x = Math.min(box[0], box[2]) + Math.abs(box[0] - box[2]) / 2.0;
                let y = Math.min(box[1], box[3]) + Math.abs(box[1] - box[3]) / 2.0;

                let dx = (xRange[1] - xRange[0]) / (0.5 + (canvas.width - 1));
                let dy = (yRange[1] - yRange[0]) / (0.5 + (canvas.height - 1));

                x = xRange[0] + x * dx;
                y = yRange[0] + y * dy;

                lookAt = [x, y];

                /*
                 * This whole code is such a mess ...
                 */

                let xf = Math.abs(Math.abs(box[0] - box[2]) / canvas.width);
                let yf = Math.abs(Math.abs(box[1] - box[3]) / canvas.height);

                zoom[0] *= Math.max(xf, yf); // retain aspect ratio
                zoom[1] *= Math.max(xf, yf);

                box = null;
                draw($("colorScheme").value, getSamples());
            }
        }
    }

    /*
     * Enable zooming (currently, the zooming is inexact!) Click to zoom;
     * perfect to mobile phones, etc.
     */
    if (dragToZoom == false) {
        $('canvasMandelbrot').onclick = function (event) {
            let x = event.clientX;
            let y = event.clientY;
            let w = window.innerWidth;
            let h = window.innerHeight;

            let dx = (xRange[1] - xRange[0]) / (0.5 + (canvas.width - 1));
            let dy = (yRange[1] - yRange[0]) / (0.5 + (canvas.height - 1));

            x = xRange[0] + x * dx;
            y = yRange[0] + y * dy;

            lookAt = [x, y];

            if (event.shiftKey) {
                zoom[0] /= 0.5;
                zoom[1] /= 0.5;
            } else {
                zoom[0] *= 0.5;
                zoom[1] *= 0.5;
            }

            draw($("colorScheme").value, getSamples());
        };
    }

    /*
     * When resizing the window, be sure to update all the canvas stuff.
     */
    window.onresize = function (event) {
        reInitCanvas = true;
    };

    /*
     * Read hash tag and render away at page load.
     */
    readHashTag();

    /*
     * This is the weirdest bug ever.  When I go directly to a link like
     *
     *   mandelbrot.html#zoom=0.01570294345468629,0.010827482681521361&
     *   lookAt=-0.3083866260309053,-0.6223590662533901&iterations=5000&
     *   superSamples=1&escapeRadius=16&colorScheme=pickColorHSV2
     *
     * it will render a black image, but if I call the function twice, it
     * works nicely.  Must be a global variable that's not been set upon the
     * first entry to the function (TODO: Find out what's wrong).
     *
     * Yeah, I know, the code is a total mess at the moment.  I'll get back
     * to that.
     */
    draw($("colorScheme").value, getSamples());
}

main();