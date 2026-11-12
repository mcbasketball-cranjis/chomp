/**
 * Trace each color as a subpixel, corner-aware vector outline.
 *
 * Marching squares places boundary vertices between pixel centers instead of
 * walking the pixel grid. Douglas-Peucker removes remaining stair steps and
 * smooth Bézier tangents join gradual turns without rounding hard corners.
 * Even/odd winding preserves holes, including counters in lettering.
 */
function simplifyOpen(points, tolerance) {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop();
    let distance = tolerance, split = -1;
    const a = points[start], b = points[end];
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
    for (let i = start + 1; i < end; i++) {
      const p = points[i];
      const d = length ? Math.abs(dx * (a[1] - p[1]) - (a[0] - p[0]) * dy) / length : Math.hypot(p[0] - a[0], p[1] - a[1]);
      if (d > distance) { distance = d; split = i; }
    }
    if (split >= 0) { keep[split] = 1; stack.push([start, split], [split, end]); }
  }
  return points.filter((_, i) => keep[i]);
}
function simplifyRing(points, tolerance) {
  if (points.length <= 4) return points;
  // Split the loop at its most distant point so the simplifier can see both
  // halves of the ring, including the closure, rather than leave a seam.
  const start = points[0];
  let farthest = 1, distance = 0;
  for (let i = 1; i < points.length; i++) {
    const d = (points[i][0] - start[0]) ** 2 + (points[i][1] - start[1]) ** 2;
    if (d > distance) { distance = d; farthest = i; }
  }
  const a = simplifyOpen(points.slice(0, farthest + 1), tolerance);
  const b = simplifyOpen([...points.slice(farthest), start], tolerance);
  const ring = [...a.slice(0, -1), ...b.slice(0, -1)];
  return ring.length >= 3 ? ring : points;
}
function areaOf(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(area / 2);
}
function format(n) { return String(Math.round(n * 100) / 100); }
function curvePath(points, minCornerLength = 1.65, maxBend = Infinity, cornerSharpness = 50) {
  const n = points.length;
  if (n < 3) return '';
  const tangent = [], corner = [];
  for (let i = 0; i < n; i++) {
    const p = points[i], before = points[(i + n - 1) % n], after = points[(i + 1) % n];
    const dx1 = p[0] - before[0], dy1 = p[1] - before[1], d1 = Math.hypot(dx1, dy1);
    const dx2 = after[0] - p[0], dy2 = after[1] - p[1], d2 = Math.hypot(dx2, dy2);
    const dot = d1 && d2 ? (dx1 * dx2 + dy1 * dy2) / (d1 * d2) : 1;
    // A long and abrupt turn is intentional (e.g. a square logo corner).
    // Short alternating turns along a diagonal raster edge are not.
    corner[i] = dot < (0.24 + 0.0048 * cornerSharpness) &&
      Math.min(d1, d2) >= minCornerLength * (1.35 - 0.007 * cornerSharpness);
    const tx = dx1 / (d1 || 1) + dx2 / (d2 || 1);
    const ty = dy1 / (d1 || 1) + dy2 / (d2 || 1);
    const norm = Math.hypot(tx, ty);
    tangent[i] = norm ? [tx / norm, ty / norm] : [dx2 / (d2 || 1), dy2 / (d2 || 1)];
  }
  // The short bevel at a rasterized square corner can make an otherwise
  // perfectly horizontal/vertical outline lean by half a pixel. Snap only
  // long, nearly axis-aligned spans between intentional sharp corners.
  const fixed = points.map(p => [...p]);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (!corner[i] || !corner[j]) continue;
    const dx = points[j][0] - points[i][0], dy = points[j][1] - points[i][1];
    if (Math.hypot(dx, dy) < 4) continue;
    if (Math.abs(dx) < Math.abs(dy) * 0.075) {
      fixed[i][0] = fixed[j][0] = (points[i][0] + points[j][0]) / 2;
    } else if (Math.abs(dy) < Math.abs(dx) * 0.075) {
      fixed[i][1] = fixed[j][1] = (points[i][1] + points[j][1]) / 2;
    }
  }
  let path = 'M' + format(fixed[0][0]) + ' ' + format(fixed[0][1]);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, p = fixed[i], q = fixed[j];
    const dx = q[0] - p[0], dy = q[1] - p[1], length = Math.hypot(dx, dy);
    if (!length) continue;
    const outgoing = corner[i] ? [dx / length, dy / length] : tangent[i];
    const incoming = corner[j] ? [dx / length, dy / length] : tangent[j];
    const isStraight = Math.abs(outgoing[0] * dy - outgoing[1] * dx) < 0.015 * length &&
      Math.abs(incoming[0] * dy - incoming[1] * dx) < 0.015 * length;
    // Short handles keep curves inside thin strokes and small letter counters.
    // In precision mode, reject curves that bend too far away from the measured
    // subpixel outline. This prevents lumpy glyphs and swollen thin strokes.
    const prev = fixed[(i + n - 1) % n], next = fixed[(j + 1) % n];
    const h1 = Math.min(length / 3, Math.hypot(p[0] - prev[0], p[1] - prev[1]) * .42);
    const h2 = Math.min(length / 3, Math.hypot(q[0] - next[0], q[1] - next[1]) * .42);
    const c1 = [p[0] + outgoing[0] * h1, p[1] + outgoing[1] * h1];
    const c2 = [q[0] - incoming[0] * h2, q[1] - incoming[1] * h2];
    // For a cubic Bézier, the midpoint is (P + 3*C1 + 3*C2 + Q) / 8.
    const bulge = Math.hypot(
      (3 * c1[0] + 3 * c2[0] - 3 * p[0] - 3 * q[0]) / 8,
      (3 * c1[1] + 3 * c2[1] - 3 * p[1] - 3 * q[1]) / 8
    );
    if (isStraight || length < 0.65 || bulge > maxBend) {
      path += 'L' + format(q[0]) + ' ' + format(q[1]);
      continue;
    }
    path += 'C' + format(c1[0]) + ' ' + format(c1[1]) + ' ' +
      format(c2[0]) + ' ' + format(c2[1]) + ' ' +
      format(q[0]) + ' ' + format(q[1]);
  }
  return path + 'Z';
}

export function smoothColorContours(indices, width, height, color, tolerance, minArea, cornerSharpness = 50) {
  // One ghost-pixel border lets the contour close naturally at the image edge.
  const stride = width + 2, mask = new Uint8Array((width + 2) * (height + 2));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (indices[y * width + x] === color) mask[(y + 1) * stride + x + 1] = 1;
  }
  const segments = [], adjacency = new Map();
  function key(point) { return point[0] + ',' + point[1]; }
  function add(a, b) {
    const index = segments.length;
    segments.push({ a, b, used: false });
    for (const point of [a, b]) {
      const k = key(point);
      if (!adjacency.has(k)) adjacency.set(k, []);
      adjacency.get(k).push(index);
    }
  }
  for (let y = 0; y <= height; y++) for (let x = 0; x <= width; x++) {
    const p = y * stride + x;
    const tl = mask[p], tr = mask[p + 1], bl = mask[p + stride], br = mask[p + stride + 1];
    // Almost all cells are uniform; don't allocate points for their interiors.
    if (tl === tr && tl === bl && tl === br) continue;
    const top = [x, y - .5], right = [x + .5, y], bottom = [x, y + .5], left = [x - .5, y];
    const active = [];
    if (tl !== tr) active.push(['top', top]);
    if (tr !== br) active.push(['right', right]);
    if (br !== bl) active.push(['bottom', bottom]);
    if (bl !== tl) active.push(['left', left]);
    if (active.length === 2) add(active[0][1], active[1][1]);
    else if (active.length === 4) {
      // Ambiguous diagonal islands must remain separate, never joined.
      if (tl) { add(top, left); add(right, bottom); }
      else { add(top, right); add(bottom, left); }
    }
  }
  const paths = [];
  for (const first of segments) {
    if (first.used) continue;
    const start = key(first.a), ring = [first.a];
    let current = first, endpoint = first.b, closed = false;
    while (current && !current.used) {
      current.used = true;
      if (key(endpoint) === start) { closed = true; break; }
      ring.push(endpoint);
      const candidates = adjacency.get(key(endpoint)) || [];
      const nextIndex = candidates.find(i => !segments[i].used);
      if (nextIndex === undefined) break;
      current = segments[nextIndex];
      endpoint = key(current.a) === key(endpoint) ? current.b : current.a;
    }
    if (!closed || ring.length < 3 || areaOf(ring) < minArea) continue;
    const simplified = simplifyRing(ring, tolerance);
    if (simplified.length >= 3) paths.push(curvePath(simplified, 1.65, Infinity, cornerSharpness));
  }
  return paths.join('');
}


/**
 * Subpixel contours for antialiased flat-color artwork, especially typography.
 *
 * A binary mask loses the coverage value of gray, antialiased edge pixels and
 * tends to shrink or disconnect thin glyph strokes. Here each pixel is a
 * continuous value in [0,1]; an isocontour is interpolated between adjacent
 * pixel centers where coverage crosses 50%. The result is actual editable SVG
 * geometry, not a raster image, filter, or embedded font.
 *
 * Only use this for the confidently detected flat-logo color layers. Photos,
 * already-transparent art and unrelated color regions keep the binary tracer.
 */
export function smoothCoverageContours(coverage, width, height, tolerance = .35, minArea = .5, maxCurveBend = Infinity, cornerSharpness = 50) {
  if (!coverage || coverage.length !== width * height) throw new Error('Invalid coverage raster.');
  const stride = width + 2, field = new Float32Array((width + 2) * (height + 2));
  for (let y = 0; y < height; y++) {
    const row = y * width, dst = (y + 1) * stride + 1;
    for (let x = 0; x < width; x++) field[dst + x] = coverage[row + x] / 255;
  }

  // Both sides of a shared cell edge get the same identifier. This avoids
  // comparing floating point coordinates, which can leave contours unclosed.
  const segments = [], adjacency = new Map(), threshold = .5;
  function add(a, b) {
    const id = segments.length;
    segments.push({ a, b, used: false });
    for (const v of [a, b]) {
      let edges = adjacency.get(v.key);
      if (!edges) adjacency.set(v.key, edges = []);
      edges.push(id);
    }
  }
  const lerp = (a, b) => {
    const diff = b - a;
    return Math.max(0, Math.min(1, diff ? (threshold - a) / diff : .5));
  };
  for (let y = 0; y <= height; y++) {
    for (let x = 0; x <= width; x++) {
      const i = y * stride + x;
      const tl = field[i], tr = field[i + 1];
      const bl = field[i + stride], br = field[i + stride + 1];
      const a = tl >= threshold, b = tr >= threshold, c = br >= threshold, d = bl >= threshold;
      if (a === b && a === c && a === d) continue;
      const crossings = [];
      if (a !== b) crossings.push({
        edge: 0, key: 'h:' + x + ',' + y,
        point: [x - 1 + lerp(tl, tr), y - 1]
      });
      if (b !== c) crossings.push({
        edge: 1, key: 'v:' + (x + 1) + ',' + y,
        point: [x, y - 1 + lerp(tr, br)]
      });
      if (d !== c) crossings.push({
        edge: 2, key: 'h:' + x + ',' + (y + 1),
        point: [x - 1 + lerp(bl, br), y]
      });
      if (a !== d) crossings.push({
        edge: 3, key: 'v:' + x + ',' + y,
        point: [x - 1, y - 1 + lerp(tl, bl)]
      });
      if (crossings.length === 2) {
        add(crossings[0], crossings[1]);
      } else if (crossings.length === 4) {
        // Keep diagonally touching glyph parts separate, preventing adjacent
        // characters and letter counters from being joined by a single pixel.
        const at = edge => crossings.find(v => v.edge === edge);
        if (a) {
          add(at(0), at(3));
          add(at(1), at(2));
        } else {
          add(at(0), at(1));
          add(at(2), at(3));
        }
      }
    }
  }
  const paths = [];
  for (const initial of segments) {
    if (initial.used) continue;
    let edge = initial, end = initial.b;
    const start = initial.a.key, ring = [initial.a.point];
    let closed = false;
    while (edge && !edge.used) {
      edge.used = true;
      if (end.key === start) { closed = true; break; }
      ring.push(end.point);
      const attached = adjacency.get(end.key) || [];
      const next = attached.find(id => !segments[id].used);
      if (next === undefined) break;
      edge = segments[next];
      end = edge.a.key === end.key ? edge.b : edge.a;
    }
    if (!closed || ring.length < 3 || areaOf(ring) < minArea) continue;
    // High-detail text needs the fractional outlines, but clean box-shaped
    // symbols should not become rounded rectangles. Strongly axis-aligned
    // large contours can be simplified more aggressively at their corners.
    let axisAligned = 0, perimeter = 0;
    for (let k = 0; k < ring.length; k++) {
      const p = ring[k], q = ring[(k + 1) % ring.length];
      const dx = Math.abs(q[0] - p[0]), dy = Math.abs(q[1] - p[1]);
      const distance = Math.hypot(dx, dy);
      perimeter += distance;
      if (Math.min(dx, dy) < 0.08 * Math.max(dx, dy)) axisAligned += distance;
    }
    const rectilinear = areaOf(ring) >= 400 && perimeter && axisAligned / perimeter > .88;
    const simplified = simplifyRing(ring, rectilinear ? Math.max(.9, tolerance) : tolerance);
    if (simplified.length >= 3) paths.push(curvePath(simplified, 1.05, maxCurveBend, cornerSharpness));
  }
  return paths.join('');
}
