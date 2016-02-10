'use strict';
const interiorColor = [0, 0, 0, 255];

/*
* Main renderer equation.
*
* Returns number of iterations and values of Z_{n}^2 = Tr + Ti at the time
* we either converged (n == iterations) or diverged.  We use these to
* determined the color at the current pixel.
*
* The Mandelbrot set is rendered taking
*
*     Z_{n+1} = Z_{n} + C
*
* with C = x + iy, based on the "look at" coordinates.
*
* The Julia set can be rendered by taking
*
*     Z_{0} = C = x + iy
    *     Z_{n+1} = Z_{n} + K
*
* for some arbitrary constant K.  The point C for Z_{0} must be the
* current pixel we're rendering, but K could be based on the "look at"
* coordinate, or by letting the user select a point on the screen.
*/
function iterateEquation(Cr, Ci, escapeRadius, iterations) {
    let Zr = 0;
    let Zi = 0;
    let Tr = 0;
    let Ti = 0;
    let n = 0;

    for (; n < iterations && (Tr + Ti) <= escapeRadius; ++n) {
        Zi = 2 * Zr * Zi + Ci;
        Zr = Tr - Ti + Cr;
        Tr = Zr * Zr;
        Ti = Zi * Zi;
    }

    /*
     * Four more iterations to decrease error term;
     * see http://linas.org/art-gallery/escape/escape.html
     */
    for (let e = 0; e < 4; ++e) {
        Zi = 2 * Zr * Zi + Ci;
        Zr = Tr - Ti + Cr;
        Tr = Zr * Zr;
        Ti = Zi * Zi;
    }

    return [n, Tr, Ti];
}

function calcLineSuperSampled(req) {
    let pickColor = getColorPicker(req.colorScheme);

    let result = {data: [], off: req.off, width: req.width, sy: req.sy};

    let samples = Math.min(2, req.superSamples);
    let cr = req.crInit;

    let pixelCount = 0;
    for (let x = 0; x < req.width; ++x, cr += req.crStep) {
        let color = [0, 0, 0, 255];

        for (let s = 0; s < samples; ++s) {
            let rx = Math.random() * req.crStep;
            let ry = Math.random() * req.ciStep;
            let p = iterateEquation(cr - rx / 2, req.ci - ry / 2, req.escapeRadius, req.steps);
            color = addRGB(color, pickColor(req.steps, p[0], p[1], p[2]));
        }

        color = divRGB(color, samples);


        result.data[pixelCount++] = color[0];
        result.data[pixelCount++] = color[1];
        result.data[pixelCount++] = color[2];
        result.data[pixelCount++] = 255;
    }
    return result;
}

function addRGB(v, w) {
    v[0] += w[0];
    v[1] += w[1];
    v[2] += w[2];
    v[3] += w[3];
    return v;
}

function divRGB(v, div) {
    v[0] /= div;
    v[1] /= div;
    v[2] /= div;
    v[3] /= div;
    return v;
}

// Some constants used with smoothColor
let logBase = 1.0 / Math.log(2.0);
let logHalfBase = Math.log(0.5) * logBase;

function smoothColor(steps, n, Tr, Ti) {
    /*
     * Original smoothing equation is
     *
     * let v = 1 + n - Math.log(Math.log(Math.sqrt(Zr*Zr+Zi*Zi)))/Math.log(2.0);
     *
     * but can be simplified using some elementary logarithm rules to
     */
    return 5 + n - logHalfBase - Math.log(Math.log(Tr + Ti)) * logBase;
}

function pickColorHSV1(steps, n, Tr, Ti) {
    if (n == steps) // converged?
        return interiorColor;

    let v = smoothColor(steps, n, Tr, Ti);
    let c = hsv_to_rgb(360.0 * v / steps, 1.0, 1.0);
    c.push(255); // alpha
    return c;
}

function pickColorHSV2(steps, n, Tr, Ti) {
    if (n == steps) // converged?
        return interiorColor;

    let v = smoothColor(steps, n, Tr, Ti);
    let c = hsv_to_rgb(360.0 * v / steps, 1.0, 10.0 * v / steps);
    c.push(255); // alpha
    return c;
}

function pickColorHSV3(steps, n, Tr, Ti) {
    if (n == steps) // converged?
        return interiorColor;

    let v = smoothColor(steps, n, Tr, Ti);
    let c = hsv_to_rgb(360.0 * v / steps, 1.0, 10.0 * v / steps);

    // swap red and blue
    let t = c[0];
    c[0] = c[2];
    c[2] = t;

    c.push(255); // alpha
    return c;
}

function pickColorGrayscale(steps, n, Tr, Ti) {
    if (n == steps) // converged?
        return interiorColor;

    let v = smoothColor(steps, n, Tr, Ti);
    v = Math.floor(512.0 * v / steps);
    if (v > 255) v = 255;
    return [v, v, v, 255];
}

function pickColorGrayscale2(steps, n, Tr, Ti) {
    if (n == steps) { // converged?
        let c = 255 - Math.floor(255.0 * Math.sqrt(Tr + Ti)) % 255;
        if (c < 0) c = 0;
        if (c > 255) c = 255;
        return [c, c, c, 255];
    }

    return pickColorGrayscale(steps, n, Tr, Ti);
}

function getColorPicker(value) {
    let p = value;
    if (p == "pickColorHSV1") return pickColorHSV1;
    if (p == "pickColorHSV2") return pickColorHSV2;
    if (p == "pickColorHSV3") return pickColorHSV3;
    if (p == "pickColorGrayscale2") return pickColorGrayscale2;
    return pickColorGrayscale;
}