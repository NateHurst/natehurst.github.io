// render.js — Canvas rendering. Requires math.js.
// All draw functions work on {x, y} screen coordinates (3D projection handled by caller).

// ─── Theme / Colors ───────────────────────────────────────────────────────────

var DARK = {
  bg:            '#161b22',
  grid:          'rgba(48,54,61,0.5)',
  curve:         '#00d2ff',
  curveGlow:     'rgba(0,210,255,0.18)',
  polygon:       'rgba(255,255,255,0.22)',
  polygonSpline: 'rgba(255,180,80,0.35)',
  point:         '#ff7b00',
  pointHover:    '#ffcc44',
  pointGlow:     'rgba(255,123,0,0.22)',
  pointBorder:   'rgba(255,255,255,0.85)',
  splineHandle:  '#aaa',
  handleLine:    'rgba(180,180,180,0.4)',
  casteljau:     ['#ff4455','#44ff88','#4488ff','#ff44ff','#ffbb33'],
  casteljauLine: ['rgba(255,68,85,0.65)','rgba(68,255,136,0.65)','rgba(68,136,255,0.65)','rgba(255,68,255,0.65)','rgba(255,187,51,0.65)'],
  finalPoint:    '#ffffff',
  tangent:       '#ffe033',
  label:         '#e6edf3',
  labelShadow:   '#000',
  axisX:         'rgba(255,80,80,0.85)',
  axisY:         'rgba(80,220,80,0.85)',
  axisZ:         'rgba(80,140,255,0.85)',
  axisTick:      'rgba(255,255,255,0.18)',
  inactiveCurve: 'rgba(140,140,180,0.55)',
  activeMark:    '#00d2ff',
};

var LIGHT = {
  bg:            '#f6f8fa',
  grid:          'rgba(0,0,0,0.07)',
  curve:         '#0969da',
  curveGlow:     'rgba(9,105,218,0.18)',
  polygon:       'rgba(0,0,0,0.2)',
  polygonSpline: 'rgba(200,100,0,0.35)',
  point:         '#d4620a',
  pointHover:    '#e08b2e',
  pointGlow:     'rgba(212,98,10,0.2)',
  pointBorder:   'rgba(0,0,0,0.5)',
  splineHandle:  '#777',
  handleLine:    'rgba(80,80,80,0.35)',
  casteljau:     ['#d73a49','#22863a','#005cc5','#6f42c1','#e36209'],
  casteljauLine: ['rgba(215,58,73,0.65)','rgba(34,134,58,0.65)','rgba(0,92,197,0.65)','rgba(111,66,193,0.65)','rgba(227,98,9,0.65)'],
  finalPoint:    '#24292e',
  tangent:       '#b08800',
  label:         '#24292e',
  labelShadow:   'rgba(255,255,255,0.8)',
  axisX:         'rgba(200,40,40,0.85)',
  axisY:         'rgba(30,160,30,0.85)',
  axisZ:         'rgba(30,80,200,0.85)',
  axisTick:      'rgba(0,0,0,0.12)',
  inactiveCurve: 'rgba(100,100,130,0.5)',
  activeMark:    '#0969da',
};

var C = Object.assign({}, DARK);

function setTheme(theme) {
  Object.assign(C, theme === 'light' ? LIGHT : DARK);
}

// ─── Grid / Axes ──────────────────────────────────────────────────────────────

function drawGrid(ctx, w, h) {
  ctx.save();
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 0.5;
  const sp = 50;
  ctx.beginPath();
  for (let x = 0; x < w; x += sp) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  for (let y = 0; y < h; y += sp) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.stroke();
  ctx.restore();
}

function drawAxes3D(ctx, cam, cx, cy, size) {
  size = size || 120;
  const origin = { x: 0, y: 0, z: 0 };
  const axes = [
    { end: { x: size, y: 0, z: 0 }, color: C.axisX, label: 'X' },
    { end: { x: 0, y: -size, z: 0 }, color: C.axisY, label: 'Y' },
    { end: { x: 0, y: 0, z: size }, color: C.axisZ, label: 'Z' },
  ];

  // Draw grid plane on XZ (y=0)
  ctx.save();
  ctx.strokeStyle = C.axisTick;
  ctx.lineWidth = 0.5;
  const step = 40, half = 3;
  for (let i = -half; i <= half; i++) {
    const a = project3D({ x: cx + i*step, y: cy, z: -half*step }, cam, cx, cy);
    const b = project3D({ x: cx + i*step, y: cy, z:  half*step }, cam, cx, cy);
    const c2 = project3D({ x: cx - half*step, y: cy, z: i*step }, cam, cx, cy);
    const d  = project3D({ x: cx + half*step, y: cy, z: i*step }, cam, cx, cy);
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c2.x,c2.y); ctx.lineTo(d.x,d.y); ctx.stroke();
  }
  ctx.restore();

  const o = project3D({ x: cx, y: cy, z: 0 }, cam, cx, cy);
  axes.forEach(ax => {
    const e = project3D({ x: cx + ax.end.x, y: cy + ax.end.y, z: ax.end.z }, cam, cx, cy);
    ctx.save();
    ctx.strokeStyle = ax.color;
    ctx.fillStyle   = ax.color;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(e.x, e.y); ctx.stroke();
    // Arrowhead
    const ang = Math.atan2(e.y - o.y, e.x - o.x);
    const al = 10;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(e.x - al*Math.cos(ang-0.4), e.y - al*Math.sin(ang-0.4));
    ctx.lineTo(e.x - al*Math.cos(ang+0.4), e.y - al*Math.sin(ang+0.4));
    ctx.closePath(); ctx.fill();
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ax.label, e.x + Math.cos(ang)*14, e.y + Math.sin(ang)*14);
    ctx.restore();
  });
}

// ─── Bezier Curve ─────────────────────────────────────────────────────────────

function drawBezierCurve(ctx, points, opts) {
  opts = opts || {};
  if (points.length < 2) return;
  const color = opts.color || C.curve;
  const width = opts.width || 2.5;
  const glow  = opts.glow !== false;
  const steps = opts.steps || 300;

  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  if (glow) {
    ctx.beginPath();
    ctx.strokeStyle = opts.glowColor || C.curveGlow;
    ctx.lineWidth = width + 12;
    _traceBezier(ctx, points, steps);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  _traceBezier(ctx, points, steps);
  ctx.stroke();
  ctx.restore();
}

function _traceBezier(ctx, pts, steps) {
  for (let i = 0; i <= steps; i++) {
    const p = evalBezier(pts, i / steps);
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
  }
}

// ─── Spline ───────────────────────────────────────────────────────────────────

function drawSplineCurve(ctx, segments, opts) {
  opts = opts || {};
  if (!segments.length) return;
  const color = opts.color || C.curve;
  const width = opts.width || 2.5;
  const glow  = opts.glow !== false;
  const steps = opts.steps || 100;

  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  const tracePath = () => {
    let first = true;
    segments.forEach(seg => {
      for (let i = 0; i <= steps; i++) {
        const p = evalBezier(seg, i / steps);
        if (first && i === 0) { ctx.moveTo(p.x, p.y); first = false; }
        else ctx.lineTo(p.x, p.y);
      }
    });
  };

  if (glow) {
    ctx.beginPath();
    ctx.strokeStyle = opts.glowColor || C.curveGlow;
    ctx.lineWidth = width + 12;
    tracePath(); ctx.stroke();
  }
  ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = width;
  tracePath(); ctx.stroke();
  ctx.restore();
}

function drawSplineHandles(ctx, segments) {
  segments.forEach(seg => {
    ctx.save();
    ctx.strokeStyle = C.handleLine;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(seg[0].x, seg[0].y); ctx.lineTo(seg[1].x, seg[1].y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(seg[3].x, seg[3].y); ctx.lineTo(seg[2].x, seg[2].y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    [seg[1], seg[2]].forEach(p => {
      ctx.save();
      ctx.beginPath();
      ctx.fillStyle = C.splineHandle; ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke(); ctx.restore();
    });
  });
}

// ─── Control Polygon ──────────────────────────────────────────────────────────

function drawControlPolygon(ctx, points, opts) {
  opts = opts || {};
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = opts.spline ? C.polygonSpline : C.polygon;
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.stroke(); ctx.setLineDash([]); ctx.restore();
}

// ─── Control Points ───────────────────────────────────────────────────────────

function drawControlPoints(ctx, points, opts) {
  opts = opts || {};
  const hoverIdx  = opts.hoverIndex  !== undefined ? opts.hoverIndex  : -1;
  const selIdx    = opts.selectedIndex !== undefined ? opts.selectedIndex : -1;
  const showLabel = !!opts.showLabels;
  const prefix    = opts.prefix || 'P';
  const r         = opts.r || 8;

  points.forEach((p, i) => {
    const hover = i === hoverIdx;
    const sel   = i === selIdx;
    const fill  = sel ? '#ffe033' : hover ? C.pointHover : C.point;

    ctx.save();
    ctx.beginPath(); ctx.fillStyle = C.pointGlow;
    ctx.arc(p.x, p.y, r + 6, 0, Math.PI * 2); ctx.fill();

    ctx.beginPath();
    ctx.fillStyle   = fill;
    ctx.strokeStyle = C.pointBorder;
    ctx.lineWidth   = sel ? 2.5 : hover ? 2 : 1.5;
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke(); ctx.restore();

    if (showLabel) {
      ctx.save();
      ctx.font = 'bold 13px "Courier New", monospace';
      ctx.fillStyle    = C.label;
      ctx.shadowColor  = C.labelShadow;
      ctx.shadowBlur   = 4;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(prefix + i, p.x, p.y - r - 5);
      ctx.restore();
    }
  });
}

// ─── De Casteljau ─────────────────────────────────────────────────────────────

// pts: already-projected 2D screen points (or raw 2D).
// In 3D mode, pass pre-projected levels via projectedLevels option.
function drawDeCasteljau(ctx, pts, t, projectedLevels) {
  const levels = projectedLevels || deCasteljau(pts, t);

  for (let lvl = 1; lvl < levels.length; lvl++) {
    const lpts    = levels[lvl];
    const lineCol = C.casteljauLine[(lvl-1) % C.casteljauLine.length];
    const dotCol  = C.casteljau[(lvl-1) % C.casteljau.length];
    const isFinal = lvl === levels.length - 1;

    if (lpts.length >= 2) {
      ctx.save();
      ctx.strokeStyle = lineCol; ctx.lineWidth = 1.5;
      ctx.beginPath();
      lpts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.stroke(); ctx.restore();
    }

    lpts.forEach(p => {
      ctx.save();
      ctx.beginPath();
      ctx.fillStyle   = isFinal ? C.finalPoint : dotCol;
      ctx.strokeStyle = isFinal ? C.curve      : dotCol;
      ctx.lineWidth   = isFinal ? 2 : 1;
      ctx.arc(p.x, p.y, isFinal ? 8 : 5, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke(); ctx.restore();
    });
  }
}

function drawDeCasteljauLabels(ctx, pts, t, projectedLevels) {
  const levels  = projectedLevels || deCasteljau(pts, t);
  const letters = ['Q', 'R', 'S', 'T', 'U'];

  for (let lvl = 1; lvl < levels.length; lvl++) {
    const lpts    = levels[lvl];
    const dotCol  = C.casteljau[(lvl-1) % C.casteljau.length];
    const isFinal = lvl === levels.length - 1;
    const letter  = letters[lvl - 1] || 'X';

    lpts.forEach((p, i) => {
      const label = isFinal ? 'B(t)' : letter + i;
      ctx.save();
      ctx.font = isFinal ? 'bold 13px "Courier New",monospace' : '12px "Courier New",monospace';
      ctx.fillStyle    = isFinal ? C.finalPoint : dotCol;
      ctx.shadowColor  = C.labelShadow; ctx.shadowBlur = 4;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(label, p.x, p.y + (isFinal ? 10 : 8));
      ctx.restore();
    });
  }
}

// ─── Tangent ──────────────────────────────────────────────────────────────────

function drawTangent(ctx, points, t) {
  const pt  = evalBezier(points, t);
  const tan = bezierTangent(points, t);
  const mag = Math.sqrt(tan.x*tan.x + tan.y*tan.y);
  if (mag < 0.001) return;
  const len = 70;
  const nx = tan.x / mag * len, ny = tan.y / mag * len;
  const ex = pt.x + nx, ey = pt.y + ny;
  const ang = Math.atan2(ny, nx), al = 13;

  ctx.save();
  ctx.strokeStyle = C.tangent; ctx.fillStyle = C.tangent; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - al*Math.cos(ang-0.4), ey - al*Math.sin(ang-0.4));
  ctx.lineTo(ex - al*Math.cos(ang+0.4), ey - al*Math.sin(ang+0.4));
  ctx.closePath(); ctx.fill(); ctx.restore();
}

// ─── Bernstein Mini-Chart ─────────────────────────────────────────────────────

var _basisColors = ['#ff4455','#ff7b00','#44ff88','#4488ff','#ff44ff','#ffbb33'];

function drawBasisFunction(ctx, n, i, t) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  const pad = { t: 8, b: 8, l: 6, r: 6 };
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const col = _basisColors[i % _basisColors.length];
  const bg = (C === LIGHT) ? '#f0f2f4' : '#0d1117';

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.strokeStyle = (C === LIGHT) ? '#d0d7de' : '#30363d';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(pad.l, pad.t); ctx.lineTo(w-pad.r, pad.t);
  ctx.moveTo(pad.l, h-pad.b); ctx.lineTo(w-pad.r, h-pad.b);
  ctx.stroke(); ctx.restore();

  // Shaded area
  ctx.save();
  ctx.globalAlpha = 0.12; ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(pad.l, h-pad.b);
  for (let k = 0; k <= 100; k++) {
    const tv = k/100, bv = bernstein(n, i, tv);
    ctx.lineTo(pad.l + tv*iw, (h-pad.b) - bv*ih);
  }
  ctx.lineTo(w-pad.r, h-pad.b); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1; ctx.restore();

  // Curve
  ctx.save();
  ctx.strokeStyle = col; ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let k = 0; k <= 100; k++) {
    const tv = k/100, bv = bernstein(n, i, tv);
    const px = pad.l + tv*iw, py = (h-pad.b) - bv*ih;
    k === 0 ? ctx.moveTo(px,py) : ctx.lineTo(px,py);
  }
  ctx.stroke(); ctx.restore();

  // t marker
  const tx = pad.l + t*iw;
  ctx.save();
  ctx.strokeStyle = (C === LIGHT) ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1; ctx.setLineDash([2,3]);
  ctx.beginPath(); ctx.moveTo(tx, pad.t); ctx.lineTo(tx, h-pad.b); ctx.stroke();
  ctx.setLineDash([]); ctx.restore();

  // Value dot
  const bval = bernstein(n, i, t);
  const dotX = pad.l + t*iw, dotY = (h-pad.b) - bval*ih;
  ctx.save();
  ctx.beginPath(); ctx.fillStyle = col; ctx.strokeStyle = (C === LIGHT) ? '#000' : '#fff'; ctx.lineWidth = 1;
  ctx.arc(dotX, dotY, 3.5, 0, Math.PI*2); ctx.fill(); ctx.stroke(); ctx.restore();

  ctx.save();
  ctx.font = '10px "Courier New",monospace'; ctx.fillStyle = col;
  ctx.textAlign = 'right'; ctx.textBaseline = 'top';
  ctx.fillText(bval.toFixed(2), w-pad.r, pad.t+1); ctx.restore();
}

// ─── Track Style Rendering ────────────────────────────────────────────────────

function drawTrackStyle(ctx, segments) {
  if (!segments.length) return;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  function tracePath() {
    var first = true;
    segments.forEach(function(seg) {
      for (var i = 0; i <= 120; i++) {
        var p = evalBezier(seg, i / 120);
        if (first && i === 0) { ctx.moveTo(p.x, p.y); first = false; }
        else ctx.lineTo(p.x, p.y);
      }
    });
  }

  // Kerb border (light rim)
  ctx.beginPath(); ctx.strokeStyle = 'rgba(170,170,170,0.40)'; ctx.lineWidth = 56;
  tracePath(); ctx.stroke();
  // Asphalt surface
  ctx.beginPath(); ctx.strokeStyle = 'rgba(46,48,54,0.96)'; ctx.lineWidth = 48;
  tracePath(); ctx.stroke();
  // Faint centerline dashes
  ctx.beginPath(); ctx.strokeStyle = 'rgba(255,255,200,0.18)'; ctx.lineWidth = 1.5;
  ctx.setLineDash([28, 22]); tracePath(); ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();
}

// ─── Marker Trail ─────────────────────────────────────────────────────────────

// trail: [{x, y, angle}] screen-space, oldest first
function drawMarkerTrail(ctx, trail) {
  if (trail.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (var i = 1; i < trail.length; i++) {
    var frac = i / trail.length;
    var alpha = frac * frac * 0.55;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = C.curve;
    ctx.lineWidth   = Math.max(1, frac * 6);
    ctx.beginPath();
    ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
    ctx.lineTo(trail[i].x,     trail[i].y);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

// ─── Animated Marker ──────────────────────────────────────────────────────────

function drawMarker(ctx, x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Glowing dot + directional arrow
  ctx.shadowColor = C.curve; ctx.shadowBlur = 16;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = C.curve;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  // Arrow
  ctx.fillStyle = C.curve;
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(7, -4);
  ctx.lineTo(7,  4);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}
