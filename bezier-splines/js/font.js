// font.js — Custom font designer. Requires math.js, render.js.
// Loaded before app.js; references to state/canvasCSS etc are resolved at call time.

var DESIGN_W   = 300;   // design-box width  (pixels at 1:1)
var DESIGN_H   = 420;   // design-box height
var GUIDE_CAP  = 0.10;  // fraction of DESIGN_H → cap-height line
var GUIDE_X    = 0.44;  // x-height line
var GUIDE_BASE = 0.72;  // baseline
var GUIDE_DESC = 0.90;  // descender

// Font sidebar pixel width (must match CSS #font-sidebar width)
var FONT_SIDEBAR_W = 296;

// ─── Arial-style default glyph data ──────────────────────────────────────────
// All x/y normalised to [0..1] within the design box (300 × 420 px).
// y=0.10 = cap height, y=0.72 = baseline.
// type:'spline' gives smooth Catmull-Rom interpolation; 2-point splines are straight lines.

var ARIAL_GLYPHS = {
  'A': [
    { type:'spline', closed:false, points:[
      {x:0.21,y:0.72,z:0},{x:0.50,y:0.10,z:0},{x:0.79,y:0.72,z:0}
    ]},
    { type:'spline', closed:false, points:[
      {x:0.30,y:0.47,z:0},{x:0.70,y:0.47,z:0}
    ]},
  ],
  'B': [
    { type:'spline', closed:false, points:[
      {x:0.225,y:0.10,z:0},{x:0.225,y:0.72,z:0}
    ]},
    { type:'spline', closed:false, points:[
      {x:0.225,y:0.10,z:0},{x:0.50,y:0.10,z:0},{x:0.70,y:0.15,z:0},
      {x:0.72,y:0.26,z:0},{x:0.70,y:0.36,z:0},{x:0.50,y:0.41,z:0},{x:0.225,y:0.41,z:0}
    ]},
    { type:'spline', closed:false, points:[
      {x:0.225,y:0.41,z:0},{x:0.54,y:0.41,z:0},{x:0.74,y:0.47,z:0},
      {x:0.775,y:0.57,z:0},{x:0.74,y:0.67,z:0},{x:0.54,y:0.72,z:0},{x:0.225,y:0.72,z:0}
    ]},
  ],
  'C': [
    { type:'spline', closed:false, points:[
      {x:0.79,y:0.22,z:0},{x:0.68,y:0.10,z:0},{x:0.50,y:0.10,z:0},
      {x:0.29,y:0.13,z:0},{x:0.18,y:0.27,z:0},{x:0.17,y:0.41,z:0},
      {x:0.18,y:0.55,z:0},{x:0.29,y:0.69,z:0},{x:0.50,y:0.72,z:0},
      {x:0.68,y:0.72,z:0},{x:0.79,y:0.60,z:0}
    ]},
  ],
  'D': [
    { type:'spline', closed:false, points:[
      {x:0.20,y:0.10,z:0},{x:0.20,y:0.72,z:0}
    ]},
    { type:'spline', closed:false, points:[
      {x:0.20,y:0.10,z:0},{x:0.45,y:0.10,z:0},{x:0.71,y:0.17,z:0},
      {x:0.81,y:0.41,z:0},{x:0.71,y:0.65,z:0},{x:0.45,y:0.72,z:0},{x:0.20,y:0.72,z:0}
    ]},
  ],
  'E': [
    { type:'spline', closed:false, points:[{x:0.24,y:0.10,z:0},{x:0.24,y:0.72,z:0}] },
    { type:'spline', closed:false, points:[{x:0.24,y:0.10,z:0},{x:0.76,y:0.10,z:0}] },
    { type:'spline', closed:false, points:[{x:0.24,y:0.41,z:0},{x:0.65,y:0.41,z:0}] },
    { type:'spline', closed:false, points:[{x:0.24,y:0.72,z:0},{x:0.76,y:0.72,z:0}] },
  ],
  'F': [
    { type:'spline', closed:false, points:[{x:0.255,y:0.10,z:0},{x:0.255,y:0.72,z:0}] },
    { type:'spline', closed:false, points:[{x:0.255,y:0.10,z:0},{x:0.745,y:0.10,z:0}] },
    { type:'spline', closed:false, points:[{x:0.255,y:0.41,z:0},{x:0.65,y:0.41,z:0}] },
  ],
  'G': [
    { type:'spline', closed:false, points:[
      {x:0.79,y:0.22,z:0},{x:0.68,y:0.10,z:0},{x:0.50,y:0.10,z:0},
      {x:0.29,y:0.13,z:0},{x:0.18,y:0.27,z:0},{x:0.17,y:0.41,z:0},
      {x:0.18,y:0.55,z:0},{x:0.29,y:0.69,z:0},{x:0.50,y:0.72,z:0},
      {x:0.68,y:0.72,z:0},{x:0.79,y:0.61,z:0},{x:0.79,y:0.41,z:0}
    ]},
    { type:'spline', closed:false, points:[
      {x:0.79,y:0.41,z:0},{x:0.52,y:0.41,z:0}
    ]},
  ],
  'H': [
    { type:'spline', closed:false, points:[{x:0.18,y:0.10,z:0},{x:0.18,y:0.72,z:0}] },
    { type:'spline', closed:false, points:[{x:0.82,y:0.10,z:0},{x:0.82,y:0.72,z:0}] },
    { type:'spline', closed:false, points:[{x:0.18,y:0.41,z:0},{x:0.82,y:0.41,z:0}] },
  ],
  'I': [
    { type:'spline', closed:false, points:[{x:0.35,y:0.10,z:0},{x:0.65,y:0.10,z:0}] },
    { type:'spline', closed:false, points:[{x:0.50,y:0.10,z:0},{x:0.50,y:0.72,z:0}] },
    { type:'spline', closed:false, points:[{x:0.35,y:0.72,z:0},{x:0.65,y:0.72,z:0}] },
  ],
  'J': [
    { type:'spline', closed:false, points:[{x:0.31,y:0.10,z:0},{x:0.69,y:0.10,z:0}] },
    { type:'spline', closed:false, points:[
      {x:0.57,y:0.10,z:0},{x:0.57,y:0.57,z:0},{x:0.50,y:0.69,z:0},
      {x:0.38,y:0.72,z:0},{x:0.27,y:0.68,z:0},{x:0.23,y:0.57,z:0}
    ]},
  ],
  'K': [
    { type:'spline', closed:false, points:[{x:0.205,y:0.10,z:0},{x:0.205,y:0.72,z:0}] },
    { type:'spline', closed:false, points:[{x:0.795,y:0.10,z:0},{x:0.205,y:0.43,z:0}] },
    { type:'spline', closed:false, points:[{x:0.205,y:0.43,z:0},{x:0.795,y:0.72,z:0}] },
  ],
  'L': [
    { type:'spline', closed:false, points:[{x:0.22,y:0.10,z:0},{x:0.22,y:0.72,z:0}] },
    { type:'spline', closed:false, points:[{x:0.22,y:0.72,z:0},{x:0.75,y:0.72,z:0}] },
  ],
  'M': [
    { type:'spline', closed:false, points:[
      {x:0.12,y:0.72,z:0},{x:0.12,y:0.10,z:0},{x:0.50,y:0.54,z:0},
      {x:0.88,y:0.10,z:0},{x:0.88,y:0.72,z:0}
    ]},
  ],
  'N': [
    { type:'spline', closed:false, points:[
      {x:0.18,y:0.72,z:0},{x:0.18,y:0.10,z:0},{x:0.82,y:0.72,z:0},{x:0.82,y:0.10,z:0}
    ]},
  ],
  'O': [
    { type:'spline', closed:true, points:[
      {x:0.817,y:0.41,z:0},{x:0.724,y:0.191,z:0},{x:0.50,y:0.10,z:0},
      {x:0.276,y:0.191,z:0},{x:0.183,y:0.41,z:0},{x:0.276,y:0.629,z:0},
      {x:0.50,y:0.72,z:0},{x:0.724,y:0.629,z:0}
    ]},
  ],
  'P': [
    { type:'spline', closed:false, points:[{x:0.225,y:0.10,z:0},{x:0.225,y:0.72,z:0}] },
    { type:'spline', closed:false, points:[
      {x:0.225,y:0.10,z:0},{x:0.52,y:0.10,z:0},{x:0.71,y:0.16,z:0},
      {x:0.775,y:0.27,z:0},{x:0.775,y:0.35,z:0},{x:0.71,y:0.41,z:0},
      {x:0.52,y:0.41,z:0},{x:0.225,y:0.41,z:0}
    ]},
  ],
  'Q': [
    { type:'spline', closed:true, points:[
      {x:0.817,y:0.41,z:0},{x:0.724,y:0.191,z:0},{x:0.50,y:0.10,z:0},
      {x:0.276,y:0.191,z:0},{x:0.183,y:0.41,z:0},{x:0.276,y:0.629,z:0},
      {x:0.50,y:0.72,z:0},{x:0.724,y:0.629,z:0}
    ]},
    { type:'spline', closed:false, points:[
      {x:0.60,y:0.60,z:0},{x:0.73,y:0.72,z:0},{x:0.83,y:0.76,z:0}
    ]},
  ],
  'R': [
    { type:'spline', closed:false, points:[{x:0.225,y:0.10,z:0},{x:0.225,y:0.72,z:0}] },
    { type:'spline', closed:false, points:[
      {x:0.225,y:0.10,z:0},{x:0.52,y:0.10,z:0},{x:0.71,y:0.16,z:0},
      {x:0.775,y:0.27,z:0},{x:0.775,y:0.35,z:0},{x:0.71,y:0.41,z:0},
      {x:0.52,y:0.41,z:0},{x:0.225,y:0.41,z:0}
    ]},
    { type:'spline', closed:false, points:[
      {x:0.52,y:0.41,z:0},{x:0.775,y:0.72,z:0}
    ]},
  ],
  'S': [
    { type:'spline', closed:false, points:[
      {x:0.77,y:0.19,z:0},{x:0.66,y:0.10,z:0},{x:0.45,y:0.10,z:0},
      {x:0.26,y:0.17,z:0},{x:0.24,y:0.28,z:0},{x:0.32,y:0.37,z:0},
      {x:0.50,y:0.41,z:0},{x:0.68,y:0.45,z:0},{x:0.76,y:0.55,z:0},
      {x:0.74,y:0.65,z:0},{x:0.55,y:0.72,z:0},{x:0.34,y:0.72,z:0},{x:0.23,y:0.63,z:0}
    ]},
  ],
  'T': [
    { type:'spline', closed:false, points:[{x:0.23,y:0.10,z:0},{x:0.77,y:0.10,z:0}] },
    { type:'spline', closed:false, points:[{x:0.50,y:0.10,z:0},{x:0.50,y:0.72,z:0}] },
  ],
  'U': [
    { type:'spline', closed:false, points:[
      {x:0.19,y:0.10,z:0},{x:0.19,y:0.57,z:0},{x:0.23,y:0.66,z:0},
      {x:0.33,y:0.72,z:0},{x:0.50,y:0.72,z:0},{x:0.67,y:0.72,z:0},
      {x:0.77,y:0.66,z:0},{x:0.81,y:0.57,z:0},{x:0.81,y:0.10,z:0}
    ]},
  ],
  'V': [
    { type:'spline', closed:false, points:[
      {x:0.21,y:0.10,z:0},{x:0.50,y:0.72,z:0},{x:0.79,y:0.10,z:0}
    ]},
  ],
  'W': [
    { type:'spline', closed:false, points:[
      {x:0.105,y:0.10,z:0},{x:0.27,y:0.72,z:0},{x:0.50,y:0.37,z:0},
      {x:0.73,y:0.72,z:0},{x:0.895,y:0.10,z:0}
    ]},
  ],
  'X': [
    { type:'spline', closed:false, points:[{x:0.21,y:0.10,z:0},{x:0.79,y:0.72,z:0}] },
    { type:'spline', closed:false, points:[{x:0.79,y:0.10,z:0},{x:0.21,y:0.72,z:0}] },
  ],
  'Y': [
    { type:'spline', closed:false, points:[{x:0.225,y:0.10,z:0},{x:0.50,y:0.44,z:0}] },
    { type:'spline', closed:false, points:[{x:0.775,y:0.10,z:0},{x:0.50,y:0.44,z:0}] },
    { type:'spline', closed:false, points:[{x:0.50,y:0.44,z:0},{x:0.50,y:0.72,z:0}] },
  ],
  'Z': [
    { type:'spline', closed:false, points:[{x:0.23,y:0.10,z:0},{x:0.77,y:0.10,z:0}] },
    { type:'spline', closed:false, points:[{x:0.77,y:0.10,z:0},{x:0.23,y:0.72,z:0}] },
    { type:'spline', closed:false, points:[{x:0.23,y:0.72,z:0},{x:0.77,y:0.72,z:0}] },
  ],
};

// Stored custom glyphs: 'A' → [{type, closed, points:[{x,y,z}]}]  (x,y normalised 0..1)
var fontGlyphs = {};

// State snapshot taken when entering font mode
var _fontSaved = null;

// ─── Coordinate helpers ───────────────────────────────────────────────────────

function designBoxOrigin() {
  var s   = canvasCSS();
  // When font panel is open, offset design box rightward so it's centred
  // in the canvas area to the right of the sidebar.
  var off = state.fontMode ? FONT_SIDEBAR_W : 0;
  return {
    x: off + (s.w - off - DESIGN_W) / 2,
    y: (s.h - DESIGN_H) / 2,
  };
}

function ptToGlyph(pt) {
  var o = designBoxOrigin();
  return { x: (pt.x - o.x) / DESIGN_W, y: (pt.y - o.y) / DESIGN_H, z: pt.z || 0 };
}

function ptToCanvas(gpt) {
  var o = designBoxOrigin();
  return { x: gpt.x * DESIGN_W + o.x, y: gpt.y * DESIGN_H + o.y, z: gpt.z || 0 };
}

// ─── Glyph save / load ────────────────────────────────────────────────────────

function saveFontGlyph() {
  var L = state.fontCurrentLetter;
  fontGlyphs[L] = state.curves
    .filter(function(c) { return c.points.length > 0; })
    .map(function(c) {
      return { type: c.type, closed: !!c.closed, points: c.points.map(ptToGlyph) };
    });
  updateLetterGrid();
}

function loadFontGlyph(letter) {
  // Prefer custom glyph; fall back to Arial default
  var g = fontGlyphs[letter];
  if (!g || !g.length) g = ARIAL_GLYPHS[letter] || null;

  if (g && g.length) {
    state.curves = g.map(function(c) {
      var pts = c.points.map(ptToCanvas);
      var curve = { type: c.type, closed: !!c.closed, points: pts, segments: [] };
      recomputeSegments(curve);
      return curve;
    });
  } else {
    state.curves = [{ type: 'bezier', points: [], segments: [] }];
  }
  state.activeCurveIdx = 0;
  state.hover    = null;
  state.dragging = null;
  setSelectedPoint(null);
}

// ─── Reset a letter back to the Arial default ─────────────────────────────────

function resetLetterToArial() {
  var L = state.fontCurrentLetter;
  delete fontGlyphs[L];
  state.history    = [];
  state.historyIdx = -1;
  loadFontGlyph(L);
  pushHistory();
  updateUndoRedo();
  updateLetterGrid();
  updateHint();
  render();
}

// ─── Mode enter / exit ────────────────────────────────────────────────────────

function enterFontMode() {
  if (state.fontMode) return;

  _fontSaved = {
    curves:      JSON.parse(JSON.stringify(state.curves)),
    activeIdx:   state.activeCurveIdx,
    curveType:   state.curveType,
    mode:        state.mode,
    history:     state.history,
    historyIdx:  state.historyIdx,
  };

  state.fontMode = true;
  document.getElementById('btn-font').classList.add('active');

  // Stop any running animations
  if (state.animating) {
    state.animating = false;
    var ab = document.getElementById('animate-btn');
    if (ab) { ab.textContent = '▶ Animate'; ab.classList.remove('active'); }
    if (typeof _animFrame !== 'undefined' && _animFrame) cancelAnimationFrame(_animFrame);
  }
  if (state.showMarker) {
    state.showMarker = false;
    var mc = document.getElementById('show-marker');
    if (mc) mc.checked = false;
    stopMarkerAnim();
  }

  // Ensure free mode (no math overlay while drawing letters)
  if (state.mode !== 'free') {
    state.mode = 'free';
    document.getElementById('btn-free').classList.add('active');
    document.getElementById('btn-math').classList.remove('active');
    mathPanel.classList.remove('open');
  }

  // Fresh undo history for letter editing
  state.history   = [];
  state.historyIdx = -1;

  _updateFontHeader();
  document.getElementById('font-panel').classList.add('open');
  loadFontGlyph(state.fontCurrentLetter);
  updateLetterGrid();
  pushHistory();
  updateUndoRedo();
  updateHint();
  resizeCanvas();
}

function exitFontMode() {
  if (!state.fontMode) return;
  saveFontGlyph();

  state.fontMode = false;
  document.getElementById('btn-font').classList.remove('active');
  document.getElementById('font-panel').classList.remove('open');

  if (_fontSaved) {
    state.curves         = _fontSaved.curves;
    state.activeCurveIdx = _fontSaved.activeIdx;
    state.curveType      = _fontSaved.curveType;
    state.history        = _fontSaved.history;
    state.historyIdx     = _fontSaved.historyIdx;
    recomputeAllSegments();
    _fontSaved = null;
  }

  updateUndoRedo();
  updateHint();
  resizeCanvas();
}

function switchFontLetter(letter) {
  if (letter === state.fontCurrentLetter) return;
  saveFontGlyph();
  state.fontCurrentLetter = letter;
  _updateFontHeader();
  loadFontGlyph(letter);
  state.history    = [];
  state.historyIdx = -1;
  pushHistory();
  updateUndoRedo();
  updateLetterGrid();
  updateHint();
  render();
}

function _updateFontHeader() {
  var L = state.fontCurrentLetter;
  var disp = document.getElementById('font-current-display');
  var name = document.getElementById('font-current-name');
  if (disp) disp.textContent = L;
  if (name) name.textContent = 'Letter ' + L;
}

// ─── Guide rendering ──────────────────────────────────────────────────────────

function drawFontGuides(ctx, w, h) {
  var o  = designBoxOrigin();
  var x0 = o.x, y0 = o.y;
  var x1 = x0 + DESIGN_W, y1 = y0 + DESIGN_H;

  ctx.save();

  // Design box
  ctx.strokeStyle = 'rgba(100,120,220,0.25)';
  ctx.lineWidth   = 1;
  ctx.setLineDash([6, 5]);
  ctx.strokeRect(x0, y0, DESIGN_W, DESIGN_H);
  ctx.setLineDash([]);

  // Horizontal guide lines
  var guides = [
    { frac: GUIDE_CAP,  color: 'rgba(70,150,255,0.55)',  label: 'cap' },
    { frac: GUIDE_X,    color: 'rgba(60,210,110,0.45)',  label: 'x-height' },
    { frac: GUIDE_BASE, color: 'rgba(255,175,55,0.75)',  label: 'baseline' },
    { frac: GUIDE_DESC, color: 'rgba(255,75,75,0.45)',   label: 'descender' },
  ];

  ctx.font = '10px monospace';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'middle';

  guides.forEach(function(g) {
    var gy = y0 + g.frac * DESIGN_H;
    ctx.strokeStyle = g.color;
    ctx.fillStyle   = g.color;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(x0 - 10, gy);
    ctx.lineTo(x1 + 10, gy);
    ctx.stroke();
    ctx.fillText(g.label, x1 + 14, gy);
  });

  // Soft left / right bearing guides at 10% / 90%
  ctx.strokeStyle = 'rgba(120,120,200,0.18)';
  ctx.lineWidth   = 1;
  ctx.setLineDash([3, 4]);
  [0.10, 0.90].forEach(function(fx) {
    var gx = x0 + fx * DESIGN_W;
    ctx.beginPath();
    ctx.moveTo(gx, y0);
    ctx.lineTo(gx, y1);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  ctx.restore();
}

// ─── Preview canvas rendering ─────────────────────────────────────────────────

function updateFontPreview() {
  var pc = document.getElementById('font-preview-canvas');
  if (!pc) return;
  var pw = pc.width, ph = pc.height;
  var pctx = pc.getContext('2d');

  pctx.fillStyle = C.bg;
  pctx.fillRect(0, 0, pw, ph);

  var text = (state.fontPreviewText || '').toUpperCase();
  if (!text) {
    pctx.fillStyle   = 'rgba(140,150,160,0.55)';
    pctx.font        = '11px monospace';
    pctx.textAlign   = 'left';
    pctx.fillText('type above to preview', 6, ph / 2 + 4);
    return;
  }

  // Scale so cap→baseline height fills ~70% of the preview canvas height
  var capToBase = (GUIDE_BASE - GUIDE_CAP) * DESIGN_H;
  var scale     = (ph * 0.70) / capToBase;
  var letterW   = DESIGN_W * scale;
  var gap       = letterW * 0.06;
  var baseY     = ph * 0.82;
  var strokeW   = Math.max(1.5, letterW * 0.048);

  // Faint baseline
  pctx.strokeStyle = 'rgba(255,175,55,0.22)';
  pctx.lineWidth   = 0.5;
  pctx.beginPath();
  pctx.moveTo(0, baseY);
  pctx.lineTo(pw, baseY);
  pctx.stroke();

  var curX = 4;

  text.split('').forEach(function(ch) {
    if (!/[A-Z]/.test(ch)) {
      curX += letterW * 0.35 + gap;   // space
      return;
    }

    var isLive = (ch === state.fontCurrentLetter);
    var curves;

    if (isLive) {
      curves = state.curves;
    } else {
      var raw = fontGlyphs[ch];
      if (!raw || !raw.length) raw = ARIAL_GLYPHS[ch] || null;
      if (!raw || !raw.length) { curX += letterW * 0.65 + gap; return; }
      curves = raw;
    }

    curves.forEach(function(curve) {
      if (!curve.points || curve.points.length < 2) return;

      function mapPt(p) {
        var nx, ny;
        if (isLive) {
          var bo = designBoxOrigin();
          nx = (p.x - bo.x) / DESIGN_W;
          ny = (p.y - bo.y) / DESIGN_H;
        } else {
          nx = p.x; ny = p.y;   // already normalised
        }
        return {
          x: curX + nx * letterW,
          y: baseY + (ny - GUIDE_BASE) * DESIGN_H * scale,
          z: 0,
        };
      }

      var mapped = curve.points.map(mapPt);

      if (curve.type === 'bezier') {
        drawBezierCurve(pctx, mapped, { width: strokeW, glow: false, color: C.curve });
      } else {
        var segs = naturalCubicToSegments(mapped, curve.closed);
        drawSplineCurve(pctx, segs, { width: strokeW, glow: false, color: C.curve });
      }
    });

    curX += letterW * 0.65 + gap;
  });
}

// ─── Big preview overlay ──────────────────────────────────────────────────────

function _renderBigPreview(text) {
  var pc = document.getElementById('font-big-preview-canvas');
  if (!pc) return;

  // Canvas fills its container; read CSS size
  var rect = pc.getBoundingClientRect();
  var pw = Math.round(rect.width || 900);
  var rows = Math.ceil((text.length || 1) / 18);  // ~18 chars per row
  rows = Math.max(1, Math.min(rows, 6));
  var ph = Math.round(rows * pw * 0.16);
  if (pc.width !== pw || pc.height !== ph) { pc.width = pw; pc.height = ph; }

  var pctx = pc.getContext('2d');
  pctx.fillStyle = C.bg;
  pctx.fillRect(0, 0, pw, ph);

  if (!text) return;

  var capToBase = (GUIDE_BASE - GUIDE_CAP) * DESIGN_H;
  var rowH      = ph / rows;
  var scale     = (rowH * 0.70) / capToBase;
  var letterW   = DESIGN_W * scale;
  var gap       = letterW * 0.06;
  var strokeW   = Math.max(1.5, letterW * 0.048);

  var chars = text.toUpperCase().split('');
  var curRow = 0, curX = 6;

  for (var ci = 0; ci < chars.length; ci++) {
    var ch = chars[ci];
    var baseY = rowH * curRow + rowH * 0.82;

    if (ch === ' ') {
      curX += letterW * 0.35 + gap;
    } else if (/[A-Z]/.test(ch)) {
      var isLive = (ch === state.fontCurrentLetter);
      var curves;
      if (isLive) {
        curves = state.curves;
      } else {
        var raw = fontGlyphs[ch];
        if (!raw || !raw.length) raw = ARIAL_GLYPHS[ch] || null;
        if (!raw || !raw.length) { curX += letterW * 0.65 + gap; continue; }
        curves = raw;
      }

      curves.forEach(function(curve) {
        if (!curve.points || curve.points.length < 2) return;
        function mapBigPt(p) {
          var nx, ny;
          if (isLive) {
            var bo = designBoxOrigin();
            nx = (p.x - bo.x) / DESIGN_W;
            ny = (p.y - bo.y) / DESIGN_H;
          } else {
            nx = p.x; ny = p.y;
          }
          return { x: curX + nx * letterW, y: baseY + (ny - GUIDE_BASE) * DESIGN_H * scale, z: 0 };
        }
        var mapped = curve.points.map(mapBigPt);
        if (curve.type === 'bezier') {
          drawBezierCurve(pctx, mapped, { width: strokeW, glow: false, color: C.curve });
        } else {
          var segs = naturalCubicToSegments(mapped, curve.closed);
          drawSplineCurve(pctx, segs, { width: strokeW, glow: false, color: C.curve });
        }
      });
      curX += letterW * 0.65 + gap;
    }

    // Wrap to next row when running out of width
    if (curX + letterW > pw - 6 && ci < chars.length - 1) {
      curRow++;
      curX = 6;
      if (curRow >= rows) break;
    }
  }
}

function showBigPreview() {
  var overlay = document.getElementById('font-big-preview');
  if (!overlay) return;
  overlay.style.display = 'flex';

  // Sync text from sidebar input
  var text = state.fontPreviewText || '';
  var bigInp = document.getElementById('font-big-preview-input');
  if (bigInp) bigInp.value = text;

  // Defer render until layout is done so getBoundingClientRect is accurate
  requestAnimationFrame(function() { _renderBigPreview(text); });
}

function hideBigPreview() {
  var overlay = document.getElementById('font-big-preview');
  if (overlay) overlay.style.display = 'none';
}

// ─── Letter grid ──────────────────────────────────────────────────────────────

function updateLetterGrid() {
  var grid = document.getElementById('font-letter-grid');
  if (!grid) return;
  grid.innerHTML = '';
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(function(L) {
    var isActive   = (L === state.fontCurrentLetter);
    var isModified = !!(fontGlyphs[L] && fontGlyphs[L].length);
    var cls = 'font-letter-btn';
    if (isActive)   cls += ' active';
    if (isModified) cls += ' modified';
    var btn = document.createElement('button');
    btn.className   = cls;
    btn.textContent = L;
    btn.title       = isModified ? 'Letter ' + L + ' (customised)' : 'Letter ' + L + ' (Arial default)';
    btn.addEventListener('click', function() { switchFontLetter(L); });
    grid.appendChild(btn);
  });
}

// ─── Init (called from app.js after state is ready) ──────────────────────────

function initFont() {
  document.getElementById('btn-font').addEventListener('click', function() {
    if (state.fontMode) exitFontMode(); else enterFontMode();
  });

  document.getElementById('font-close-btn').addEventListener('click', exitFontMode);

  document.getElementById('font-add-stroke').addEventListener('click', function() {
    if (state.fontMode) newCurve();
  });

  document.getElementById('font-clear-letter').addEventListener('click', function() {
    if (state.fontMode) clearAll();
  });

  document.getElementById('font-reset-arial').addEventListener('click', function() {
    if (state.fontMode) resetLetterToArial();
  });

  var inp = document.getElementById('font-preview-input');
  if (inp) {
    inp.addEventListener('input', function() {
      state.fontPreviewText = this.value;
      updateFontPreview();
    });
  }

  var expandBtn = document.getElementById('font-expand-btn');
  if (expandBtn) expandBtn.addEventListener('click', showBigPreview);

  var bigClose = document.getElementById('font-big-preview-close');
  if (bigClose) bigClose.addEventListener('click', hideBigPreview);

  var bigInp = document.getElementById('font-big-preview-input');
  if (bigInp) {
    bigInp.addEventListener('input', function() {
      state.fontPreviewText = this.value;
      // sync sidebar input too
      var si = document.getElementById('font-preview-input');
      if (si) si.value = this.value;
      updateFontPreview();
      _renderBigPreview(this.value.toUpperCase());
    });
  }

  // Close big preview on Escape
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var overlay = document.getElementById('font-big-preview');
      if (overlay && overlay.style.display !== 'none') { hideBigPreview(); e.stopPropagation(); }
    }
  }, true);

  updateLetterGrid();
}
