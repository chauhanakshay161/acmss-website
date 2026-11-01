/* AC Manufacturing Solutions: OEE calculator. Runs entirely in the browser. */
(function () {
  "use strict";
  var root = document.querySelector("[data-oee-tool]");
  if (!root) return;
  var $ = function (s) { return root.querySelector(s); };
  var form = $("[data-oee-form]"), out = $("[data-oee-out]"), empty = $("[data-oee-empty]"), err = $("[data-oee-error]");
  var f = { shift: $("#oee-shift"), breaks: $("#oee-breaks"), down: $("#oee-down"), cycle: $("#oee-cycle"), total: $("#oee-total"), rejects: $("#oee-rejects") };

  function num(el) { var v = String(el.value).trim(); return v === "" ? NaN : Number(v); }
  var pct = function (v) { return (v * 100).toFixed(1) + "%"; };
  var mins = function (v) { return (Math.round(v * 10) / 10).toLocaleString("en-CA") + " min"; };

  function compute(shift, breaks, down, cycleSec, total, rejects) {
    var planned = shift - breaks, run = planned - down;
    var ideal = cycleSec / 60;                       // minutes per part
    var A = run / planned, P = (ideal * total) / run, Q = (total - rejects) / total;
    return {
      planned: planned, run: run, A: A, P: P, Q: Q, oee: A * P * Q,
      good: total - rejects, maxParts: Math.floor(planned / ideal),
      lossA: down, lossP: run - ideal * total, lossQ: ideal * rejects, fully: ideal * (total - rejects)
    };
  }

  var ADVICE = {
    A: "Availability is the biggest loss. Log every stop over a few shifts with its cause and length, then attack the top two: usually setups, waiting for material or first-off approval, and breakdowns.",
    P: "Performance is the biggest loss. The machine is running but slower than its ideal rate: short stops, reduced feeds, or a cycle time standard that no longer matches the program. Time 20 cycles and compare.",
    Q: "Quality is the biggest loss. Every rejected part also consumed machine time. Find which feature and which step cause the rejects; a capability study on that feature is the usual first step."
  };

  function calc(e) {
    if (e) e.preventDefault();
    var shift = num(f.shift), breaks = num(f.breaks) || 0, down = num(f.down) || 0, cyc = num(f.cycle), total = num(f.total), rej = num(f.rejects) || 0;
    var msg = "";
    if (!(shift > 0)) msg = "Enter the shift length in minutes.";
    else if (breaks < 0 || down < 0 || rej < 0) msg = "Breaks, downtime and rejects can't be negative.";
    else if (breaks >= shift) msg = "Planned breaks must be shorter than the shift.";
    else if (down >= shift - breaks) msg = "Unplanned downtime must be less than the planned production time.";
    else if (!(cyc > 0)) msg = "Enter the ideal cycle time in seconds per part.";
    else if (!(total > 0)) msg = "Enter the total number of parts made.";
    else if (rej > total) msg = "Rejects can't be more than the total parts made.";
    err.textContent = msg; err.hidden = !msg;
    if (msg) return;

    var r = compute(shift, breaks, down, cyc, total, rej);
    var set = function (k, v) { var el = $('[data-o="' + k + '"]'); if (el) el.textContent = v; };
    set("oee", pct(r.oee)); set("A", pct(r.A)); set("P", pct(r.P)); set("Q", pct(r.Q));
    set("planned", mins(r.planned)); set("run", mins(r.run)); set("good", r.good.toLocaleString("en-CA") + " of " + total.toLocaleString("en-CA"));
    set("max", r.maxParts.toLocaleString("en-CA")); set("lossA", mins(r.lossA)); set("lossP", mins(Math.max(0, r.lossP))); set("lossQ", mins(r.lossQ));

    // Loss waterfall bars as a share of planned time
    [["fully", r.fully], ["lossQ", r.lossQ], ["lossP", Math.max(0, r.lossP)], ["lossA", r.lossA]].forEach(function (p) {
      var bar = $('[data-w="' + p[0] + '"]'); if (bar) bar.style.width = Math.max(0, Math.min(100, (p[1] / r.planned) * 100)).toFixed(1) + "%";
    });

    var notes = [];
    if (r.P > 1.0001) notes.push("Performance is above 100%, so the ideal cycle time is slower than the machine really runs. Use the fastest proven cycle time for this part, otherwise OEE is overstated.");
    var losses = { A: r.lossA, P: Math.max(0, r.lossP), Q: r.lossQ }, worst = "A";
    ["P", "Q"].forEach(function (k) { if (losses[k] > losses[worst]) worst = k; });
    if (r.P <= 1.0001) notes.push(ADVICE[worst]);
    notes.push("OEE of " + pct(r.oee) + " means this resource made " + r.good.toLocaleString("en-CA") + " good parts out of a possible " + r.maxParts.toLocaleString("en-CA") + " in the planned time.");
    notes.push("85% is often quoted as world class, but the useful comparison is this machine against itself over time, and OEE matters most at the bottleneck.");
    var list = $("[data-o=notes]"); list.innerHTML = "";
    notes.forEach(function (t) { var li = document.createElement("li"); li.textContent = t; list.appendChild(li); });

    empty.hidden = true; out.hidden = false;
    if (e && e.type === "submit" && window.matchMedia("(max-width: 960px)").matches) out.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  form.addEventListener("submit", calc);
  $("[data-oee-sample]").addEventListener("click", function () {
    f.shift.value = 480; f.breaks.value = 30; f.down.value = 47; f.cycle.value = 60; f.total.value = 330; f.rejects.value = 9;
    calc({ preventDefault: function () {}, type: "sample" });
  });
  $("[data-oee-clear]").addEventListener("click", function () { form.reset(); out.hidden = true; empty.hidden = false; err.hidden = true; });
  window.__acmsOee = { compute: compute };
})();
