// app.js — Application state, events, render loop. Requires math.js, render.js.

// ─── State ────────────────────────────────────────────────────────────────────

var state = {
  mode:       'free',      // 'free' | 'math'
  curveType:  'bezier',    // 'bezier' | 'spline'
  degreeMode: 'cubic',     // 'quadratic' | 'cubic' | 'free'
  is3D:       false,
  theme:      'dark',

  // Each curve: { points:[{x,y,z}], type:'bezier'|'spline', segments:[] }
  curves:          [],
  activeCurveIdx:  0,

  // Math mode
  t:         0.5,
  animating: false,
  animDir:   1,
  animSpeed: 1.0,          // multiplier

  // Interaction
  dragging:        null,   // { ci, pi } — curve index, point index
  hover:           null,   // { ci, pi }
  selectedPt:      null,   // { ci, pi } — for Z slider
  camDragging:     false,
  camDragStart:    null,   // { mx, my, yaw, pitch }
  dragPlane:       'screen', // 'screen' | 'xy' | 'xz' | 'yz'
  curveDragging:   null,    // ci — whole-curve translation in progress
  curveDragOrigin: null,    // { x, y } screen pos where curve drag started
  curveDragSnap:   null,    // deep copy of curve.points at drag start

  // 3D Camera
  camera: { yaw: -0.5, pitch: 0.3, zoom: 1 },

  // Display options
  showPolygon: true,
  showLabels:  true,
  showTangent: false,

  // Animated marker
  showMarker:  false,
  markerT:     0,
  markerDir:   1,
  markerSpeed: 0.15,
  markerTrail: [],    // [{x,y,z,angle}] world-space history

  // Font mode
  fontMode:          false,
  fontCurrentLetter: 'A',
  fontPreviewText:   'Hello',

  // Undo/Redo
  history:    [],
  historyIdx: -1,
};

// ─── DOM ──────────────────────────────────────────────────────────────────────

var canvas      = document.getElementById('canvas');
var ctx         = canvas.getContext('2d');
var canvasWrap  = document.getElementById('canvas-container');
var hint        = document.getElementById('canvas-hint');
var mathPanel   = document.getElementById('math-panel');
var tSlider     = document.getElementById('t-slider');
var tValueEl    = document.getElementById('t-value');
var animBtn     = document.getElementById('animate-btn');
var formulaEl   = document.getElementById('formula-display');
var basisEl     = document.getElementById('basis-charts');
var pointInfoEl = document.getElementById('point-info');
var undoBtn     = document.getElementById('btn-undo');
var redoBtn     = document.getElementById('btn-redo');
var zSliderWrap = document.getElementById('z-slider-wrap');
var zSlider     = document.getElementById('z-slider');
var zValueEl    = document.getElementById('z-value');

// ─── Canvas / DPR ─────────────────────────────────────────────────────────────

var dpr = window.devicePixelRatio || 1;

function canvasCSS() {
  return { w: canvas.width / dpr, h: canvas.height / dpr };
}

function resizeCanvas() {
  if (state.fontMode) saveFontGlyph();  // snapshot at old size
  var r = canvasWrap.getBoundingClientRect();
  dpr = window.devicePixelRatio || 1;
  canvas.width  = r.width  * dpr;
  canvas.height = r.height * dpr;
  canvas.style.width  = r.width  + 'px';
  canvas.style.height = r.height + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (state.fontMode) loadFontGlyph(state.fontCurrentLetter); // reload at new size
  render();
}
window.addEventListener('resize', resizeCanvas);

// ResizeObserver keeps the canvas in sync with its container at all times,
// including during the #math-panel CSS transition (0.22s).
if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(function() { resizeCanvas(); }).observe(canvasWrap);
}

// ─── History (Undo/Redo) ──────────────────────────────────────────────────────

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

function pushHistory() {
  state.history.splice(state.historyIdx + 1);
  state.history.push(deepClone(state.curves));
  state.historyIdx = state.history.length - 1;
  if (state.history.length > 60) { state.history.shift(); state.historyIdx--; }
  updateUndoRedo();
}

function undo() {
  if (state.historyIdx <= 0) return;
  state.historyIdx--;
  state.curves = deepClone(state.history[state.historyIdx]);
  state.activeCurveIdx = Math.min(state.activeCurveIdx, state.curves.length - 1);
  recomputeAllSegments();
  state.selectedPt = null;
  render(); updateUndoRedo(); updateHint();
}

function redo() {
  if (state.historyIdx >= state.history.length - 1) return;
  state.historyIdx++;
  state.curves = deepClone(state.history[state.historyIdx]);
  recomputeAllSegments();
  state.selectedPt = null;
  render(); updateUndoRedo(); updateHint();
}

function updateUndoRedo() {
  if (undoBtn) { undoBtn.disabled = state.historyIdx <= 0; }
  if (redoBtn) { redoBtn.disabled = state.historyIdx >= state.history.length - 1; }
}

// ─── Curve Management ─────────────────────────────────────────────────────────

function activeCurve() {
  return state.curves[state.activeCurveIdx] || null;
}

function recomputeSegments(curve) {
  if (curve && curve.type === 'spline') {
    curve.segments = naturalCubicToSegments(curve.points, curve.closed);
  }
}

function recomputeAllSegments() {
  state.curves.forEach(recomputeSegments);
}

function newCurve() {
  // Only create if current active curve has at least 1 point (or no curves yet)
  var ac = activeCurve();
  if (ac && ac.points.length === 0) return; // already empty, no need
  state.curves.push({ points: [], type: state.curveType, segments: [] });
  state.activeCurveIdx = state.curves.length - 1;
  updateHint();
  render();
}

function maxPointsForCurve() {
  if (state.curveType === 'spline') return 30;
  if (state.degreeMode === 'quadratic') return 3;
  if (state.degreeMode === 'cubic')     return 4;
  return 8;
}

// ─── Projection ───────────────────────────────────────────────────────────────

function camCenter() {
  var s = canvasCSS();
  return { cx: s.w / 2, cy: s.h / 2 };
}

// Project a 3D world point to 2D screen point for rendering
function proj(p) {
  if (!state.is3D) return { x: p.x, y: p.y, z: 0, scale: 1 };
  var cc = camCenter();
  return project3D(p, state.camera, cc.cx, cc.cy);
}

// Project an array of points
function projAll(pts) {
  return pts.map(proj);
}

// When placing/dragging in 3D: unproject screen pos to world pos
function unproj(sx, sy) {
  if (!state.is3D) return { x: sx, y: sy, z: 0 };
  var cc = camCenter();
  return unprojectFront(sx, sy, state.camera, cc.cx, cc.cy);
}

// ─── Main Render ──────────────────────────────────────────────────────────────

function render() {
  var s = canvasCSS();
  var w = s.w, h = s.h;

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, w, h);

  if (state.is3D) {
    var cc = camCenter();
    drawAxes3D(ctx, state.camera, cc.cx, cc.cy, 110);
  } else {
    drawGrid(ctx, w, h);
  }

  if (state.fontMode) {
    drawFontGuides(ctx, w, h);
  }

  var isMath = state.mode === 'math';

  state.curves.forEach(function(curve, ci) {
    var isActive  = ci === state.activeCurveIdx;
    var curveCol  = isActive ? C.curve         : C.inactiveCurve;
    var glowCol   = isActive ? C.curveGlow     : 'rgba(140,140,180,0.08)';
    var polyCol   = isActive ? C.polygon       : 'rgba(180,180,200,0.15)';

    var pts = curve.points;
    if (pts.length === 0) return;

    // Project points for rendering
    var ppts = projAll(pts);

    if (curve.type === 'bezier') {
      if (ppts.length >= 2) {
        if (state.showPolygon) drawControlPolygon(ctx, ppts, { spline: false });
        drawBezierCurve(ctx, ppts, { color: curveCol, glowColor: glowCol });

        if (isMath && isActive) {
          var levels3D = deCasteljau(pts, state.t);
          var levelsP  = levels3D.map(function(lvl) { return lvl.map(proj); });
          drawDeCasteljau(ctx, ppts, state.t, levelsP);
          if (state.showLabels) drawDeCasteljauLabels(ctx, ppts, state.t, levelsP);
          if (state.showTangent) {
            var tanPts = ppts; // 2D projected, use for visual direction
            drawTangent(ctx, tanPts, state.t);
          }
        }
      }
    } else {
      // Spline
      if (curve.segments.length > 0) {
        var projSegs = curve.segments.map(function(seg) { return projAll(seg); });
        if (curve.trackStyle) {
          drawTrackStyle(ctx, projSegs);
          drawSplineCurve(ctx, projSegs, { color: curveCol, glowColor: glowCol });
        } else {
          if (state.showPolygon) drawControlPolygon(ctx, ppts, { spline: true });
          if (isMath && isActive) drawSplineHandles(ctx, projSegs);
          drawSplineCurve(ctx, projSegs, { color: curveCol, glowColor: glowCol });
        }

        if (isMath && isActive && curve.segments.length > 0) {
          var info   = evalSpline(curve.segments, state.t);
          var seg3D  = curve.segments[info.segIdx];
          var segLvls3D = deCasteljau(seg3D, info.localT);
          var segLvlsP  = segLvls3D.map(function(lvl) { return lvl.map(proj); });
          var projSeg = projAll(seg3D);
          drawDeCasteljau(ctx, projSeg, info.localT, segLvlsP);
          if (state.showLabels) drawDeCasteljauLabels(ctx, projSeg, info.localT, segLvlsP);
          if (state.showTangent) drawTangent(ctx, projSeg, info.localT);
        }
      }
    }

    // Control points
    var hoverPi = (state.hover && state.hover.ci === ci) ? state.hover.pi : -1;
    var selPi   = (state.selectedPt && state.selectedPt.ci === ci) ? state.selectedPt.pi : -1;
    drawControlPoints(ctx, ppts, {
      hoverIndex:   hoverPi,
      selectedIndex: selPi,
      showLabels:   isMath || state.showLabels,
      prefix:       curve.type === 'spline' ? 'K' : 'P',
    });
  });

  if (isMath) refreshMathPanel();

  // ── Animated marker along active curve ──
  if (state.showMarker) {
    var mac = activeCurve();
    if (mac && mac.points.length >= 2) {
      var mt = state.markerT;
      var mpt1 = null, mpt2 = null;
      if (mac.type === 'spline' && mac.segments.length > 0) {
        var mi1 = evalSpline(mac.segments, mt);
        var mi2 = evalSpline(mac.segments, (mt + 0.006) % 1);
        mpt1 = proj(mi1.point);
        mpt2 = proj(mi2.point);
      } else if (mac.type === 'bezier' && mac.points.length >= 2) {
        var mbpts = projAll(mac.points);
        mpt1 = evalBezier(mbpts, mt);
        mpt2 = evalBezier(mbpts, Math.min(mt + 0.006, 0.9999));
      }
      if (mpt1 && mpt2) {
        var mang = Math.atan2(mpt2.y - mpt1.y, mpt2.x - mpt1.x);
        // Draw trail first (behind the marker)
        if (state.markerTrail.length > 1) {
          var projTrail = state.markerTrail.map(function(tp) {
            var sp = proj(tp); return { x: sp.x, y: sp.y, angle: tp.angle };
          });
          drawMarkerTrail(ctx, projTrail);
        }
        drawMarker(ctx, mpt1.x, mpt1.y, mang);
      }
    }
  }

  if (state.fontMode) updateFontPreview();
}

// ─── Math Panel ───────────────────────────────────────────────────────────────

function refreshMathPanel() {
  var t   = state.t;
  var ac  = activeCurve();
  tValueEl.textContent = t.toFixed(3);

  if (!ac || ac.points.length === 0) {
    formulaEl.innerHTML  = '<span class="muted">Add points to see formula.</span>';
    pointInfoEl.innerHTML = '';
    refreshBasisCharts(3, t);
    return;
  }

  var pts = ac.points;

  if (ac.type === 'bezier') {
    var n  = pts.length - 1;
    var pt = evalBezier(pts, t);
    renderFormula(n, t);
    refreshBasisCharts(n, t);
    pointInfoEl.innerHTML =
      '<div>B(t) = (<span class="accent">' + pt.x.toFixed(1) + '</span>, <span class="accent">' + pt.y.toFixed(1) + '</span>' +
      (state.is3D ? ', <span class="accent">' + (pt.z||0).toFixed(1) + '</span>' : '') + ')</div>' +
      '<div class="muted" style="margin-top:4px">degree&nbsp;' + n + '&nbsp;&nbsp;|&nbsp;&nbsp;' + pts.length + '&nbsp;control pts</div>';
  } else {
    if (!ac.segments.length) {
      formulaEl.innerHTML = '<span class="muted">Add at least 2 knot points.</span>';
      pointInfoEl.innerHTML = '';
      refreshBasisCharts(3, t); return;
    }
    var info = evalSpline(ac.segments, t);
    var seg  = ac.segments[info.segIdx];
    renderFormula(3, info.localT);
    refreshBasisCharts(3, info.localT);
    pointInfoEl.innerHTML =
      '<div>S(t)=(<span class="accent">' + info.point.x.toFixed(1) + '</span>, <span class="accent">' + info.point.y.toFixed(1) + '</span>' +
      (state.is3D ? ', <span class="accent">' + (info.point.z||0).toFixed(1) + '</span>' : '') + ')</div>' +
      '<div class="muted" style="margin-top:4px">seg ' + (info.segIdx+1) + '/' + ac.segments.length + '&nbsp;&nbsp;local t=' + info.localT.toFixed(3) + '</div>';
  }
}

function renderFormula(n, t) {
  var html = '<div class="formula-line"><span class="accent">B(t)</span>&nbsp;=&nbsp;';
  var terms = [];
  for (var i = 0; i <= n; i++) {
    var bval = bernstein(n, i, t);
    var c    = binomial(n, i);
    var term = '';
    if (c > 1) term += c;
    var p1mt = n - i, pt2 = i;
    if (p1mt > 0) { term += '(1‑t)'; if (p1mt > 1) term += _sup(p1mt); }
    if (pt2  > 0) { term += 't';     if (pt2  > 1) term += _sup(pt2);  }
    term += '·<b style="color:#ff7b00">P<sub>' + i + '</sub></b>';
    var op = 0.35 + bval * 0.65;
    terms.push('<span title="B(' + n + ',' + i + ',' + t.toFixed(2) + ')=' + bval.toFixed(3) + '" style="opacity:' + op.toFixed(2) + '">' + term + '</span>');
  }
  html += terms.join(' + ') + '</div>';
  if (n === 1) html += '<div class="formula-explicit muted">(1‑t)·P₀ + t·P₁</div>';
  else if (n === 2) html += '<div class="formula-explicit muted">(1‑t)²·P₀ + 2(1‑t)t·P₁ + t²·P₂</div>';
  else if (n === 3) html += '<div class="formula-explicit muted">(1‑t)³·P₀ + 3(1‑t)²t·P₁ + 3(1‑t)t²·P₂ + t³·P₃</div>';
  formulaEl.innerHTML = html;
}

function _sup(n) {
  return ({ 2:'²',3:'³',4:'⁴',5:'⁵',6:'⁶',7:'⁷' })[n] || '<sup>' + n + '</sup>';
}

// ─── Basis Charts ─────────────────────────────────────────────────────────────

var _basisDeg = -1;

function refreshBasisCharts(n, t) {
  if (n !== _basisDeg) {
    _basisDeg = n;
    basisEl.innerHTML = '';
    for (var i = 0; i <= n; i++) {
      var wrap = document.createElement('div'); wrap.className = 'basis-item';
      var lbl  = document.createElement('div'); lbl.className  = 'basis-label';
      lbl.innerHTML = 'B<sub>' + n + ',' + i + '</sub>';
      var cv = document.createElement('canvas'); cv.className = 'basis-canvas';
      cv.width = 112; cv.height = 64; cv.dataset.i = i;
      wrap.appendChild(lbl); wrap.appendChild(cv); basisEl.appendChild(wrap);
    }
  }
  basisEl.querySelectorAll('.basis-canvas').forEach(function(cv) {
    drawBasisFunction(cv.getContext('2d'), n, parseInt(cv.dataset.i), t);
  });
}

// ─── Animation ────────────────────────────────────────────────────────────────

var _animFrame = null, _lastTime = 0;

animBtn.addEventListener('click', function() {
  state.animating = !state.animating;
  if (state.animating) {
    animBtn.textContent = '⏸ Pause'; animBtn.classList.add('active');
    _lastTime = performance.now();
    _animFrame = requestAnimationFrame(_animLoop);
  } else {
    animBtn.textContent = '▶ Animate'; animBtn.classList.remove('active');
    if (_animFrame) cancelAnimationFrame(_animFrame);
  }
});

function _animLoop(time) {
  if (!state.animating) return;
  var dt = Math.min((time - _lastTime) / 1000, 0.05);
  _lastTime = time;
  // BASE_SPEED chosen so 1.75× gives the original speed (0.38 / 1.75 ≈ 0.217)
  state.t += state.animDir * dt * (0.38 / 1.75) * state.animSpeed;
  if (state.t >= 1) { state.t = 1; state.animDir = -1; }
  else if (state.t <= 0) { state.t = 0; state.animDir = 1; }
  tSlider.value = state.t;
  render();
  _animFrame = requestAnimationFrame(_animLoop);
}

// ─── Marker Animation ─────────────────────────────────────────────────────────

var _markerFrame = null, _markerLastTime = 0;

function startMarkerAnim() {
  if (_markerFrame) return;
  _markerLastTime = performance.now();
  _markerFrame = requestAnimationFrame(_markerLoop);
}

function stopMarkerAnim() {
  if (_markerFrame) { cancelAnimationFrame(_markerFrame); _markerFrame = null; }
}

function _markerLoop(time) {
  if (!state.showMarker) { _markerFrame = null; render(); return; }
  var dt = Math.min((time - _markerLastTime) / 1000, 0.05);
  _markerLastTime = time;
  var mac = activeCurve();
  if (mac && mac.closed) {
    state.markerT = (state.markerT + dt * state.markerSpeed) % 1;
  } else {
    state.markerT += state.markerDir * dt * state.markerSpeed;
    if (state.markerT >= 1) { state.markerT = 1; state.markerDir = -1; }
    else if (state.markerT <= 0) { state.markerT = 0; state.markerDir = 1; }
  }
  // Collect trail position for spline curves
  if (mac && mac.type === 'spline' && mac.segments.length > 0) {
    var tmt = state.markerT;
    var ti1 = evalSpline(mac.segments, tmt);
    var ti2 = evalSpline(mac.segments, (tmt + 0.006) % 1);
    state.markerTrail.push({
      x: ti1.point.x, y: ti1.point.y, z: ti1.point.z || 0,
      angle: Math.atan2(ti2.point.y - ti1.point.y, ti2.point.x - ti1.point.x),
    });
    if (state.markerTrail.length > 40) state.markerTrail.shift();
  }
  render();
  _markerFrame = requestAnimationFrame(_markerLoop);
}

// ─── Examples ─────────────────────────────────────────────────────────────────

var EXAMPLES = {
  racetrack: function(w, h) {
    return {
      type: 'spline', closed: true, trackStyle: true, segments: [],
      points: [
        {x:0.35*w, y:0.18*h, z:0}, {x:0.50*w, y:0.15*h, z:0},
        {x:0.65*w, y:0.18*h, z:0}, {x:0.78*w, y:0.28*h, z:0},
        {x:0.84*w, y:0.45*h, z:0}, {x:0.78*w, y:0.62*h, z:0},
        {x:0.65*w, y:0.72*h, z:0}, {x:0.50*w, y:0.75*h, z:0},
        {x:0.35*w, y:0.72*h, z:0}, {x:0.22*w, y:0.62*h, z:0},
        {x:0.16*w, y:0.45*h, z:0}, {x:0.22*w, y:0.28*h, z:0},
      ],
    };
  },

  figure8: function(w, h) {
    var cx = w*0.5, cy = h*0.5, rx = w*0.26, ry = h*0.30;
    var pts = [];
    for (var i = 0; i < 12; i++) {
      var theta = (i / 12) * 2 * Math.PI;
      pts.push({ x: cx + rx * Math.sin(theta), y: cy + ry * Math.sin(2*theta) / 2, z: 0 });
    }
    return { type: 'spline', closed: true, segments: [], points: pts };
  },

  heart: function(w, h) {
    var scale = Math.min(w, h) * 0.018;
    var cx = w*0.5, cy = h*0.42;
    var pts = [];
    var N = 16;
    for (var i = 0; i < N; i++) {
      // Start from bottom tip (theta=π) going counterclockwise
      var theta = Math.PI + (i / N) * 2 * Math.PI;
      pts.push({
        x: cx + scale * 16 * Math.pow(Math.sin(theta), 3),
        y: cy - scale * (13*Math.cos(theta) - 5*Math.cos(2*theta) - 2*Math.cos(3*theta) - Math.cos(4*theta)),
        z: 0,
      });
    }
    return { type: 'spline', closed: true, segments: [], points: pts };
  },

  wave: function(w, h) {
    var pts = [];
    var N = 12;
    for (var i = 0; i < N; i++) {
      var frac = i / (N - 1);
      pts.push({
        x: (0.05 + frac * 0.90) * w,
        y: h * 0.5 + Math.sin(frac * Math.PI * 4) * h * 0.26,
        z: 0,
      });
    }
    return { type: 'spline', closed: false, segments: [], points: pts };
  },
};

function loadExample(name) {
  var s = canvasCSS();
  var fn = EXAMPLES[name];
  if (!fn) return;
  var def = fn(s.w, s.h);
  recomputeSegments(def);

  state.curves = [def];
  state.activeCurveIdx = 0;
  state.curveType = 'spline';

  // Sync the UI curve-type buttons
  document.getElementById('btn-bezier').classList.remove('active');
  document.getElementById('btn-spline').classList.add('active');
  document.getElementById('degree-group').style.display = 'none';

  // Speed for non-track marker animation
  state.markerSpeed = (name === 'wave') ? 0.20 : 0.15;

  // Auto-start the animated marker for all examples
  state.showMarker = true;
  state.markerT = 0;
  state.markerDir = 1;
  state.markerTrail = [];
  var mc = document.getElementById('show-marker');
  if (mc) mc.checked = true;
  startMarkerAnim();

  pushHistory();
  updateHint();
  render();
}

// ─── Mouse/Touch Helpers ──────────────────────────────────────────────────────

var HIT_R = 14;

function canvasPos(e) {
  var r  = canvas.getBoundingClientRect();
  var cx = e.clientX !== undefined ? e.clientX : e.touches[0].clientX;
  var cy = e.clientY !== undefined ? e.clientY : e.touches[0].clientY;
  return { x: cx - r.left, y: cy - r.top };
}

// Hit-test across all curves. Returns { ci, pi } or null.
function hitTest(pos) {
  // Test active curve first, then others
  var order = [state.activeCurveIdx];
  state.curves.forEach(function(_, ci) { if (ci !== state.activeCurveIdx) order.push(ci); });

  for (var oi = 0; oi < order.length; oi++) {
    var ci    = order[oi];
    var curve = state.curves[ci];
    if (!curve) continue;
    for (var pi = curve.points.length - 1; pi >= 0; pi--) {
      var sp = proj(curve.points[pi]);
      var dx = pos.x - sp.x, dy = pos.y - sp.y;
      if (Math.sqrt(dx*dx + dy*dy) < HIT_R) return { ci: ci, pi: pi };
    }
  }
  return null;
}

// ─── Curve-line Hit Test ──────────────────────────────────────────────────────

var CURVE_HIT_R = 10;

// Sample the projected curve and return { ci } if pos is within CURVE_HIT_R,
// or null. Tests active curve first so it gets priority on overlap.
function hitTestCurve(pos) {
  var order = [state.activeCurveIdx];
  state.curves.forEach(function(_, ci) { if (ci !== state.activeCurveIdx) order.push(ci); });

  for (var oi = 0; oi < order.length; oi++) {
    var ci    = order[oi];
    var curve = state.curves[ci];
    if (!curve || curve.points.length < 2) continue;

    if (curve.type === 'bezier') {
      var ppts = projAll(curve.points);
      for (var i = 0; i <= 150; i++) {
        var p = evalBezier(ppts, i / 150);
        var dx = pos.x - p.x, dy = pos.y - p.y;
        if (dx*dx + dy*dy < CURVE_HIT_R*CURVE_HIT_R) return { ci: ci };
      }
    } else if (curve.segments.length > 0) {
      for (var si = 0; si < curve.segments.length; si++) {
        var pseg = projAll(curve.segments[si]);
        for (var i = 0; i <= 60; i++) {
          var p = evalBezier(pseg, i / 60);
          var dx = pos.x - p.x, dy = pos.y - p.y;
          if (dx*dx + dy*dy < CURVE_HIT_R*CURVE_HIT_R) return { ci: ci };
        }
      }
    }
  }
  return null;
}

function startCurveDrag(ci, pos) {
  state.curveDragging   = ci;
  state.curveDragOrigin = { x: pos.x, y: pos.y };
  state.curveDragSnap   = deepClone(state.curves[ci].points);
  state.activeCurveIdx  = ci;
}

function endCurveDrag() {
  if (state.curveDragging !== null) {
    pushHistory();
    state.curveDragging   = null;
    state.curveDragOrigin = null;
    state.curveDragSnap   = null;
  }
}

// ─── Mouse Events ─────────────────────────────────────────────────────────────

canvas.addEventListener('mousedown', function(e) {
  if (e.button !== 0) return;
  var pos = canvasPos(e);
  var hit = hitTest(pos);

  if (hit) {
    state.dragging = hit;
    state.activeCurveIdx = hit.ci;
    setSelectedPoint(hit);
    canvas.style.cursor = 'grabbing';
  } else {
    var curveHit = hitTestCurve(pos);
    if (curveHit) {
      startCurveDrag(curveHit.ci, pos);
      canvas.style.cursor = 'grabbing';
    } else if (state.is3D) {
      state.camDragging  = true;
      state.camDragStart = { mx: pos.x, my: pos.y, yaw: state.camera.yaw, pitch: state.camera.pitch };
      canvas.style.cursor = 'move';
    } else {
      addPointAt(pos);
    }
  }
  render();
});

canvas.addEventListener('mousemove', function(e) {
  var pos = canvasPos(e);

  // ── Whole-curve translation ──
  if (state.curveDragging !== null) {
    var ci    = state.curveDragging;
    var curve = state.curves[ci];
    var snap  = state.curveDragSnap;
    var sdx   = pos.x - state.curveDragOrigin.x;
    var sdy   = pos.y - state.curveDragOrigin.y;

    if (!state.is3D) {
      for (var i = 0; i < curve.points.length; i++) {
        curve.points[i].x = snap[i].x + sdx;
        curve.points[i].y = snap[i].y + sdy;
      }
    } else {
      var dw = screenDeltaToWorld(sdx, sdy, state.camera);
      for (var i = 0; i < curve.points.length; i++) {
        curve.points[i].x = snap[i].x + dw.x;
        curve.points[i].y = snap[i].y + dw.y;
        curve.points[i].z = snap[i].z + dw.z;
      }
    }
    recomputeSegments(curve);
    canvas.style.cursor = 'grabbing';
    _lastMousePos = pos;
    render();
    return;
  }

  // ── Individual control-point drag ──
  if (state.dragging) {
    var pt = state.curves[state.dragging.ci].points[state.dragging.pi];
    if (state.is3D) {
      var prevPos = _lastMousePos || pos;
      var ddx = pos.x - prevPos.x, ddy = pos.y - prevPos.y;
      var dw  = screenDeltaToWorld(ddx, ddy, state.camera);
      switch (state.dragPlane) {
        case 'xy': pt.x += dw.x; pt.y += dw.y; break;
        case 'xz': pt.x += dw.x; pt.z += dw.z; break;
        case 'yz': pt.y += dw.y; pt.z += dw.z; break;
        default:   pt.x += dw.x; pt.y += dw.y; pt.z += dw.z; break;
      }
    } else {
      pt.x = pos.x; pt.y = pos.y;
    }
    recomputeSegments(state.curves[state.dragging.ci]);
    canvas.style.cursor = 'grabbing';
    _lastMousePos = pos;
    render();
    return;
  }

  // ── Camera rotation ──
  if (state.camDragging && state.camDragStart) {
    var ds   = state.camDragStart;
    var sens = 0.007;
    state.camera.yaw   = ds.yaw   + (pos.x - ds.mx) * sens;
    state.camera.pitch = ds.pitch + (pos.y - ds.my) * sens;
    state.camera.pitch = Math.max(-Math.PI/2 + 0.05, Math.min(Math.PI/2 - 0.05, state.camera.pitch));
    render();
    return;
  }

  // ── Hover cursor ──
  _lastMousePos = pos;
  var hit = hitTest(pos);
  var newHover = hit || null;
  var prevHover = state.hover;
  state.hover = newHover;

  if (!_hoverEq(prevHover, newHover)) {
    if (newHover) {
      canvas.style.cursor = 'grab';
    } else {
      // Check if hovering over a curve line → show move cursor as affordance
      var onCurve = hitTestCurve(pos);
      canvas.style.cursor = onCurve ? 'move' : (state.is3D ? 'move' : 'crosshair');
    }
    render();
  }
});

var _lastMousePos = null;

function _hoverEq(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.ci === b.ci && a.pi === b.pi;
}

canvas.addEventListener('mouseup', function() {
  if (state.dragging)        { pushHistory(); state.dragging = null; }
  endCurveDrag();
  state.camDragging = false;
  canvas.style.cursor = state.hover ? 'grab' : (state.is3D ? 'move' : 'crosshair');
});

canvas.addEventListener('mouseleave', function() {
  if (state.dragging) { pushHistory(); state.dragging = null; }
  endCurveDrag();
  state.camDragging = false;
  state.hover = null;
  canvas.style.cursor = 'crosshair';
  render();
});

canvas.addEventListener('contextmenu', function(e) {
  e.preventDefault();
  var hit = hitTest(canvasPos(e));
  if (hit) removePoint(hit.ci, hit.pi);
});

// Double-click: finalize current curve and start new one
canvas.addEventListener('dblclick', function(e) {
  if (state.is3D) return; // no dblclick add in 3D (use button)
  var pos = canvasPos(e);
  var hit = hitTest(pos);
  if (!hit) {
    // If not clicking a point, start new curve
    var ac = activeCurve();
    if (ac && ac.points.length > 0) {
      newCurve();
    }
  }
});

// Touch
canvas.addEventListener('touchstart', function(e) {
  e.preventDefault();
  var pos = canvasPos(e);
  var hit = hitTest(pos);
  if (hit) { state.dragging = hit; state.activeCurveIdx = hit.ci; setSelectedPoint(hit); }
  else {
    var curveHit = hitTestCurve(pos);
    if (curveHit) startCurveDrag(curveHit.ci, pos);
    else addPointAt(pos);
  }
  _lastMousePos = pos;
  render();
}, { passive: false });

canvas.addEventListener('touchmove', function(e) {
  e.preventDefault();
  var pos = canvasPos(e);

  if (state.curveDragging !== null) {
    var ci    = state.curveDragging;
    var curve = state.curves[ci];
    var snap  = state.curveDragSnap;
    var sdx   = pos.x - state.curveDragOrigin.x;
    var sdy   = pos.y - state.curveDragOrigin.y;
    if (!state.is3D) {
      for (var i = 0; i < curve.points.length; i++) {
        curve.points[i].x = snap[i].x + sdx;
        curve.points[i].y = snap[i].y + sdy;
      }
    } else {
      var dw = screenDeltaToWorld(sdx, sdy, state.camera);
      for (var i = 0; i < curve.points.length; i++) {
        curve.points[i].x = snap[i].x + dw.x;
        curve.points[i].y = snap[i].y + dw.y;
        curve.points[i].z = snap[i].z + dw.z;
      }
    }
    recomputeSegments(curve);
    _lastMousePos = pos;
    render();
    return;
  }

  if (!state.dragging) return;
  var pt  = state.curves[state.dragging.ci].points[state.dragging.pi];
  if (state.is3D) {
    var ddx = pos.x - (_lastMousePos||pos).x, ddy = pos.y - (_lastMousePos||pos).y;
    var dw  = screenDeltaToWorld(ddx, ddy, state.camera);
    switch (state.dragPlane) {
      case 'xy': pt.x += dw.x; pt.y += dw.y; break;
      case 'xz': pt.x += dw.x; pt.z += dw.z; break;
      case 'yz': pt.y += dw.y; pt.z += dw.z; break;
      default:   pt.x += dw.x; pt.y += dw.y; pt.z += dw.z; break;
    }
  } else {
    pt.x = pos.x; pt.y = pos.y;
  }
  recomputeSegments(state.curves[state.dragging.ci]);
  _lastMousePos = pos;
  render();
}, { passive: false });

canvas.addEventListener('touchend', function() {
  if (state.dragging) { pushHistory(); state.dragging = null; }
  endCurveDrag();
});

// Scroll to zoom in 3D
canvas.addEventListener('wheel', function(e) {
  if (!state.is3D) return;
  e.preventDefault();
  state.camera.zoom = Math.max(0.2, Math.min(5, state.camera.zoom - e.deltaY * 0.001));
  render();
}, { passive: false });

// ─── Point Operations ─────────────────────────────────────────────────────────

function addPointAt(pos) {
  var ac = activeCurve();
  if (!ac) {
    state.curves.push({ points: [], type: state.curveType, segments: [] });
    state.activeCurveIdx = 0;
    ac = activeCurve();
  }
  if (ac.points.length >= maxPointsForCurve()) return;

  var wp = unproj(pos.x, pos.y);
  pushHistory();
  ac.points.push({ x: wp.x, y: wp.y, z: wp.z || 0 });
  recomputeSegments(ac);
  updateHint();
  render();
}

function deleteActiveCurve() {
  var ac = activeCurve();
  if (!ac || ac.points.length === 0) return;
  pushHistory();
  if (state.curves.length === 1) {
    // Only curve — just clear its points
    state.curves[0].points   = [];
    state.curves[0].segments = [];
  } else {
    state.curves.splice(state.activeCurveIdx, 1);
    state.activeCurveIdx = Math.max(0, Math.min(state.activeCurveIdx, state.curves.length - 1));
  }
  state.hover = null;
  state.dragging = null;
  setSelectedPoint(null);
  updateHint();
  render();
}

function removePoint(ci, pi) {
  var curve = state.curves[ci];
  if (!curve) return;
  pushHistory();
  curve.points.splice(pi, 1);
  recomputeSegments(curve);
  if (state.selectedPt && state.selectedPt.ci === ci && state.selectedPt.pi === pi) {
    setSelectedPoint(null);
  }
  state.hover = null;
  updateHint();
  render();
}

function clearAll() {
  pushHistory();
  state.curves = [{ points: [], type: state.curveType, segments: [] }];
  state.activeCurveIdx = 0;
  state.hover = null;
  state.dragging = null;
  setSelectedPoint(null);
  // Stop marker animation
  state.showMarker = false;
  var markerChk = document.getElementById('show-marker');
  if (markerChk) markerChk.checked = false;
  stopMarkerAnim();
  // In font mode: also wipe the current letter's glyph
  if (state.fontMode) {
    fontGlyphs[state.fontCurrentLetter] = [];
    updateLetterGrid();
  }
  updateHint();
  render();
}

// ─── Selected Point / Z Slider ────────────────────────────────────────────────

function setSelectedPoint(ref) {
  state.selectedPt = ref;
  if (ref && state.is3D) {
    var pt = state.curves[ref.ci].points[ref.pi];
    zSlider.value = (pt.z || 0).toFixed(0);
    zValueEl.textContent = (pt.z || 0).toFixed(0);
    zSliderWrap.style.display = 'flex';
  } else {
    zSliderWrap.style.display = 'none';
  }
}

zSlider.addEventListener('input', function() {
  var val = parseFloat(zSlider.value);
  zValueEl.textContent = val.toFixed(0);
  if (state.selectedPt) {
    var pt = state.curves[state.selectedPt.ci].points[state.selectedPt.pi];
    pt.z = val;
    recomputeSegments(state.curves[state.selectedPt.ci]);
    render();
  }
});

zSlider.addEventListener('change', function() {
  pushHistory(); // snapshot when Z slider is released
});

// ─── UI Wiring ────────────────────────────────────────────────────────────────

// Mode
document.getElementById('btn-free').addEventListener('click', function() { setMode('free'); });
document.getElementById('btn-math').addEventListener('click', function() { setMode('math'); });

function setMode(m) {
  if (state.fontMode) exitFontMode();   // close font designer when switching tabs
  state.mode = m;
  document.getElementById('btn-free').classList.toggle('active', m === 'free');
  document.getElementById('btn-math').classList.toggle('active', m === 'math');
  mathPanel.classList.toggle('open', m === 'math');
  if (m !== 'math' && state.animating) {
    state.animating = false;
    animBtn.textContent = '▶ Animate'; animBtn.classList.remove('active');
    if (_animFrame) cancelAnimationFrame(_animFrame);
  }
  resizeCanvas();
}

// Curve type
document.getElementById('btn-bezier').addEventListener('click', function() { setCurveType('bezier'); });
document.getElementById('btn-spline').addEventListener('click', function() { setCurveType('spline'); });

function setCurveType(type) {
  state.curveType = type;
  document.getElementById('btn-bezier').classList.toggle('active', type === 'bezier');
  document.getElementById('btn-spline').classList.toggle('active', type === 'spline');
  document.getElementById('degree-group').style.display = type === 'bezier' ? 'flex' : 'none';
  // New curves will use new type; existing curves keep their type
  updateHint();
  render();
}

// New Curve
document.getElementById('btn-new-curve').addEventListener('click', function() {
  newCurve();
});

// Degree
document.getElementById('btn-quad').addEventListener('click',    function() { setDegree('quadratic'); });
document.getElementById('btn-cubic').addEventListener('click',   function() { setDegree('cubic'); });
document.getElementById('btn-free-deg').addEventListener('click',function() { setDegree('free'); });

function setDegree(mode) {
  state.degreeMode = mode;
  document.getElementById('btn-quad').classList.toggle('active',     mode === 'quadratic');
  document.getElementById('btn-cubic').classList.toggle('active',    mode === 'cubic');
  document.getElementById('btn-free-deg').classList.toggle('active', mode === 'free');
  var ac = activeCurve();
  if (ac) {
    var max = maxPointsForCurve();
    if (ac.points.length > max) { pushHistory(); ac.points = ac.points.slice(0, max); }
  }
  render();
}

// 3D toggle
document.getElementById('btn-3d').addEventListener('click', function() {
  state.is3D = !state.is3D;
  document.getElementById('btn-3d').classList.toggle('active', state.is3D);

  var show = state.is3D ? '' : 'none';
  document.getElementById('cam-hint').style.display       = show;
  document.getElementById('drag-plane-group').style.display = show;
  if (!state.is3D) {
    zSliderWrap.style.display = 'none';
  } else {
    if (state.selectedPt) setSelectedPoint(state.selectedPt);
  }
  canvas.style.cursor = state.is3D ? 'move' : 'crosshair';
  render();
});

// Drag plane constraint buttons
(function() {
  var planes = ['screen', 'xy', 'xz', 'yz'];
  var ids    = ['dp-screen', 'dp-xy', 'dp-xz', 'dp-yz'];
  ids.forEach(function(id, idx) {
    document.getElementById(id).addEventListener('click', function() {
      state.dragPlane = planes[idx];
      ids.forEach(function(bid) { document.getElementById(bid).classList.remove('active'); });
      this.classList.add('active');
    });
  });
})();

// Animate speed buttons
document.querySelectorAll('.speed-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    state.animSpeed = parseFloat(this.dataset.speed);
    document.querySelectorAll('.speed-btn').forEach(function(b) { b.classList.remove('active'); });
    this.classList.add('active');
  });
});

// Theme toggle
document.getElementById('btn-theme').addEventListener('click', function() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme(state.theme);
});

function applyTheme(theme) {
  setTheme(theme);
  document.documentElement.setAttribute('data-theme', theme);
  _basisDeg = -1; // force rebuild of basis charts
  document.getElementById('btn-theme').textContent = theme === 'dark' ? '☀ Light' : '🌙 Dark';
  render();
}

// Undo/Redo buttons
undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);

// t slider
tSlider.addEventListener('input', function() {
  state.t = parseFloat(tSlider.value);
  render();
});

// Options
document.getElementById('show-polygon').addEventListener('change', function(e) { state.showPolygon = e.target.checked; render(); });
document.getElementById('show-labels').addEventListener('change',  function(e) { state.showLabels  = e.target.checked; render(); });
document.getElementById('show-tangent').addEventListener('change', function(e) { state.showTangent = e.target.checked; render(); });

// Marker toggle
document.getElementById('show-marker').addEventListener('change', function(e) {
  state.showMarker = e.target.checked;
  state.markerT = 0; state.markerDir = 1; state.markerTrail = [];
  if (state.showMarker) startMarkerAnim();
  else { stopMarkerAnim(); render(); }
});

// Example buttons
['racetrack', 'figure8', 'heart', 'wave'].forEach(function(name) {
  var btn = document.getElementById('ex-' + name);
  if (btn) btn.addEventListener('click', function() { loadExample(name); });
});

// Clear
document.getElementById('clear-btn').addEventListener('click', clearAll);

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT') return;
  var k = e.key;
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); undo(); return; }
  if ((e.ctrlKey || e.metaKey) && (k === 'y' || (e.shiftKey && k === 'z'))) { e.preventDefault(); redo(); return; }
  switch (k) {
    case 'f': case 'F':
      if (state.fontMode) exitFontMode(); else enterFontMode(); break;
    case 'c': case 'C': clearAll(); break;
    case 'm': case 'M':
      if (!state.fontMode) setMode(state.mode === 'free' ? 'math' : 'free'); break;
    case 'b': case 'B': if (!state.fontMode) setCurveType('bezier'); break;
    case 's': case 'S': if (!state.fontMode) setCurveType('spline'); break;
    case 'n': case 'N': if (!state.fontMode) newCurve(); break;
    case ' ': e.preventDefault(); if (state.mode === 'math') animBtn.click(); break;
    case 'Delete': case 'Backspace':
      if (state.selectedPt) { removePoint(state.selectedPt.ci, state.selectedPt.pi); }
      else { deleteActiveCurve(); }
      break;
  }
});

// ─── Hint ─────────────────────────────────────────────────────────────────────

function updateHint() {
  var ac    = activeCurve();
  var empty = !ac || ac.points.length === 0;
  hint.classList.toggle('hidden', !empty);
  if (empty) {
    hint.textContent = state.is3D
      ? 'Click to add points (drag background to rotate · scroll to zoom · select point to set Z)'
      : (state.curveType === 'bezier'
          ? 'Click to add control points · double-click empty to start new curve · right-click to delete'
          : 'Click to add knot points (curve passes through them) · double-click empty for new curve');
  }
}

// ─── Default Setup ────────────────────────────────────────────────────────────

function placeDefaultPoints() {
  var s = canvasCSS();
  var w = s.w, h = s.h;
  state.curves = [{
    type: 'bezier',
    points: [
      { x: w*0.20, y: h*0.65, z: 0 },
      { x: w*0.38, y: h*0.22, z: 0 },
      { x: w*0.62, y: h*0.78, z: 0 },
      { x: w*0.80, y: h*0.35, z: 0 },
    ],
    segments: [],
  }];
  state.activeCurveIdx = 0;
  updateHint();
}

// ─── Init ─────────────────────────────────────────────────────────────────────

resizeCanvas();
placeDefaultPoints();
pushHistory(); // initial snapshot
updateUndoRedo();
updateHint();
render();
initFont();
