/* AC Manufacturing Solutions: process capability calculator. Runs entirely in the browser. */
(function () {
  "use strict";

  var root = document.querySelector("[data-cap-tool]");
  if (!root) return;

  var $ = function (s) { return root.querySelector(s); };
  var form = $("[data-cap-form]");
  var dataEl = $("#cap-data"), lslEl = $("#cap-lsl"), uslEl = $("#cap-usl"), nomEl = $("#cap-nom");
  var subEl = $("#cap-sub"), unitEl = $("#cap-unit");
  var out = $("[data-cap-out]"), empty = $("[data-cap-empty]"), errEl = $("[data-cap-error]");
  var canvas = $("[data-cap-chart]");

  var SAMPLE = "24.997 25.003 25.006 25.000 24.996 25.003 25.005 25.008 24.998 24.998 25.008 25.007 25.011 25.009 25.004 25.005 25.009 25.005 25.003 25.001 25.002 25.002 25.000 25.001 25.003 25.006 25.008 25.004 24.996 25.006 24.999 25.004 24.999 25.005 25.001 25.007 25.010 25.006 25.010 25.001 25.001 25.005 25.001 25.003 25.002 24.999 25.006 25.000 25.011 25.001";

  // Bias correction constants for the average range of a subgroup of size n
  var D2 = { 2: 1.128, 3: 1.693, 4: 2.059, 5: 2.326, 6: 2.534, 7: 2.704, 8: 2.847, 9: 2.970, 10: 3.078 };

  // Complementary error function, fractional error below 1.2e-7 everywhere (good in the tails)
  function erfc(x) {
    var z = Math.abs(x), t = 1 / (1 + 0.5 * z);
    var r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
      t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  }
  function tailBelow(z) { return 0.5 * erfc(-z / Math.SQRT2); }  // P(Z < z)
  function tailAbove(z) { return 0.5 * erfc(z / Math.SQRT2); }   // P(Z > z)

  function parseNum(s) {
    s = String(s).trim();
    if (s === "") return null;
    var v = Number(s);
    return isFinite(v) ? v : NaN;
  }

  function parseData(text) {
    var parts = text.split(/[\s,;]+/).filter(Boolean), vals = [], bad = [], dec = 0;
    parts.forEach(function (p) {
      var v = Number(p);
      if (isFinite(v)) {
        vals.push(v);
        var m = p.match(/\.(\d+)/); if (m) dec = Math.max(dec, m[1].length);
      } else bad.push(p);
    });
    return { vals: vals, bad: bad, dec: dec };
  }

  function stats(x, lsl, usl, k) {
    var n = x.length, sum = 0, i;
    for (i = 0; i < n; i++) sum += x[i];
    var mean = sum / n, ss = 0, m3 = 0, m4 = 0;
    for (i = 0; i < n; i++) { var d = x[i] - mean; ss += d * d; m3 += d * d * d; m4 += d * d * d * d; }
    var sdo = Math.sqrt(ss / (n - 1));
    var mv = ss / n;
    var skew = mv > 0 ? (m3 / n) / Math.pow(mv, 1.5) : 0;
    var kurt = mv > 0 ? (m4 / n) / (mv * mv) - 3 : 0;

    // Within (short-term) sigma: moving range for individuals, average range for subgroups
    var sdw, groups = 0, leftover = 0;
    if (k <= 1) {
      var mr = 0;
      for (i = 1; i < n; i++) mr += Math.abs(x[i] - x[i - 1]);
      sdw = (mr / (n - 1)) / 1.128;
    } else {
      groups = Math.floor(n / k); leftover = n - groups * k;
      var rsum = 0;
      for (var g = 0; g < groups; g++) {
        var lo = Infinity, hi = -Infinity;
        for (var j = 0; j < k; j++) { var v = x[g * k + j]; if (v < lo) lo = v; if (v > hi) hi = v; }
        rsum += hi - lo;
      }
      sdw = groups > 0 ? (rsum / groups) / D2[k] : NaN;
    }

    var hasL = lsl !== null, hasU = usl !== null;
    function idx(sd) {
      var r = {};
      r.cp = hasL && hasU ? (usl - lsl) / (6 * sd) : null;
      r.cpu = hasU ? (usl - mean) / (3 * sd) : null;
      r.cpl = hasL ? (mean - lsl) / (3 * sd) : null;
      r.cpk = hasL && hasU ? Math.min(r.cpu, r.cpl) : hasU ? r.cpu : r.cpl;
      var below = hasL ? tailBelow((lsl - mean) / sd) : 0;
      var above = hasU ? tailAbove((usl - mean) / sd) : 0;
      r.ppm = (below + above) * 1e6;
      return r;
    }
    var w = sdw > 0 ? idx(sdw) : null, o = sdo > 0 ? idx(sdo) : null;

    var observed = 0, lo2 = Infinity, hi2 = -Infinity;
    for (i = 0; i < n; i++) {
      if ((hasL && x[i] < lsl) || (hasU && x[i] > usl)) observed++;
      if (x[i] < lo2) lo2 = x[i]; if (x[i] > hi2) hi2 = x[i];
    }
    // Approximate 95% confidence interval for Cpk (Bissell)
    function ci(c) {
      if (c === null || !isFinite(c)) return null;
      var se = Math.sqrt(1 / (9 * n) + (c * c) / (2 * (n - 1)));
      return [c - 1.96 * se, c + 1.96 * se];
    }
    return {
      n: n, mean: mean, sdo: sdo, sdw: sdw, min: lo2, max: hi2, skew: skew, kurt: kurt,
      w: w, o: o, observed: observed, groups: groups, leftover: leftover,
      ciW: w ? ci(w.cpk) : null, ciO: o ? ci(o.cpk) : null
    };
  }

  function rating(c) {
    if (c === null || !isFinite(c)) return { label: "Not available", cls: "" };
    if (c >= 1.67) return { label: "Capable with margin", cls: "is-good" };
    if (c >= 1.33) return { label: "Capable", cls: "is-good" };
    if (c >= 1.0) return { label: "Marginal", cls: "is-warn" };
    return { label: "Not capable", cls: "is-bad" };
  }

  var fmt = function (v, d) { return v === null || !isFinite(v) ? "n/a" : v.toFixed(d); };
  function fmtPpm(p) {
    if (p === null || !isFinite(p)) return "n/a";
    if (p < 0.01) return "Under 0.01";
    if (p < 10) return p.toFixed(2);
    if (p < 1000) return p.toFixed(0);
    return Math.round(p).toLocaleString("en-CA");
  }

  function findings(s, lsl, usl, k, nom) {
    var f = [], w = s.w, o = s.o;
    var main = w ? w.cpk : null, r = rating(main);
    if (main !== null) {
      if (main >= 1.67) f.push("Cpk " + fmt(main, 2) + ": capable with margin. That clears the common 1.33 minimum and the 1.67 often required for new or safety-critical characteristics.");
      else if (main >= 1.33) f.push("Cpk " + fmt(main, 2) + ": capable. That meets the common 1.33 minimum, but not the 1.67 often required for new or safety-critical characteristics.");
      else if (main >= 1) f.push("Cpk " + fmt(main, 2) + " is marginal. The process fits inside the tolerance but with little room for drift, tool wear or a new operator.");
      else f.push("Cpk " + fmt(main, 2) + " means the process is not capable. Expect parts outside the tolerance unless every part is inspected.");
    }
    if (w && w.cp !== null && w.cp - w.cpk > 0.15 * w.cp && w.cp >= 1) {
      var target = nom !== null ? nom : (lsl + usl) / 2;
      f.push("The spread would fit, but the process runs off centre: the mean is " + fmt(Math.abs(s.mean - target), dec + 1) + " " + unit() + " from " + (nom !== null ? "nominal" : "mid-tolerance") + ". Centring it would lift Cpk toward Cp (" + fmt(w.cp, 2) + ") without reducing variation at all.");
    }
    if (w && o && s.sdw > 0 && s.sdo / s.sdw > 1.3) {
      f.push("Overall variation is " + fmt(s.sdo / s.sdw, 1) + " times the short-term variation, so Ppk (" + fmt(o.cpk, 2) + ") is well below Cpk. That points to drift between " + (k > 1 ? "subgroups" : "readings over time") + ": setups, tool changes, material lots or shifts. Stabilize the process before trying to improve it.");
    }
    if (s.n < 30) f.push("Only " + s.n + " readings. With so few, the true Cpk could be anywhere from " + fmt(s.ciW ? s.ciW[0] : null, 2) + " to " + fmt(s.ciW ? s.ciW[1] : null, 2) + ". Aim for at least 30, and 100 for a formal study.");
    else if (s.ciW) f.push("With " + s.n + " readings, the true Cpk is likely between " + fmt(s.ciW[0], 2) + " and " + fmt(s.ciW[1], 2) + " (95% confidence).");
    if (Math.abs(s.skew) > 1 || Math.abs(s.kurt) > 2) f.push("The data look non-normal (skewness " + fmt(s.skew, 2) + "). Cpk assumes a normal distribution, so treat the expected defect rate with caution. Features like flatness, runout and position are often naturally skewed.");
    if (s.observed > 0) f.push(s.observed + " of " + s.n + " readings are already outside the specification.");
    if (k > 1 && s.leftover > 0) f.push("The last " + s.leftover + " reading" + (s.leftover > 1 ? "s don't" : " doesn't") + " fill a subgroup of " + k + ", so " + (s.leftover > 1 ? "they were" : "it was") + " left out of the short-term sigma.");
    return f;
  }

  var dec = 3;
  var unit = function () { return unitEl.value.trim() || "units"; };
  var last = null;

  function showError(msg) {
    errEl.textContent = msg; errEl.hidden = !msg;
  }

  function calc(e) {
    if (e) e.preventDefault();
    var parsed = parseData(dataEl.value);
    var lsl = parseNum(lslEl.value), usl = parseNum(uslEl.value), nom = parseNum(nomEl.value);
    var k = parseInt(subEl.value, 10) || 1;
    dec = Math.min(Math.max(parsed.dec, 1), 6);

    if (parsed.vals.length < 5) return showError("Enter at least 5 measurements. Separate them with spaces, commas or new lines.");
    if (isNaN(lsl) || isNaN(usl) || isNaN(nom)) return showError("Limits must be numbers. Use a point for decimals, like 25.020.");
    if (lsl === null && usl === null) return showError("Enter at least one specification limit.");
    if (lsl !== null && usl !== null && usl <= lsl) return showError("The upper limit must be greater than the lower limit.");
    if (k > 1 && parsed.vals.length < 2 * k) return showError("You need at least two full subgroups of " + k + " readings.");
    var s = stats(parsed.vals, lsl, usl, k);
    if (!(s.sdo > 0) || !(s.sdw > 0)) return showError("All readings are identical, so there is no variation to measure. Check the gauge resolution.");
    showError(parsed.bad.length ? "Ignored " + parsed.bad.length + " entr" + (parsed.bad.length > 1 ? "ies" : "y") + " that weren't numbers: " + parsed.bad.slice(0, 3).join(", ") + (parsed.bad.length > 3 ? "…" : "") : "");

    var main = s.w.cpk, r = rating(main);
    var set = function (sel, v) { var el = $(sel); if (el) el.textContent = v; };
    set("[data-o=cpk]", fmt(main, 2));
    var st = $("[data-o=status]"); st.textContent = r.label; st.className = "cap-status " + r.cls;
    set("[data-o=cp]", fmt(s.w.cp, 2));
    set("[data-o=ppk]", fmt(s.o.cpk, 2));
    set("[data-o=pp]", fmt(s.o.cp, 2));
    set("[data-o=n]", s.n + (k > 1 ? " (" + s.groups + " × " + k + ")" : ""));
    set("[data-o=mean]", fmt(s.mean, dec + 1));
    set("[data-o=sdw]", fmt(s.sdw, dec + 1));
    set("[data-o=sdo]", fmt(s.sdo, dec + 1));
    set("[data-o=range]", fmt(s.min, dec) + " to " + fmt(s.max, dec));
    set("[data-o=obs]", s.observed + " of " + s.n);
    set("[data-o=ppmw]", fmtPpm(s.w.ppm));
    set("[data-o=ppmo]", fmtPpm(s.o.ppm));
    set("[data-o=cpl]", fmt(s.w.cpl, 2));
    set("[data-o=cpu]", fmt(s.w.cpu, 2));
    root.querySelectorAll("[data-o-unit]").forEach(function (el) { el.textContent = unit(); });

    var list = $("[data-o=findings]");
    list.innerHTML = "";
    findings(s, lsl, usl, k, nom).forEach(function (t) { var li = document.createElement("li"); li.textContent = t; list.appendChild(li); });

    last = { s: s, x: parsed.vals, lsl: lsl, usl: usl, nom: nom, k: k };
    empty.hidden = true; out.hidden = false;
    var send = $("[data-cap-send]");
    if (send) send.href = "/contact.html?message=" + encodeURIComponent("I used the capability calculator and would like a proper capability study.\n\n" + summary());
    draw();
    if (e && window.matchMedia("(max-width: 960px)").matches) out.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function draw() {
    if (!last) return;
    var s = last.s, x = last.x, lsl = last.lsl, usl = last.usl, nom = last.nom;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    var lo = Math.min(s.min, lsl !== null ? lsl : s.min, s.mean - 4 * s.sdo);
    var hi = Math.max(s.max, usl !== null ? usl : s.max, s.mean + 4 * s.sdo);
    var pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
    var padL = 14, padR = 14, top = 34, base = H - 34;
    var X = function (v) { return padL + ((v - lo) / (hi - lo)) * (W - padL - padR); };

    // Bins aligned to the gauge resolution so quantized readings don't leave empty gaps
    var res = Math.pow(10, -dec);
    var target = Math.min(25, Math.max(6, Math.ceil(Math.sqrt(x.length)) + 2));
    var bw = Math.max(res, Math.ceil(((s.max - s.min) / target) / res - 1e-9) * res);
    var start = s.min - res / 2;
    var bins = Math.max(1, Math.ceil((s.max + res / 2 - start) / bw - 1e-9));
    var counts = new Array(bins).fill(0);
    x.forEach(function (v) { counts[Math.min(bins - 1, Math.max(0, Math.floor((v - start) / bw + 1e-9)))]++; });
    var peakPdf = x.length * bw / (s.sdo * Math.sqrt(2 * Math.PI));
    var ymax = Math.max(Math.max.apply(null, counts), peakPdf) * 1.12;
    var Y = function (c) { return base - (c / ymax) * (base - top); };

    // Tolerance zone
    if (lsl !== null || usl !== null) {
      ctx.fillStyle = "rgba(180,190,202,.06)";
      var zx0 = lsl !== null ? X(lsl) : padL, zx1 = usl !== null ? X(usl) : W - padR;
      ctx.fillRect(zx0, top - 10, zx1 - zx0, base - top + 10);
    }
    // Bars
    for (var i = 0; i < bins; i++) {
      var b0 = start + i * bw, b1 = b0 + bw, mid = (b0 + b1) / 2;
      var outside = (lsl !== null && mid < lsl) || (usl !== null && mid > usl);
      ctx.fillStyle = outside ? "rgba(232,102,28,.9)" : "rgba(237,240,244,.82)";
      var x0 = X(b0) + 1, x1 = X(b1) - 1;
      ctx.fillRect(x0, Y(counts[i]), Math.max(1, x1 - x0), base - Y(counts[i]));
    }
    // Fitted normal curve (overall sigma)
    ctx.strokeStyle = "rgba(240,138,75,.95)"; ctx.lineWidth = 1.5; ctx.beginPath();
    for (var q = 0; q <= 200; q++) {
      var xv = lo + (q / 200) * (hi - lo);
      var pdf = Math.exp(-0.5 * Math.pow((xv - s.mean) / s.sdo, 2)) * peakPdf;
      if (q === 0) ctx.moveTo(X(xv), Y(pdf)); else ctx.lineTo(X(xv), Y(pdf));
    }
    ctx.stroke();
    // Baseline
    ctx.strokeStyle = "rgba(180,190,202,.4)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, base + .5); ctx.lineTo(W - padR, base + .5); ctx.stroke();
    // Limits and nominal
    ctx.font = "500 12px Archivo, system-ui, sans-serif"; ctx.textAlign = "center";
    function vline(v, label, color, dash) {
      if (v === null) return;
      ctx.strokeStyle = color; ctx.setLineDash(dash); ctx.beginPath();
      ctx.moveTo(X(v) + .5, top - 14); ctx.lineTo(X(v) + .5, base); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = color; ctx.fillText(label, X(v), top - 20);
      ctx.fillStyle = "rgba(133,146,161,1)"; ctx.fillText(v.toFixed(dec), X(v), base + 20);
    }
    vline(lsl, "LSL", "#E8661C", [4, 4]);
    vline(usl, "USL", "#E8661C", [4, 4]);
    if (nom !== null) vline(nom, "Nominal", "rgba(180,190,202,.7)", [2, 4]);
    // Mean marker
    ctx.fillStyle = "#EDF0F4";
    var xm = X(s.mean);
    ctx.beginPath(); ctx.moveTo(xm, base + 2); ctx.lineTo(xm - 5, base + 10); ctx.lineTo(xm + 5, base + 10); ctx.closePath(); ctx.fill();
  }

  function summary() {
    if (!last) return "";
    var s = last.s;
    var lines = [
      "Process capability summary (acmss.ca/tools/capability-calculator.html)",
      "Specification: " + (last.lsl !== null ? "LSL " + last.lsl : "no LSL") + ", " + (last.usl !== null ? "USL " + last.usl : "no USL") + (last.nom !== null ? ", nominal " + last.nom : "") + " " + unit(),
      "Readings: " + s.n + (last.k > 1 ? " in subgroups of " + last.k : " (individuals)"),
      "Mean " + fmt(s.mean, dec + 1) + ", sigma within " + fmt(s.sdw, dec + 1) + ", sigma overall " + fmt(s.sdo, dec + 1),
      "Cp " + fmt(s.w.cp, 2) + ", Cpk " + fmt(s.w.cpk, 2) + " (" + rating(s.w.cpk).label + ")",
      "Pp " + fmt(s.o.cp, 2) + ", Ppk " + fmt(s.o.cpk, 2),
      "Expected out of spec: " + fmtPpm(s.w.ppm) + " ppm short term, " + fmtPpm(s.o.ppm) + " ppm overall",
      "Observed out of spec: " + s.observed + " of " + s.n
    ];
    return lines.join("\n");
  }

  form.addEventListener("submit", calc);
  $("[data-cap-sample]").addEventListener("click", function () {
    dataEl.value = SAMPLE; lslEl.value = "24.980"; uslEl.value = "25.020"; nomEl.value = "25.000"; subEl.value = "5"; unitEl.value = "mm";
    calc({ preventDefault: function () {} });
  });
  $("[data-cap-clear]").addEventListener("click", function () {
    form.reset(); out.hidden = true; empty.hidden = false; showError(""); last = null; dataEl.focus();
  });
  var copyBtn = $("[data-cap-copy]");
  copyBtn.addEventListener("click", function () {
    var text = summary();
    var done = function () { var t = copyBtn.textContent; copyBtn.textContent = "Copied"; setTimeout(function () { copyBtn.textContent = t; }, 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { window.prompt("Copy the summary:", text); });
    else window.prompt("Copy the summary:", text);
  });
  $("[data-cap-print]").addEventListener("click", function () { window.print(); });

  var rt;
  window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(draw, 120); });
  window.addEventListener("beforeprint", draw);

  // Expose the maths for testing
  window.__acmsCapability = { stats: stats, erfc: erfc };
})();
