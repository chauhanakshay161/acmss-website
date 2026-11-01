/* AC Manufacturing Solutions: site behaviour */
(function () {
  "use strict";

  var doc = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var page = document.body.getAttribute("data-page") || "";

  /* ---------- Current page in navigation ---------- */
  document.querySelectorAll("[data-nav]").forEach(function (a) {
    if (a.getAttribute("data-nav") === page) a.setAttribute("aria-current", "page");
  });

  /* ---------- Year ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ---------- Header border on scroll ---------- */
  var header = document.querySelector("[data-header]");
  var vernier = document.querySelector("[data-vernier]");
  var onScroll = function () {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);
    if (vernier) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      vernier.style.setProperty("--p", max > 0 ? Math.min(1, window.scrollY / max).toFixed(4) : 0);
    }
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  /* ---------- Mobile menu ---------- */
  var menuBtn = document.querySelector("[data-menu-btn]");
  var menu = document.querySelector("[data-menu]");
  if (menuBtn && menu) {
    var setMenu = function (open) {
      menuBtn.setAttribute("aria-expanded", String(open));
      menuBtn.querySelector(".menu-label").textContent = open ? "Close" : "Menu";
      menu.hidden = !open;
      menu.classList.toggle("is-open", open);
      document.body.style.overflow = open ? "hidden" : "";
      if (open) { var first = menu.querySelector("a"); if (first) first.focus(); }
    };
    menuBtn.addEventListener("click", function () {
      setMenu(menuBtn.getAttribute("aria-expanded") !== "true");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menuBtn.getAttribute("aria-expanded") === "true") {
        setMenu(false);
        menuBtn.focus();
      }
    });
    window.matchMedia("(min-width: 1081px)").addEventListener("change", function (m) {
      if (m.matches) setMenu(false);
    });
  }

  /* ---------- Process steps: fill the track when reached ---------- */
  var steps = document.querySelector("[data-steps]");
  if (steps) {
    if (reduceMotion || !("IntersectionObserver" in window)) {
      steps.classList.add("is-in");
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { steps.classList.add("is-in"); io.disconnect(); }
        });
      }, { threshold: 0.45 });
      io.observe(steps);
    }
  }

  /* ---------- Services: highlight the section in view ---------- */
  var svcLinks = document.querySelectorAll("[data-svc-nav] a");
  if (svcLinks.length) {
    var targets = Array.prototype.map.call(svcLinks, function (a) {
      return document.getElementById(a.getAttribute("href").slice(1));
    });
    var ticking = false;
    var spy = function () {
      ticking = false;
      var line = window.innerHeight * 0.35, current = 0;
      targets.forEach(function (t, i) { if (t && t.getBoundingClientRect().top < line) current = i; });
      svcLinks.forEach(function (a, i) { a.classList.toggle("is-active", i === current); });
    };
    spy();
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(spy); }
    }, { passive: true });
  }

  /* ---------- Contact form ---------- */
  var form = document.querySelector("[data-form]");
  if (form) {
    form.setAttribute("novalidate", "");
    // Prefill the message when arriving from one of the free tools
    try {
      var pre = new URLSearchParams(window.location.search).get("message");
      var msgEl = form.querySelector("#message");
      if (pre && msgEl && !msgEl.value) msgEl.value = pre.slice(0, 2000) + "\n";
    } catch (err) {}
    var check = function (field) {
      var input = field.querySelector("input, textarea");
      var ok = input.checkValidity();
      field.classList.toggle("has-error", !ok);
      input.setAttribute("aria-invalid", String(!ok));
      return ok;
    };
    var fields = form.querySelectorAll(".field[data-required]");
    fields.forEach(function (f) {
      var input = f.querySelector("input, textarea");
      input.addEventListener("blur", function () { if (input.value) check(f); });
      input.addEventListener("input", function () { if (f.classList.contains("has-error")) check(f); });
    });
    form.addEventListener("submit", function (e) {
      var firstBad = null;
      fields.forEach(function (f) { if (!check(f) && !firstBad) firstBad = f; });
      if (firstBad) {
        e.preventDefault();
        firstBad.querySelector("input, textarea").focus();
        return;
      }
      var btn = form.querySelector("button[type=submit]");
      btn.setAttribute("aria-busy", "true");
      btn.textContent = "Sending message";
    });
  }

  /* ---------- Capability hero: a process stabilizing as you scroll ---------- */
  var cap = document.querySelector("[data-capability]");
  if (cap) capability(cap);

  function capability(section) {
    var stage = section.querySelector("[data-stage]");
    var canvas = section.querySelector("[data-canvas]");
    var ctx = canvas.getContext("2d");
    var elCpk = section.querySelector("[data-cpk]");
    var elStatus = section.querySelector("[data-status]");
    var elSpread = section.querySelector("[data-spread]");
    var elOut = section.querySelector("[data-out]");
    var captions = section.querySelectorAll("[data-caption]");
    var still = doc.classList.contains("no-scrolly");

    // Bore Ø25.000 ±0.020 mm. Start: drifting, wide. End: centred, tight.
    var NOM = 0, TOL = 0.020;
    var S0 = 0.0125, S1 = 0.004, M0 = 0.006, M1 = 0;
    var RANGE = 0.05;

    // Seeded normal deviates so the picture is the same on every visit
    var seed = 7;
    var rnd = function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    var gauss = function () { var u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

    var N, z, phase, px, py, vx, born, W, H, dpr, plot, bw, bins, narrow;
    var setup = function () {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = stage.clientWidth; H = stage.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      narrow = W < 900;
      plot = narrow
        ? { x0: W * 0.06, x1: W * 0.94, base: H * 0.57, top: H * 0.25 }
        : { x0: W * 0.44, x1: W * 0.95, base: H * 0.80, top: H * 0.30 };
      var count = narrow ? 380 : 560;
      bw = narrow ? 0.0014 : 0.001;
      bins = Math.round((2 * RANGE) / bw);
      if (N !== count) {
        N = count; seed = 7;
        z = []; phase = []; px = []; py = []; vx = []; born = [];
        for (var i = 0; i < N; i++) { z.push(gauss()); phase.push(rnd() * Math.PI * 2); px.push(null); py.push(-20 - rnd() * H * 0.6); born.push(rnd() * 0.9); }
      }
    };

    var X = function (v) { return plot.x0 + ((v + RANGE) / (2 * RANGE)) * (plot.x1 - plot.x0); };
    var ease = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
    var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
    var erf = function (x) { var t = 1 / (1 + 0.3275911 * Math.abs(x)); var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
    var Phi = function (x) { return 0.5 * (1 + erf(x / Math.SQRT2)); };

    var progress = function () {
      if (still) return 1;
      var r = section.getBoundingClientRect();
      var span = section.offsetHeight - window.innerHeight;
      return span > 0 ? clamp(-r.top / span, 0, 1) : 1;
    };

    var lastPhase = "";
    var setPhase = function (p) {
      var name = p < 0.06 ? "intro" : p < 0.38 ? "0" : p < 0.7 ? "1" : "2";
      if (still) name = "2";
      if (name === lastPhase) return;
      lastPhase = name;
      stage.setAttribute("data-phase", name);
      captions.forEach(function (c) { c.classList.toggle("is-on", c.getAttribute("data-caption") === name); });
    };

    var fmt = function (n, d) { return n.toFixed(d); };
    var lastShown = "";
    var readout = function (mu, sg) {
      var cpk = Math.min(TOL - mu, mu + TOL) / (3 * sg);
      var out = (Phi((-TOL - mu) / sg) + (1 - Phi((TOL - mu) / sg))) * 1000;
      var key = fmt(cpk, 2);
      if (key === lastShown) return;
      lastShown = key;
      elCpk.textContent = key;
      elSpread.textContent = fmt(6 * sg, 3) + " mm";
      elOut.textContent = out >= 10 ? Math.round(out) + " per 1,000" : out >= 0.1 ? fmt(out, 1) + " per 1,000" : "Under 1 per 10,000";
      var label = cpk >= 1.33 ? "Capable" : cpk >= 1 ? "Marginal" : "Not capable";
      elStatus.querySelector("span").textContent = label;
      elStatus.classList.toggle("is-capable", cpk >= 1.33);
    };

    var t0 = performance.now();
    var running = false, visible = true;

    var frame = function (now) {
      running = false;
      if (!visible) return;
      var p = progress();
      setPhase(p);
      var s = ease(clamp((p - 0.08) / 0.74, 0, 1));
      // On phones the chart starts low, under the headline, then rises into place
      var lift = narrow && !still ? ease(clamp(p / 0.1, 0, 1)) : 1;
      var base = narrow ? H * (0.9 - 0.33 * lift) : plot.base;
      var top = narrow ? H * (0.62 - 0.37 * lift) : plot.top;
      plot = { x0: plot.x0, x1: plot.x1, base: base, top: top };
      var t = (now - t0) / 1000;
      var wobble = (1 - s) * 0.0035 * Math.sin(t * 0.9);
      var mu = M0 + (M1 - M0) * s + wobble;
      var sg = S0 + (S1 - S0) * s;
      readout(M0 + (M1 - M0) * s, sg);

      // Stack each reading in its bin so the histogram builds itself
      var counts = new Array(bins).fill(0), target = new Array(N), maxStack = 0, bi = new Array(N);
      for (var i = 0; i < N; i++) {
        var v = mu + sg * z[i] + (1 - s) * 0.0018 * Math.sin(t * 1.7 + phase[i]);
        var b = clamp(Math.floor((v + RANGE) / bw), 0, bins - 1);
        bi[i] = b; target[i] = counts[b]++; if (counts[b] > maxStack) maxStack = counts[b];
      }
      var colW = (plot.x1 - plot.x0) / bins;
      var step = Math.min(colW, (plot.base - plot.top) / Math.max(18, maxStack + 2), 6.5);
      var r = Math.max(1.2, Math.min(colW, step) * 0.36);

      ctx.clearRect(0, 0, W, H);

      // Tolerance zone and limits
      var xl = X(NOM - TOL), xu = X(NOM + TOL), xn = X(NOM);
      var grad = ctx.createLinearGradient(0, plot.top - 40, 0, plot.base);
      grad.addColorStop(0, "rgba(180,190,202,0)"); grad.addColorStop(1, "rgba(180,190,202,.07)");
      ctx.fillStyle = grad; ctx.fillRect(xl, plot.top - 40, xu - xl, plot.base - plot.top + 40);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(180,190,202,.32)"; ctx.setLineDash([3, 5]);
      [xl, xu].forEach(function (x) { ctx.beginPath(); ctx.moveTo(x + .5, plot.top - 40); ctx.lineTo(x + .5, plot.base); ctx.stroke(); });
      ctx.strokeStyle = "rgba(180,190,202,.16)";
      ctx.beginPath(); ctx.moveTo(xn + .5, plot.top - 40); ctx.lineTo(xn + .5, plot.base); ctx.stroke();
      ctx.setLineDash([]);

      // Baseline with ruler ticks
      ctx.strokeStyle = "rgba(180,190,202,.38)";
      ctx.beginPath(); ctx.moveTo(plot.x0, plot.base + .5); ctx.lineTo(plot.x1, plot.base + .5); ctx.stroke();
      for (var k = -50; k <= 50; k++) {
        var tx = X(k / 1000), major = k % 10 === 0, mid = k % 5 === 0;
        ctx.strokeStyle = major ? "rgba(180,190,202,.5)" : "rgba(180,190,202,.2)";
        ctx.beginPath(); ctx.moveTo(tx + .5, plot.base + 1); ctx.lineTo(tx + .5, plot.base + (major ? 10 : mid ? 6 : 3.5)); ctx.stroke();
      }

      // Labels
      ctx.font = "500 12px Archivo, system-ui, sans-serif";
      ctx.fillStyle = "rgba(133,146,161,1)";
      ctx.textAlign = "center";
      ctx.fillText("24.980", xl, plot.base + 28); ctx.fillText("25.000", xn, plot.base + 28); ctx.fillText("25.020", xu, plot.base + 28);
      ctx.fillStyle = "rgba(180,190,202,.9)";
      ctx.fillText("LSL", xl, plot.top - 50); ctx.fillText("USL", xu, plot.top - 50);

      // Readings
      for (var j = 0; j < N; j++) {
        var cx = plot.x0 + (bi[j] + 0.5) * colW;
        var cy = plot.base - 4 - (target[j] + 0.5) * step;
        var delay = born[j] * 0.9;
        var life = clamp((t - delay) / 1.1, 0, 1);
        if (px[j] === null) px[j] = cx;
        var k2 = life < 1 ? 0.08 : 0.16;
        px[j] += (cx - px[j]) * k2;
        py[j] += (cy - py[j]) * (life > 0 ? k2 : 0);
        var vv = (bi[j] + 0.5) * bw - RANGE;
        var outside = vv < -TOL || vv > TOL;
        ctx.globalAlpha = life;
        ctx.fillStyle = outside ? "#E8661C" : "#EDF0F4";
        ctx.beginPath(); ctx.arc(px[j], py[j], r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Fitted curve
      ctx.strokeStyle = "rgba(237,240,244,.55)"; ctx.lineWidth = 1.25;
      ctx.beginPath();
      for (var q = 0; q <= 240; q++) {
        var xv = -RANGE + (q / 240) * 2 * RANGE;
        var pdf = Math.exp(-0.5 * Math.pow((xv - mu) / sg, 2)) / (sg * Math.sqrt(2 * Math.PI));
        var yy = plot.base - 4 - N * bw * pdf * step;
        if (q === 0) ctx.moveTo(X(xv), yy); else ctx.lineTo(X(xv), yy);
      }
      ctx.stroke();

      // Mean marker
      ctx.fillStyle = "#E8661C";
      var xm = X(mu);
      ctx.beginPath(); ctx.moveTo(xm, plot.base - 2); ctx.lineTo(xm - 5, plot.base + 7); ctx.lineTo(xm + 5, plot.base + 7); ctx.closePath(); ctx.fill();

      if (!still) schedule();
    };

    var schedule = function () { if (!running) { running = true; requestAnimationFrame(frame); } };

    setup();
    if (still) { t0 = performance.now() - 10000; for (var w = 0; w < 60; w++) frame(performance.now()); return; }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) schedule(); }).observe(stage);
    }
    window.addEventListener("resize", function () { setup(); schedule(); });
    schedule();
  }
})();
