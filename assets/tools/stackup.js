/* AC Manufacturing Solutions: 1D tolerance stack-up calculator (worst case and RSS). Runs in the browser. */
(function () {
  "use strict";
  var root = document.querySelector("[data-stack-tool]");
  if (!root) return;
  var $ = function (s) { return root.querySelector(s); };
  var body = $("[data-stack-rows]"), err = $("[data-stack-error]"), out = $("[data-stack-out]"), empty = $("[data-stack-empty]");
  var minEl = $("#st-min"), maxEl = $("#st-max");
  var n = 0;

  var SAMPLE = [
    ["Housing depth", 28.50, 0.10, 0.10, 1],
    ["Bearing width", 12.00, 0.00, 0.12, -1],
    ["Spacer", 15.00, 0.05, 0.05, -1],
    ["Retaining ring", 1.20, 0.03, 0.03, -1]
  ];

  function addRow(v) {
    v = v || ["", "", "", "", 1];
    n++;
    var tr = document.createElement("tr");
    tr.innerHTML =
      '<td><input type="text" aria-label="Dimension ' + n + ' name" class="st-name" autocomplete="off" placeholder="Dimension ' + n + '"></td>' +
      '<td><select aria-label="Dimension ' + n + ' direction" class="st-dir"><option value="1">+ Adds</option><option value="-1">− Reduces</option></select></td>' +
      '<td><input type="text" inputmode="decimal" aria-label="Dimension ' + n + ' nominal" class="st-nom" autocomplete="off"></td>' +
      '<td><input type="text" inputmode="decimal" aria-label="Dimension ' + n + ' plus tolerance" class="st-tp" autocomplete="off" placeholder="0.05"></td>' +
      '<td><input type="text" inputmode="decimal" aria-label="Dimension ' + n + ' minus tolerance" class="st-tm" autocomplete="off" placeholder="0.05"></td>' +
      '<td><button type="button" class="st-del" aria-label="Remove dimension ' + n + '">×</button></td>';
    tr.querySelector(".st-name").value = v[0];
    tr.querySelector(".st-nom").value = v[1] === "" ? "" : Number(v[1]).toFixed(2);
    tr.querySelector(".st-tp").value = v[2] === "" ? "" : Number(v[2]).toFixed(2);
    tr.querySelector(".st-tm").value = v[3] === "" ? "" : Number(v[3]).toFixed(2);
    tr.querySelector(".st-dir").value = String(v[4]);
    tr.querySelector(".st-del").addEventListener("click", function () { if (body.rows.length > 2) tr.remove(); });
    body.appendChild(tr);
  }

  function num(s) { s = String(s).trim(); return s === "" ? NaN : Number(s); }

  // dims: [{name, nom, tp, tm, dir}], tp and tm are positive magnitudes of the plus and minus tolerance
  function compute(dims) {
    var nominal = 0, wcMax = 0, wcMin = 0, mean = 0, ss = 0;
    dims.forEach(function (d) {
      nominal += d.dir * d.nom;
      if (d.dir > 0) { wcMax += d.nom + d.tp; wcMin += d.nom - d.tm; }
      else { wcMax -= d.nom - d.tm; wcMin -= d.nom + d.tp; }
      var mid = d.nom + (d.tp - d.tm) / 2, half = (d.tp + d.tm) / 2;
      d.half = half; mean += d.dir * mid; ss += half * half;
    });
    var rss = Math.sqrt(ss);
    dims.forEach(function (d) { d.share = ss > 0 ? (d.half * d.half) / ss : 0; });
    return { nominal: nominal, wcMax: wcMax, wcMin: wcMin, mean: mean, rss: rss, rssMin: mean - rss, rssMax: mean + rss, dims: dims };
  }

  var dp = 3;
  var f = function (v) { return v.toFixed(dp); };

  function calc(e) {
    if (e) e.preventDefault();
    var dims = [], bad = "";
    Array.prototype.forEach.call(body.rows, function (tr, i) {
      var nom = num(tr.querySelector(".st-nom").value), tp = num(tr.querySelector(".st-tp").value), tm = num(tr.querySelector(".st-tm").value);
      var name = tr.querySelector(".st-name").value.trim() || "Dimension " + (i + 1);
      if (isNaN(nom) && isNaN(tp) && isNaN(tm)) return;
      if (isNaN(nom)) { bad = bad || name + " needs a nominal."; return; }
      if (isNaN(tp)) tp = 0; if (isNaN(tm)) tm = 0;
      if (tp < 0 || tm < 0) { bad = bad || "Enter tolerances as positive sizes, for example + 0.05 and − 0.05."; return; }
      dims.push({ name: name, nom: nom, tp: tp, tm: tm, dir: Number(tr.querySelector(".st-dir").value) });
    });
    if (!bad && dims.length < 2) bad = "Enter at least two dimensions in the loop.";
    var gMin = num(minEl.value), gMax = num(maxEl.value);
    if (!bad && !isNaN(gMin) && !isNaN(gMax) && gMax <= gMin) bad = "The maximum gap must be greater than the minimum.";
    err.textContent = bad; err.hidden = !bad;
    if (bad) return;

    dp = Math.max(2, Math.min(5, Math.max.apply(null, Array.prototype.map.call(root.querySelectorAll(".st-nom,.st-tp,.st-tm"), function (el) { var m = el.value.match(/\.(\d+)/); return m ? m[1].length : 0; }))));
    var r = compute(dims);
    var set = function (k, v) { var el = $('[data-o="' + k + '"]'); if (el) el.textContent = v; };
    set("nominal", f(r.nominal)); set("wc", f(r.wcMin) + " to " + f(r.wcMax)); set("rss", f(r.rssMin) + " to " + f(r.rssMax));
    set("wcRange", "±" + f((r.wcMax - r.wcMin) / 2)); set("rssRange", "±" + f(r.rss)); set("mean", f(r.mean));

    var rows = $("[data-o=contrib]"); rows.innerHTML = "";
    r.dims.slice().sort(function (a, b) { return b.share - a.share; }).forEach(function (d) {
      var li = document.createElement("div"); li.className = "bar-row";
      li.innerHTML = '<span></span><span></span><div class="bar"><i></i></div>';
      li.children[0].textContent = d.name + " (±" + f(d.half) + ")"; li.children[1].textContent = Math.round(d.share * 100) + "%";
      li.querySelector("i").style.width = (d.share * 100).toFixed(1) + "%";
      rows.appendChild(li);
    });
    if (rows.firstChild) rows.firstChild.classList.add("is-weak");

    var notes = [], hasMin = !isNaN(gMin), hasMax = !isNaN(gMax);
    if (hasMin || hasMax) {
      var wcOk = (!hasMin || r.wcMin >= gMin) && (!hasMax || r.wcMax <= gMax);
      var rssOk = (!hasMin || r.rssMin >= gMin) && (!hasMax || r.rssMax <= gMax);
      var req = (hasMin ? "minimum " + f(gMin) : "") + (hasMin && hasMax ? " and " : "") + (hasMax ? "maximum " + f(gMax) : "");
      if (wcOk) notes.push("Worst case meets the requirement (" + req + "). Every assembly will fit, even with every part at its worst limit.");
      else if (rssOk) notes.push("Worst case fails the requirement (" + req + ") but RSS passes. Most assemblies will fit if each process is centred and capable; a few could fail when several parts are at their limits together.");
      else notes.push("Both worst case and RSS fail the requirement (" + req + "). Expect assembly problems: change the design or the tolerances before production.");
    }
    var top = r.dims.slice().sort(function (a, b) { return b.share - a.share; })[0];
    notes.push(top.name + " contributes " + Math.round(top.share * 100) + "% of the statistical variation. Tightening it, or making it more capable, moves the result more than anything else.");
    if (Math.abs(r.mean - r.nominal) > 1e-9) notes.push("Some tolerances are unequal, so the middle of the statistical range (" + f(r.mean) + ") is not the nominal gap (" + f(r.nominal) + "). RSS is calculated about the mean of each tolerance band.");
    notes.push("RSS assumes each dimension varies independently and is centred, with its tolerance equal to about ±3 standard deviations of the process. If processes run off centre or aren't capable, use worst case or a capability-adjusted method.");
    var list = $("[data-o=notes]"); list.innerHTML = "";
    notes.forEach(function (t) { var li = document.createElement("li"); li.textContent = t; list.appendChild(li); });

    empty.hidden = true; out.hidden = false;
  }

  $("[data-stack-form]").addEventListener("submit", calc);
  $("[data-stack-add]").addEventListener("click", function () { addRow(); });
  $("[data-stack-sample]").addEventListener("click", function () {
    body.innerHTML = ""; n = 0; SAMPLE.forEach(addRow); minEl.value = "0.10"; maxEl.value = "0.60"; calc();
  });
  $("[data-stack-clear]").addEventListener("click", function () {
    body.innerHTML = ""; n = 0; addRow(); addRow(); addRow(); minEl.value = ""; maxEl.value = ""; out.hidden = true; empty.hidden = false; err.hidden = true;
  });
  addRow(); addRow(); addRow();
  window.__acmsStack = { compute: compute };
})();
