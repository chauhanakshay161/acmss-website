/* AC Manufacturing Solutions: drawing plates.
   Each page header carries a small engineering drawing of an imaginary part,
   drawn line by line as the page opens. Pure SVG, no images. */
(function () {
  "use strict";
  var plates = document.querySelectorAll("[data-plate]");
  if (!plates.length) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var W = 560, H = 420;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  // Centre lines keep their dash-dot pattern, so they fade in instead of being drawn
  function pl(cls) { return /pl-center/.test(cls || "") ? "" : ' pathLength="1"'; }
  function line(x1, y1, x2, y2, cls) { return '<path class="' + (cls || "pl-thin") + '"' + pl(cls) + ' d="M' + x1 + " " + y1 + "L" + x2 + " " + y2 + '"/>'; }
  function path(d, cls) { return '<path class="' + (cls || "pl-line") + '" pathLength="1" d="' + d + '"/>'; }
  function circle(cx, cy, r, cls) { return '<circle class="' + (cls || "pl-line") + '"' + pl(cls) + ' cx="' + cx + '" cy="' + cy + '" r="' + r + '"/>'; }
  function text(x, y, s, cls, anchor, rot) {
    return '<text class="' + (cls || "pl-text") + '" x="' + x + '" y="' + y + '" text-anchor="' + (anchor || "middle") + '"' +
      (rot ? ' transform="rotate(' + rot + " " + x + " " + y + ')"' : "") + ">" + esc(s) + "</text>";
  }
  function arrow(x, y, dx, dy) {
    // filled arrowhead pointing along (dx, dy)
    var L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, s = 8, w = 2.6;
    var bx = x - ux * s, by = y - uy * s;
    return '<path class="pl-arrow" d="M' + x + " " + y + "L" + (bx - uy * w) + " " + (by + ux * w) + "L" + (bx + uy * w) + " " + (by - ux * w) + 'Z"/>';
  }
  // Horizontal dimension between x1 and x2 at height y, extension lines from yFrom
  function dimH(x1, x2, y, yFrom, label, cls) {
    var g = line(x1, yFrom, x1, y + (y > yFrom ? 6 : -6)) + line(x2, yFrom, x2, y + (y > yFrom ? 6 : -6));
    g += line(x1, y, x2, y, cls) + arrow(x1, y, -1, 0) + arrow(x2, y, 1, 0);
    return g + text((x1 + x2) / 2, y - 6, label, cls === "pl-accent" ? "pl-text pl-text-accent" : "pl-text");
  }
  function dimV(y1, y2, x, xFrom, label, cls) {
    var g = line(xFrom, y1, x + (x > xFrom ? 6 : -6), y1) + line(xFrom, y2, x + (x > xFrom ? 6 : -6), y2);
    g += line(x, y1, x, y2, cls) + arrow(x, y1, 0, -1) + arrow(x, y2, 0, 1);
    return g + text(x - 7, (y1 + y2) / 2, label, cls === "pl-accent" ? "pl-text pl-text-accent" : "pl-text", "middle", -90);
  }
  function leader(x1, y1, x2, y2, label, accent) {
    var dir = x2 >= x1 ? 1 : -1, x3 = x2 + dir * 26;
    return line(x1, y1, x2, y2, accent ? "pl-accent" : "pl-thin") + line(x2, y2, x3, y2, accent ? "pl-accent" : "pl-thin") +
      '<circle class="pl-dot' + (accent ? " pl-dot-accent" : "") + '" cx="' + x1 + '" cy="' + y1 + '" r="2.4"/>' +
      text(x3 + dir * 5, y2 + 4, label, "pl-text" + (accent ? " pl-text-accent" : ""), dir > 0 ? "start" : "end");
  }
  // Feature control frame: symbol cell + text cells
  function fcf(x, y, sym, cells) {
    var h = 22, cw = [26].concat(cells.map(function (c) { return Math.max(24, c.length * 7.4 + 14); }));
    var g = "", cx = x;
    cw.forEach(function (w, i) {
      g += '<rect class="pl-accent" pathLength="1" x="' + cx + '" y="' + y + '" width="' + w + '" height="' + h + '"/>';
      if (i === 0) g += symbol(cx + w / 2, y + h / 2, sym);
      else g += text(cx + w / 2, y + 15, cells[i - 1], "pl-text pl-text-accent");
      cx += w;
    });
    return g;
  }
  function symbol(cx, cy, s) {
    if (s === "position") return '<circle class="pl-accent" pathLength="1" cx="' + cx + '" cy="' + cy + '" r="5.5"/>' + line(cx - 8, cy, cx + 8, cy, "pl-accent") + line(cx, cy - 8, cx, cy + 8, "pl-accent");
    if (s === "runout") return line(cx - 6, cy + 6, cx + 6, cy - 6, "pl-accent") + arrow(cx + 6, cy - 6, 1, -1).replace("pl-arrow", "pl-arrow pl-arrow-accent");
    if (s === "flatness") return '<path class="pl-accent" pathLength="1" d="M' + (cx - 7) + " " + (cy + 4) + "L" + (cx - 3) + " " + (cy - 4) + "L" + (cx + 7) + " " + (cy - 4) + "L" + (cx + 3) + " " + (cy + 4) + 'Z"/>';
    return "";
  }
  function datum(x, y, letter, dir) {
    // datum feature symbol: filled triangle on the surface, box with letter
    var g = "", s = 7;
    if (dir === "down") {
      g += '<path class="pl-datum" d="M' + (x - s) + " " + y + "L" + (x + s) + " " + y + "L" + x + " " + (y + s * 1.2) + 'Z"/>';
      g += line(x, y + s * 1.2, x, y + 26) + '<rect class="pl-thin" pathLength="1" x="' + (x - 11) + '" y="' + (y + 26) + '" width="22" height="22"/>' + text(x, y + 42, letter, "pl-text pl-text-strong");
    } else {
      g += '<path class="pl-datum" d="M' + x + " " + (y - s) + "L" + x + " " + (y + s) + "L" + (x - s * 1.2) + " " + y + 'Z"/>';
      g += line(x - s * 1.2, y, x - 26, y) + '<rect class="pl-thin" pathLength="1" x="' + (x - 48) + '" y="' + (y - 11) + '" width="22" height="22"/>' + text(x - 37, y + 5, letter, "pl-text pl-text-strong");
    }
    return g;
  }
  function center(x1, y1, x2, y2) { return line(x1, y1, x2, y2, "pl-center"); }

  var PARTS = {
    flange: function () {
      var cx = 230, cy = 186, R = 112, r = 36, bc = 78, g = "";
      g += center(cx - R - 22, cy, cx + R + 22, cy) + center(cx, cy - R - 22, cx, cy + R + 22);
      g += circle(cx, cy, R) + circle(cx, cy, R - 10, "pl-thin") + circle(cx, cy, r, "pl-line pl-line-accent") + circle(cx, cy, bc, "pl-center");
      for (var i = 0; i < 6; i++) { var a = (i * Math.PI) / 3 + Math.PI / 6; g += circle((cx + bc * Math.cos(a)).toFixed(1), (cy + bc * Math.sin(a)).toFixed(1), 9); }
      var hx = (cx + bc * Math.cos(-Math.PI / 6)).toFixed(1), hy = (cy + bc * Math.sin(-Math.PI / 6)).toFixed(1);
      g += leader(+hx + 6, +hy - 6, 400, 66, "6× Ø18 EQ SP");
      g += fcf(372, 76, "position", ["Ø0.10", "A", "B"]);
      g += leader(cx + 25, cy + 26, 392, 236, "Ø72.000 +0.030", true);
      g += dimH(cx - R, cx + R, cy + R + 34, cy + 10, "Ø224");
      return g;
    },
    shaft: function () {
      var y = 182, g = "", x = 64;
      var segs = [[84, 64, "Ø30 h6"], [142, 104, "Ø50"], [96, 76, "Ø36 h6"], [62, 50, "Ø24"]];
      g += center(x - 18, y, x + 400, y);
      var xs = [x];
      segs.forEach(function (s) {
        var x2 = x + s[0], h = s[1] / 2;
        g += path("M" + x + " " + (y - h) + "L" + x2 + " " + (y - h) + "M" + x + " " + (y + h) + "L" + x2 + " " + (y + h));
        x = x2; xs.push(x);
      });
      // vertical edges between steps
      for (var i = 0; i < xs.length; i++) {
        var hl = i > 0 ? segs[i - 1][1] / 2 : 0, hr = i < segs.length ? segs[i][1] / 2 : 0, h = Math.max(hl, hr);
        g += line(xs[i], y - h, xs[i], y + h, "pl-line");
      }
      g += dimV(y - 32, y + 32, 46, xs[0], "Ø30 h6");
      g += leader(xs[1] + 70, y - 52, 300, 70, "Ø50", false);
      g += fcf(300, 84, "runout", ["0.02", "A-B"]);
      g += line(342, 106, 342, y - 52, "pl-accent") + arrow(342, y - 52, 0, 1).replace("pl-arrow", "pl-arrow pl-arrow-accent");
      g += dimH(xs[0], xs[4], y + 104, y + 52, "384 ±0.1");
      g += dimH(xs[1], xs[2], y + 76, y + 52, "142");
      g += datum(xs[0] + 42, y + 32, "A", "down") + datum(xs[2] + 48, y + 38, "B", "down");
      return g;
    },
    block: function () {
      var x0 = 96, y0 = 96, w = 300, h = 172, g = "";
      g += path("M" + x0 + " " + y0 + "H" + (x0 + w) + "V" + (y0 + h) + "H" + x0 + "Z");
      g += path("M" + (x0 + 14) + " " + y0 + "V" + (y0 + 10) + "H" + x0, "pl-thin");
      var holes = [[x0 + 80, y0 + 56], [x0 + 220, y0 + 56], [x0 + 150, y0 + 122]];
      holes.forEach(function (p, i) {
        g += circle(p[0], p[1], 16, i === 2 ? "pl-line pl-line-accent" : "pl-line");
        g += center(p[0] - 26, p[1], p[0] + 26, p[1]) + center(p[0], p[1] - 26, p[0], p[1] + 26);
      });
      g += datum(x0 + 52, y0 + h, "A", "down") + datum(x0, y0 + h / 2 + 30, "B", "left");
      g += dimH(x0, holes[0][0], y0 - 30, y0, "80");
      g += dimH(x0, holes[1][0], y0 - 54, y0, "220");
      g += dimV(holes[2][1], y0 + h, x0 + w + 34, x0 + w, "56");
      g += leader(holes[2][0] + 12, holes[2][1] + 11, 290, y0 + h + 30, "Ø32.00 ±0.02", true);
      g += fcf(x0 + w - 44, y0 + h + 42, "position", ["Ø0.05", "A", "B"]);
      g += symbol(x0 + w + 40, y0 + 24, "flatness").replace(/pl-accent/g, "pl-thin");
      return g;
    }
  };

  function build(el) {
    var kind = el.getAttribute("data-plate"), make = PARTS[kind] || PARTS.block;
    var title = el.getAttribute("data-title") || "", dwg = el.getAttribute("data-dwg") || "ACMS-000", note = el.getAttribute("data-note") || "";
    var g = "";
    // sheet frame and zones
    g += '<rect class="pl-frame" pathLength="1" x="8" y="8" width="' + (W - 16) + '" height="' + (H - 16) + '"/>';
    for (var i = 1; i < 6; i++) g += line(8 + i * (W - 16) / 6, 8, 8 + i * (W - 16) / 6, 16, "pl-frame");
    for (var j = 1; j < 4; j++) g += line(8, 8 + j * (H - 16) / 4, 16, 8 + j * (H - 16) / 4, "pl-frame");
    g += '<g class="pl-part">' + make() + "</g>";
    // title block
    var tx = W - 288, ty = H - 66;
    g += '<g class="pl-tb">' +
      '<rect class="pl-frame" pathLength="1" x="' + tx + '" y="' + ty + '" width="280" height="58"/>' +
      line(tx, ty + 30, tx + 280, ty + 30, "pl-frame") + line(tx + 178, ty + 30, tx + 178, ty + 58, "pl-frame") +
      text(tx + 10, ty + 20, title, "pl-tb-title", "start") +
      text(tx + 10, ty + 48, note, "pl-tb-note", "start") +
      text(tx + 188, ty + 48, dwg, "pl-tb-note", "start") +
      "</g>";
    el.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc("Engineering drawing: " + title) + '" focusable="false">' + g + "</svg>";
    var strokes = el.querySelectorAll("path, circle, rect");
    strokes.forEach(function (s) { if (s.hasAttribute("pathLength")) s.classList.add("pd"); });
    if (reduce) { el.classList.add("is-drawn"); return; }
    // stagger: each stroke starts a little after the previous one
    el.querySelectorAll(".pd").forEach(function (s, k) { s.style.transitionDelay = Math.min(k * 22, 1400) + "ms"; });
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add("is-drawn"); }); });
  }
  plates.forEach(build);
})();
