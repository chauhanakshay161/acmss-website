/* AC Manufacturing Solutions: process stability self-assessment. Runs entirely in the browser. */
(function () {
  "use strict";

  var root = document.querySelector("[data-assess]");
  if (!root) return;
  var form = root.querySelector("[data-assess-form]");
  var $ = function (s) { return root.querySelector(s); };

  var AREAS = {
    std: {
      name: "Standard work", lower: "standard work",
      why: "When each operator runs the job their own way, every other improvement is built on sand. Results vary by shift, and nobody can say which method is right.",
      title: "Make one critical operation run the same way on every shift",
      steps: [
        "Pick the operation with the most scrap or rework in the last three months.",
        "Watch, or video, two different operators doing the setup and the first part. List every difference you see.",
        "Write a one-page setup sheet for that operation, calling out the two or three steps that actually cause scrap. Have both operators use it for a week and fix what they find."
      ],
      svc: "/services.html#standardization", svcName: "Process standardization and throughput stabilization"
    },
    know: {
      name: "Knowledge risk", lower: "knowledge risk",
      why: "Critical know-how lives in a few people. That works until someone is sick, retires or leaves, and then first-pass yield drops and nobody can say exactly why.",
      title: "Get the knowledge that only one person has written down",
      steps: [
        "List the three people you couldn't lose for a month, and the jobs only they can run well.",
        "For each one, sit with them on a single critical job and record the reasons behind their settings and workarounds, not just the steps.",
        "Pair each of them with a backup who runs that job under supervision at least once this month."
      ],
      svc: "/services.html#knowledge", svcName: "Documentation and knowledge capture"
    },
    meas: {
      name: "Measurement and capability", lower: "measurement",
      why: "Without numbers on your critical features you are managing by inspection: sorting good parts from bad instead of knowing whether the process can make good parts at all.",
      title: "Put a number on your most critical features",
      steps: [
        "Pick the three features most likely to cause a customer return or a failed first article.",
        "Collect at least 30 consecutive readings for each, in production order, from normal production.",
        "Run each set through the free capability calculator and start with the lowest Cpk. Check the gauge before you blame the process."
      ],
      svc: "/services.html#packages", svcName: "Capability study package", tool: "/tools/capability-calculator.html"
    },
    flow: {
      name: "Constraint and flow", lower: "the constraint",
      why: "If you can't prove where the bottleneck is, overtime, outsourcing and new equipment are guesses. Improving anything other than the constraint doesn't increase output.",
      title: "Find and measure the real constraint",
      steps: [
        "Walk the line at the same time on three different days and note where work in progress piles up.",
        "At that operation, time 20 consecutive cycles and write down every stop and its cause.",
        "Check whether it runs through breaks, shift changes and setups. Every idle minute there is lost output for the whole line."
      ],
      svc: "/services.html#bottleneck", svcName: "Throughput, capacity and bottleneck analysis"
    }
  };
  var ORDER = ["std", "know", "meas", "flow"];
  var TOTAL = 12;

  function band(score) {
    if (score >= 90) return "Capable: a process you can scale or automate";
    if (score >= 70) return "Controlled: stable, with specific gaps";
    if (score >= 40) return "Stabilizing: some control, a lot of variation";
    return "Firefighting: results depend on who is working";
  }

  function read() {
    var res = { answered: 0, areas: {} };
    ORDER.forEach(function (k) {
      var fs = form.querySelector('[data-area="' + k + '"]');
      var qs = fs.querySelectorAll(".q"), sum = 0, n = 0;
      qs.forEach(function (q) {
        var c = q.querySelector("input:checked");
        if (c) { sum += Number(c.value); n++; }
      });
      res.answered += n;
      res.areas[k] = { sum: sum, n: n, max: qs.length * 3, pct: n ? Math.round((sum / (qs.length * 3)) * 100) : null };
    });
    var s = 0, m = 0;
    ORDER.forEach(function (k) { s += res.areas[k].sum; m += res.areas[k].max; });
    res.score = Math.round((s / m) * 100);
    return res;
  }

  function weakest(r) {
    var w = ORDER[0];
    ORDER.forEach(function (k) { if (r.areas[k].pct < r.areas[w].pct) w = k; });
    return w;
  }

  function summary(r, w) {
    var lines = ["Process stability self-assessment (acmss.ca/tools/stability-assessment.html)",
      "Overall: " + r.score + "/100, " + band(r.score).split(":")[0]];
    ORDER.forEach(function (k) { lines.push(AREAS[k].name + ": " + r.areas[k].pct + "/100"); });
    lines.push("Weakest area: " + AREAS[w].name);
    return lines.join("\n");
  }

  var resultEl = $("[data-assess-result]"), shown = false;

  function update(e) {
    var r = read();
    $("[data-a=progress]").textContent = r.answered + " of " + TOTAL + " answered";
    var done = r.answered === TOTAL;
    $("[data-a=score]").textContent = done ? r.score : "–";
    $("[data-a=band]").textContent = done ? band(r.score) : "Answer all twelve to see your score";
    var w = done ? weakest(r) : null;
    ORDER.forEach(function (k) {
      var row = root.querySelector('[data-bar="' + k + '"]'), a = r.areas[k];
      var complete = a.n === a.max / 3;
      row.querySelector("[data-v]").textContent = complete ? a.pct : "–";
      row.querySelector("i").style.width = (complete ? a.pct : 0) + "%";
      row.classList.toggle("is-weak", k === w);
    });
    if (!done) { resultEl.hidden = true; return; }

    var A = AREAS[w];
    $("[data-a=weak-name]").textContent = A.lower;
    $("[data-a=weak-why]").textContent = A.why;
    $("[data-a=rec-title]").textContent = A.title;
    var ol = $("[data-a=rec-steps]"); ol.innerHTML = "";
    A.steps.forEach(function (t, i) {
      var li = document.createElement("li");
      if (A.tool && i === 2) {
        var parts = t.split("free capability calculator");
        li.appendChild(document.createTextNode(parts[0]));
        var a = document.createElement("a"); a.href = A.tool; a.textContent = "free capability calculator"; li.appendChild(a);
        li.appendChild(document.createTextNode(parts[1]));
      } else li.textContent = t;
      ol.appendChild(li);
    });
    $("[data-a=svc]").href = A.svc;
    $("[data-a=send]").href = "/contact.html?message=" + encodeURIComponent("I took the stability self-assessment.\n\n" + summary(r, w) + "\n\nWhat I'd like help with:");
    resultEl.hidden = false;
    if (!shown && e) {
      shown = true;
      setTimeout(function () { resultEl.scrollIntoView({ behavior: "smooth", block: "start" }); }, 250);
    }
  }

  form.addEventListener("change", update);
  $("[data-a=print]").addEventListener("click", function () { window.print(); });
  update();
})();
