// math.js — Pure mathematical functions (2D + 3D Bezier, Catmull-Rom splines)

// ─── Combinatorics ────────────────────────────────────────────────────────────

const _binomCache = (() => {
  const c = [];
  for (let n = 0; n <= 10; n++) {
    c[n] = [];
    for (let k = 0; k <= n; k++)
      c[n][k] = (k === 0 || k === n) ? 1 : c[n-1][k-1] + c[n-1][k];
  }
  return c;
})();

function binomial(n, k) {
  if (k < 0 || k > n) return 0;
  if (n <= 10) return _binomCache[n][k];
  let r = 1;
  for (let i = 0; i < Math.min(k, n - k); i++) r = r * (n - i) / (i + 1);
  return Math.round(r);
}

// ─── Bernstein ────────────────────────────────────────────────────────────────

function bernstein(n, i, t) {
  return binomial(n, i) * Math.pow(t, i) * Math.pow(1 - t, n - i);
}

function allBernstein(n, t) {
  const v = [];
  for (let i = 0; i <= n; i++) v.push(bernstein(n, i, t));
  return v;
}

// ─── Bezier (works in 2D and 3D — z defaults to 0) ───────────────────────────

function evalBezier(points, t) {
  const n = points.length - 1;
  if (n < 0) return { x: 0, y: 0, z: 0 };
  if (n === 0) return { x: points[0].x, y: points[0].y, z: points[0].z || 0 };
  let x = 0, y = 0, z = 0;
  for (let i = 0; i <= n; i++) {
    const b = bernstein(n, i, t);
    x += b * points[i].x;
    y += b * points[i].y;
    z += b * (points[i].z || 0);
  }
  return { x, y, z };
}

// Returns all de Casteljau levels. Works for 3D points.
function deCasteljau(points, t) {
  const levels = [points.map(p => ({ x: p.x, y: p.y, z: p.z || 0 }))];
  let cur = levels[0];
  while (cur.length > 1) {
    const next = [];
    for (let i = 0; i < cur.length - 1; i++) {
      next.push({
        x: (1 - t) * cur[i].x + t * cur[i+1].x,
        y: (1 - t) * cur[i].y + t * cur[i+1].y,
        z: (1 - t) * (cur[i].z || 0) + t * (cur[i+1].z || 0),
      });
    }
    levels.push(next);
    cur = next;
  }
  return levels;
}

function bezierTangent(points, t) {
  const n = points.length - 1;
  if (n < 1) return { x: 0, y: 0, z: 0 };
  const d = [];
  for (let i = 0; i < n; i++) {
    d.push({
      x: n * (points[i+1].x - points[i].x),
      y: n * (points[i+1].y - points[i].y),
      z: n * ((points[i+1].z || 0) - (points[i].z || 0)),
    });
  }
  return evalBezier(d, t);
}

function sampleBezier(points, steps) {
  steps = steps || 200;
  const r = [];
  for (let i = 0; i <= steps; i++) r.push(evalBezier(points, i / steps));
  return r;
}

// ─── Natural Cubic Spline → Bezier segments (C², 3D-aware) ──────────────────
//
// Enforces C² continuity by solving the tridiagonal system:
//   M[i-1] + 4·M[i] + M[i+1] = 6·(P[i+1] − 2·P[i] + P[i-1])
// for the second derivatives M[i] at each knot.
// Natural (open) BCs: M[0] = M[n-1] = 0.
// Closed curves use a cyclic tridiagonal system (Sherman-Morrison).
//
// Bezier control points for segment P[i]→P[i+1]:
//   B0 = P[i]
//   B1 = P[i] + (P[i+1]−P[i])/3 − M[i]/9  − M[i+1]/18
//   B2 = P[i+1] − (P[i+1]−P[i])/3 − M[i]/18 − M[i+1]/9
//   B3 = P[i+1]

// Solve the open (natural) system for a single scalar component.
// Returns array of n second-derivative values; M[0]=M[n-1]=0.
function _openNaturalM(P) {
  const n = P.length;
  const M = new Array(n).fill(0);
  if (n <= 2) return M;
  const m = n - 2;                   // number of interior unknowns

  // Build RHS
  const b = new Array(m).fill(4);   // main diagonal (all 4)
  const d = new Array(m);
  for (let i = 0; i < m; i++) d[i] = 6 * (P[i+2] - 2*P[i+1] + P[i]);

  // Forward sweep — eliminate lower diagonal (all 1s)
  for (let i = 1; i < m; i++) {
    const w = 1 / b[i-1];
    b[i] -= w;           // b[i] = b[i] − w·upper[i-1];  upper = 1
    d[i] -= w * d[i-1];
  }

  // Back substitution
  M[m] = d[m-1] / b[m-1];                            // M[n-2]
  for (let i = m-2; i >= 0; i--) M[i+1] = (d[i] - M[i+2]) / b[i];
  return M;
}

// Solve the cyclic (closed) system for a single scalar component.
// Uses Sherman-Morrison: removes the corner entries via a rank-1 correction.
function _closedNaturalM(P) {
  const n = P.length;

  const rhs = new Array(n);
  for (let i = 0; i < n; i++)
    rhs[i] = 6 * (P[(i+1)%n] - 2*P[i] + P[(i-1+n)%n]);

  if (n === 2) {
    // 2×2: [4,2; 2,4]·M = rhs
    const det = 12;
    return [(4*rhs[0] - 2*rhs[1])/det, (4*rhs[1] - 2*rhs[0])/det];
  }

  // Sherman-Morrison: A = B + u·vᵀ
  // Choose γ = −4 so B[0][0] = 8, B[n-1][n-1] = 4.25, corners become 0.
  const gamma = -4;
  const bDiag = new Array(n).fill(4);
  bDiag[0]   -= gamma;        // 8
  bDiag[n-1] -= 1 / gamma;   // 4.25

  const uVec = new Array(n).fill(0); uVec[0] = gamma; uVec[n-1] = 1;
  const vVec = new Array(n).fill(0); vVec[0] = 1;     vVec[n-1] = 1 / gamma;

  function solveTridiag(diag, rhs) {
    const nn = diag.length;
    const b = [...diag], d = [...rhs];
    for (let i = 1; i < nn; i++) {
      const w = 1 / b[i-1];
      b[i] -= w;
      d[i] -= w * d[i-1];
    }
    const x = new Array(nn);
    x[nn-1] = d[nn-1] / b[nn-1];
    for (let i = nn-2; i >= 0; i--) x[i] = (d[i] - x[i+1]) / b[i];
    return x;
  }

  const y = solveTridiag(bDiag, rhs);
  const q = solveTridiag(bDiag, uVec);

  const vtY = vVec[0]*y[0] + vVec[n-1]*y[n-1];
  const vtQ = vVec[0]*q[0] + vVec[n-1]*q[n-1];
  const fac = vtY / (1 + vtQ);

  return y.map((yi, i) => yi - fac * q[i]);
}

function naturalCubicToSegments(knots, closed) {
  const n = knots.length;
  if (n < 2) return [];

  // Solve second derivatives per component
  function getM(coord) {
    const P = knots.map(k => k[coord] || 0);
    return closed ? _closedNaturalM(P) : _openNaturalM(P);
  }
  const Mx = getM('x'), My = getM('y'), Mz = getM('z');

  const numSegs = closed ? n : n - 1;
  const segs = [];
  for (let i = 0; i < numSegs; i++) {
    const j = (i + 1) % n;
    const [p0x, p0y, p0z] = [knots[i].x, knots[i].y, knots[i].z||0];
    const [p1x, p1y, p1z] = [knots[j].x, knots[j].y, knots[j].z||0];
    const [m0x, m0y, m0z] = [Mx[i], My[i], Mz[i]];
    const [m1x, m1y, m1z] = [Mx[j], My[j], Mz[j]];
    segs.push([
      { x: p0x,                                       y: p0y,                                       z: p0z },
      { x: p0x+(p1x-p0x)/3-m0x/9-m1x/18,             y: p0y+(p1y-p0y)/3-m0y/9-m1y/18,             z: p0z+(p1z-p0z)/3-m0z/9-m1z/18 },
      { x: p1x-(p1x-p0x)/3-m0x/18-m1x/9,             y: p1y-(p1y-p0y)/3-m0y/18-m1y/9,             z: p1z-(p1z-p0z)/3-m0z/18-m1z/9 },
      { x: p1x,                                       y: p1y,                                       z: p1z },
    ]);
  }
  return segs;
}

function evalSpline(segments, globalT) {
  if (!segments.length) return null;
  const n = segments.length;
  const scaled = globalT * n;
  const segIdx = Math.min(Math.floor(scaled), n - 1);
  const localT = scaled - segIdx;
  return { point: evalBezier(segments[segIdx], localT), segIdx, localT };
}

// ─── 3D Camera Projection ─────────────────────────────────────────────────────

// Projects a 3D world point to 2D screen coords given camera yaw/pitch.
// cx, cy = canvas center (pivot).
function project3D(p, cam, cx, cy) {
  const cosY = Math.cos(cam.yaw),   sinY = Math.sin(cam.yaw);
  const cosP = Math.cos(cam.pitch), sinP = Math.sin(cam.pitch);
  // Translate to center
  const x = p.x - cx, y = p.y - cy, z = p.z || 0;
  // Yaw (around Y)
  const rx  =  x * cosY - z * sinY;
  const ry  =  y;
  const rz  =  x * sinY + z * cosY;
  // Pitch (around X)
  const rx2 = rx;
  const ry2 = ry * cosP - rz * sinP;
  const rz2 = ry * sinP + rz * cosP;
  // Perspective
  const fov   = 900 * (cam.zoom || 1);
  const scale = fov / (fov + rz2);
  return { x: cx + rx2 * scale, y: cy + ry2 * scale, z: rz2, scale };
}

// Inverse projection: screen (sx,sy) → world point on the camera-front plane (rz2=0).
// Returns a world-space {x,y,z} point that projects exactly to (sx,sy).
function unprojectFront(sx, sy, cam, cx, cy) {
  const cosY = Math.cos(cam.yaw), sinY = Math.sin(cam.yaw);
  const cosP = Math.cos(cam.pitch), sinP = Math.sin(cam.pitch);
  // At rz2=0, scale = fov/(fov+0) = 1
  const rx2 = sx - cx;
  const ry2 = sy - cy;
  // Inverse pitch
  const rx = rx2;
  const ry = ry2 * cosP;
  const rz = -ry2 * sinP;
  // Inverse yaw → world coords (center-relative)
  const wx = rx * cosY + rz * sinY;
  const wy = ry;
  const wz = -rx * sinY + rz * cosY;
  return { x: wx + cx, y: wy + cy, z: wz };
}

// World-space delta corresponding to a screen-space drag (ddx, ddy) at rz2=0.
function screenDeltaToWorld(ddx, ddy, cam) {
  const cosY = Math.cos(cam.yaw), sinY = Math.sin(cam.yaw);
  const cosP = Math.cos(cam.pitch), sinP = Math.sin(cam.pitch);
  // Same inverse as above but for a delta (no translation terms)
  const rx2 = ddx, ry2 = ddy;
  const rx = rx2, ry = ry2 * cosP, rz = -ry2 * sinP;
  return {
    x: rx * cosY + rz * sinY,
    y: ry,
    z: -rx * sinY + rz * cosY,
  };
}
