(() => {
  "use strict";

  /* ---------- Globe ---------- */
  const canvas = document.getElementById("globe");
  const ctx = canvas.getContext("2d");
  const readout = document.getElementById("readout-lon");
  const css = getComputedStyle(document.documentElement);
  const C = {
    sea: css.getPropertyValue("--sea").trim(),
    grid: css.getPropertyValue("--grid").trim(),
    land: css.getPropertyValue("--land").trim(),
    signal: css.getPropertyValue("--signal").trim(),
    home: css.getPropertyValue("--home").trim(),
  };
  const RAD = Math.PI / 180;
  const LAT0 = 30;           // fixed tilt
  const LON_START = 93.8;    // where the globe faces (static, no spin)

  // Example markers, not data. Three sit on other continents on purpose. [lat, lon]; the first one is the current settlement.
  const SETTLEMENTS = [[51, 19], [47, 2], [60, 30], [-10, -55], [0, 23], [-25, 134]];

  let W = 0, H = 0, R = 0, cx = 0, cy = 0;
  const lon0 = LON_START;
  let sinLat0 = Math.sin(LAT0 * RAD), cosLat0 = Math.cos(LAT0 * RAD);

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    R = Math.max(H, 520) * 0.47;
    cx = W / 2; cy = H / 2;
    draw();
  }

  // Orthographic projection. Returns [x, y, visible]; hidden points can be pushed onto the rim.
  function project(lat, lon, toRim) {
    const la = lat * RAD, dl = (lon - lon0) * RAD;
    const cosLa = Math.cos(la), sinLa = Math.sin(la), cosDl = Math.cos(dl);
    const visible = sinLat0 * sinLa + cosLat0 * cosLa * cosDl >= 0;
    let x = R * cosLa * Math.sin(dl);
    let y = R * (cosLat0 * sinLa - sinLat0 * cosLa * cosDl);
    if (!visible && toRim) { const n = Math.hypot(x, y) || 1; x = x / n * R; y = y / n * R; }
    return [cx + x, cy - y, visible];
  }

  // View-space unit vector: x right, y up, z towards the viewer (z < 0 is behind the globe).
  function view(lat, lon) {
    const la = lat * RAD, dl = (lon - lon0) * RAD;
    const cosLa = Math.cos(la), sinLa = Math.sin(la), cosDl = Math.cos(dl);
    return [cosLa * Math.sin(dl), cosLat0 * sinLa - sinLat0 * cosLa * cosDl, sinLat0 * sinLa + cosLat0 * cosLa * cosDl];
  }
  // Point where the edge a -> b crosses the horizon, as a canvas angle on the rim.
  function horizonAngle(a, b) {
    const t = a[2] / (a[2] - b[2]);
    const x = a[0] + t * (b[0] - a[0]), y = a[1] + t * (b[1] - a[1]);
    return Math.atan2(-y, x);
  }
  const TAU = Math.PI * 2;

  // Adds one land ring to the current path, clipped to the visible hemisphere.
  // Hidden stretches are replaced by arcs along the rim (rings are counter-clockwise, land on the left).
  function traceRing(ring) {
    const n = ring.length / 2, P = new Array(n);
    let hidden = -1;
    for (let i = 0; i < n; i++) { P[i] = view(ring[2 * i + 1], ring[2 * i]); if (P[i][2] < 0 && hidden < 0) hidden = i; }
    const sx = p => cx + R * p[0], sy = p => cy - R * p[1];
    if (hidden < 0) {
      P.forEach((p, i) => (i ? ctx.lineTo(sx(p), sy(p)) : ctx.moveTo(sx(p), sy(p))));
      ctx.closePath(); return;
    }
    const segs = []; let cur = null;
    for (let k = 0; k < n; k++) {
      const a = P[(hidden + k) % n], b = P[(hidden + k + 1) % n];
      const av = a[2] >= 0, bv = b[2] >= 0;
      if (!av && bv) { cur = { entry: horizonAngle(a, b), pts: [b] }; }
      else if (av && bv) { cur.pts.push(b); }
      else if (av && !bv) { cur.exit = horizonAngle(a, b); segs.push(cur); cur = null; }
    }
    if (!segs.length) return;
    const used = new Array(segs.length).fill(false);
    for (let s0 = 0; s0 < segs.length; s0++) {
      if (used[s0]) continue;
      let s = s0;
      ctx.moveTo(cx + R * Math.cos(segs[s].entry), cy + R * Math.sin(segs[s].entry));
      for (;;) {
        used[s] = true;
        for (const p of segs[s].pts) ctx.lineTo(sx(p), sy(p));
        const ae = segs[s].exit;
        let best = -1, bestD = Infinity;
        for (let j = 0; j < segs.length; j++) {
          if (used[j] && j !== s0) continue;
          const d = ((ae - segs[j].entry) % TAU + TAU) % TAU;
          if (d < bestD) { bestD = d; best = j; }
        }
        ctx.arc(cx, cy, R, ae, ae - bestD, true);
        if (best === s0 || best < 0) { ctx.closePath(); break; }
        s = best;
      }
    }
  }

  function strokeLine(points) {
    let pen = false;
    ctx.beginPath();
    for (const [x, y, v] of points) {
      if (v) { pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true; } else pen = false;
    }
    ctx.stroke();
  }

  function greatCircle(a, b, n = 32) {
    const v = ([la, lo]) => [Math.cos(la * RAD) * Math.cos(lo * RAD), Math.cos(la * RAD) * Math.sin(lo * RAD), Math.sin(la * RAD)];
    const p = v(a), q = v(b);
    const d = Math.acos(Math.min(1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2]));
    const out = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n, A = Math.sin((1 - t) * d) / Math.sin(d), B = Math.sin(t * d) / Math.sin(d);
      const x = A * p[0] + B * q[0], y = A * p[1] + B * q[1], z = A * p[2] + B * q[2];
      out.push(project(Math.asin(z) / RAD, Math.atan2(y, x) / RAD));
    }
    return out;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // halo ring
    ctx.setLineDash([2, 5]);
    ctx.strokeStyle = C.grid; ctx.globalAlpha = 0.3; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R + 14, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;

    // ocean
    ctx.fillStyle = C.sea;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();

    // land
    ctx.fillStyle = C.land; ctx.strokeStyle = C.grid; ctx.lineWidth = 0.8; ctx.lineJoin = "round";
    ctx.beginPath();
    for (const ring of LAND) traceRing(ring);
    ctx.fill();
    ctx.globalAlpha = 0.7; ctx.stroke(); ctx.globalAlpha = 1;

    // graticule
    ctx.strokeStyle = C.grid; ctx.globalAlpha = 0.22; ctx.lineWidth = 0.7;
    for (let lat = -75; lat <= 75; lat += 15) {
      const pts = []; for (let l = -180; l <= 180; l += 4) pts.push(project(lat, l)); strokeLine(pts);
    }
    for (let lon = -180; lon < 180; lon += 15) {
      const pts = []; for (let l = -90; l <= 90; l += 4) pts.push(project(l, lon)); strokeLine(pts);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // rim
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();

    // supply lines
    const home = SETTLEMENTS[0];
    ctx.strokeStyle = C.signal; ctx.lineWidth = 1.6; ctx.setLineDash([6, 5]);
    for (let i = 1; i < SETTLEMENTS.length; i++) strokeLine(greatCircle(SETTLEMENTS[i], home));
    ctx.setLineDash([]);

    // settlements
    SETTLEMENTS.forEach((s, i) => {
      const [x, y, v] = project(s[0], s[1]);
      if (!v) return;
      const main = i === 0;
      ctx.fillStyle = main ? C.home : C.signal;
      ctx.beginPath(); ctx.arc(x, y, main ? 7 : 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = main ? C.home : C.signal; ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, main ? 15 : 10, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    });

    // readout
    const lonN = ((lon0 + 540) % 360) - 180;
    readout.textContent = `${Math.abs(lonN).toFixed(1)}° ${lonN >= 0 ? "E" : "W"}`;
  }

  window.addEventListener("resize", resize);
  resize();

  /* ---------- Board (GitHub Issues, logic in board.js) ---------- */
  const ISSUES_URL = "https://github.com/Dimi-GE/ifz-reclaim-the-world/issues";
  // ponytail: first 100 issues only; add Link-header paging past 100.
  const API_URL = "https://api.github.com/repos/Dimi-GE/ifz-reclaim-the-world/issues?state=all&per_page=100";

  const filter = { type: "all", status: "all" };
  const list = document.getElementById("issues");
  const empty = document.getElementById("issues-empty");
  let cards = [], loaded = false;

  function renderIssues() {
    if (!loaded) return;   // still loading or failed: keep that message
    const rows = cards.filter(c => boardMatch(c, filter));
    list.innerHTML = rows.map(boardHtml).join("");
    empty.hidden = rows.length > 0;
    empty.textContent = cards.length ? "Nothing matches these filters." : "Nothing on the board yet.";
  }

  document.querySelectorAll(".filters .seg").forEach(group => {
    group.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      group.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
      if (b.dataset.type) filter.type = b.dataset.type;
      if (b.dataset.status) filter.status = b.dataset.status;
      renderIssues();
    });
  });

  fetch(API_URL, { headers: { Accept: "application/vnd.github+json" } })
    .then(res => { if (!res.ok) throw new Error(res.status); return res.json(); })
    .then(json => { cards = json.map(boardCard).filter(Boolean); loaded = true; renderIssues(); })
    .catch(() => {
      empty.hidden = false;
      empty.innerHTML = `The board couldn't load. <a href="${ISSUES_URL}">See the issues on GitHub</a>`;
    });

  /* ---------- Feedback form (not connected yet) ---------- */
  const form = document.getElementById("fb");
  const versions = document.getElementById("version-fields");
  const err = document.getElementById("fb-error");
  const result = document.getElementById("fb-result");

  form.addEventListener("change", e => {
    if (e.target.name === "cat") versions.hidden = e.target.value !== "bug";
  });
  form.addEventListener("input", () => { err.hidden = true; });
  form.addEventListener("submit", e => {
    e.preventDefault();
    const title = document.getElementById("fb-title").value.trim();
    const body = document.getElementById("fb-body").value.trim();
    if (!title || !body) {
      err.textContent = !title ? "Add a short title first." : "Add a few details first.";
      err.hidden = false; result.hidden = true; return;
    }
    result.textContent = "Prototype: this form isn't connected yet. In the live version the report becomes a GitHub issue, and its number and link appear here.";
    result.hidden = false;
  });
})();
