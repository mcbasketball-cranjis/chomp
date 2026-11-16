/**
 * Deterministic vector alignment snapping in SVG document units.
 * No raster pixels, external dependencies, or hidden editor state.
 */
function axisCandidates(bounds, axis) {
  const start=axis==='x'?bounds.x:bounds.y;
  const length=axis==='x'?bounds.width:bounds.height;
  return [start,start+length/2,start+length];
}
function bestAxisSnap(moving, other, documentSize, delta, tolerance, axis) {
  const movingPoints=axisCandidates(moving,axis).map(v=>v+delta);
  const candidates=[0,documentSize/2,documentSize];
  for(const b of other)candidates.push(...axisCandidates(b,axis));
  let best=null;
  for(const point of movingPoints) for(const target of candidates) {
    const correction=target-point;
    if(Math.abs(correction)>tolerance)continue;
    if(!best || Math.abs(correction)<Math.abs(best.correction))
      best={correction,position:target,axis};
  }
  return best;
}
export function snapShapeTranslation(bounds, otherBounds, document, dx, dy, tolerance=6) {
  if(!bounds || !document || !Number.isFinite(dx) || !Number.isFinite(dy) ||
     !Number.isFinite(tolerance) || tolerance<0)
    throw new Error('Invalid snapping coordinates.');
  const others=(Array.isArray(otherBounds)?otherBounds:[]).filter(Boolean);
  const x=bestAxisSnap(bounds,others,document.width,dx,tolerance,'x');
  const y=bestAxisSnap(bounds,others,document.height,dy,tolerance,'y');
  return {dx:dx+(x?.correction||0),dy:dy+(y?.correction||0),
    guides:[x,y].filter(Boolean).map(({axis,position})=>({axis,position}))};
}
