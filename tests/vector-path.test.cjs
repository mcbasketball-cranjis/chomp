const {test}=require('node:test');
const assert=require('node:assert/strict');
const vectorPath=import('../src/vector-path.js');
const editor=import('../src/vector-editor.js');

test('absolute Chomp path parser normalizes straight H/V coordinates', async()=>{
  const {parseVectorPath,serializeVectorPath,vectorPathBounds}=await vectorPath;
  const commands=parseVectorPath('M0 0H20V10H0Z');
  assert.deepEqual(commands.map(c=>c.type),['M','L','L','L','Z']);
  assert.deepEqual(commands[2].values,[20,10]);
  assert.equal(serializeVectorPath(commands),'M0 0L20 0L20 10L0 10Z');
  assert.deepEqual(vectorPathBounds('M0 0H20V10H0Z'),{x:0,y:0,width:20,height:10});
});

test('anchor and both cubic control points are independently movable',async()=>{
  const {vectorPathPoints,moveVectorPathPoint}=await vectorPath;
  const d='M1 2C4 6 12 13 19 20L25 27Z';
  const points=vectorPathPoints(d);
  assert.deepEqual(points.nodes.map(n=>n.role),
    ['anchor','control1','control2','anchor','anchor']);
  const c1=moveVectorPathPoint(d,1,'control1',8,9);
  assert.equal(c1,'M1 2C8 9 12 13 19 20L25 27Z');
  const c2=moveVectorPathPoint(d,1,'control2',10,15);
  assert.equal(c2,'M1 2C4 6 10 15 19 20L25 27Z');
  const moved=moveVectorPathPoint(d,1,'anchor',23,26);
  assert.equal(moved,'M1 2C4 6 12 13 23 26L25 27Z');
  assert.equal(moveVectorPathPoint(d,0,'anchor',1.236,2.235).startsWith('M1.24 2.24'),true);
  assert.throws(()=>moveVectorPathPoint(d,3,'anchor',2,2),/Invalid vector handle/);
  assert.throws(()=>moveVectorPathPoint(d,1,'control1',1e7,0),/Invalid vector point/);
});

test('point edits persist through SVG serialization and undo/redo',async()=>{
  const {moveVectorPathPoint}=await vectorPath;
  const {openVectorDocument,modifyVectorShape,undoVectorEdit,redoVectorEdit,
    hasVectorEdits,serializeVectorDocument,resetVectorEdits}=await editor;
  const doc=openVectorDocument(
    '<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 50 50">'+
    '<path data-chomp-shape="s0" fill="#456789" fill-rule="evenodd" d="M4 4C10 10 20 20 30 30L4 30Z"/></svg>');
  const original=doc.shapes[0].d;
  const changed=moveVectorPathPoint(original,1,'control2',25,16);
  assert.equal(modifyVectorShape(doc,'s0',{d:changed}),true);
  assert.equal(hasVectorEdits(doc),true);
  assert.ok(serializeVectorDocument(doc).includes('C10 10 25 16 30 30'));
  assert.equal(undoVectorEdit(doc),true);
  assert.equal(doc.shapes[0].d,original);
  assert.equal(hasVectorEdits(doc),false);
  assert.equal(redoVectorEdit(doc),true);
  assert.equal(doc.shapes[0].d,changed);
  assert.equal(openVectorDocument(serializeVectorDocument(doc)).shapes[0].d,changed);
  resetVectorEdits(doc);
  assert.equal(doc.shapes[0].d,original);
});

test('strict path parser rejects unsupported SVG grammar',async()=>{
  const {parseVectorPath,vectorPathPoints,moveVectorPathPoint}=await vectorPath;
  for(const d of ['M0 0Q1 2 3 4Z','M0 0LNaN 2Z','M1 1LInfinity 2Z',
    'M1 1L2 2Z<image/>','M0 0 L1 1 transform=evil','M0 0L500000 10Z','M0 0L2Z']){
    assert.throws(()=>parseVectorPath(d));
  }
  assert.deepEqual(vectorPathPoints('M0 0C1 1 2 2 3 3Z',2).tooMany,true);
  assert.throws(()=>moveVectorPathPoint('M0 0L1 1Z',1,'control1',1,1),/Invalid vector handle/);
});


test('point insertion preserves a cubic Bézier contour via de Casteljau subdivision',async()=>{
  const {insertVectorPathPoint,parseVectorPath}=await vectorPath;
  const d='M0 0C0 40 40 40 40 0L0 0Z';
  const added=insertVectorPathPoint(d,1,.5);
  const commands=parseVectorPath(added);
  assert.deepEqual(commands.map(c=>c.type),['M','C','C','L','Z']);
  assert.deepEqual(commands[1].values,[0,20,10,30,20,30]);
  assert.deepEqual(commands[2].values,[30,30,40,20,40,0]);
  assert.equal(added.includes('<image'),false);
});

test('point insertion and removal preserve valid closed line contours',async()=>{
  const {insertVectorPathPoint,deleteVectorPathPoint,parseVectorPath}=await vectorPath;
  const original='M0 0L20 0L20 20L0 20Z';
  const inserted=insertVectorPathPoint(original,1,.5);
  assert.match(inserted,/L10 0L20 0/);
  assert.equal(deleteVectorPathPoint(inserted,1),original);
  const closing=insertVectorPathPoint(original,4,.5);
  assert.match(closing,/L0 10Z$/);
  assert.equal(deleteVectorPathPoint(closing,4),original);
  assert.throws(()=>deleteVectorPathPoint('M0 0L20 0L10 20Z',1),/three anchors/);
  assert.throws(()=>deleteVectorPathPoint(original,0),/Select an editable anchor/);
  assert.throws(()=>insertVectorPathPoint(original,0,.5),/Select a line/);
  assert.throws(()=>insertVectorPathPoint(original,1,1),/Invalid insertion/);
  assert.equal(parseVectorPath(closing).length,6);
});

test('nearest insertion segment finds actual line or curve geometry',async()=>{
  const {nearestVectorPathSegment}=await vectorPath;
  const square='M0 0L20 0L20 20L0 20Z';
  let nearest=nearestVectorPathSegment(square,10,1);
  assert.equal(nearest.index,1);
  assert.ok(Math.abs(nearest.t-.5)<.1);
  nearest=nearestVectorPathSegment(square,19,10);
  assert.equal(nearest.index,2);
  assert.ok(nearest.distance<2);
  const cubic='M0 0C0 40 40 40 40 0L0 0Z';
  const curve=nearestVectorPathSegment(cubic,20,30);
  assert.equal(curve.index,1);
  assert.ok(Math.abs(curve.t-.5)<.08);
  assert.throws(()=>nearestVectorPathSegment(cubic,NaN,2),/Invalid insertion/);
});

test('curved-to-straight and straight-to-curved conversions are undoable',async()=>{
  const {setVectorPathSegmentType}=await vectorPath;
  const {openVectorDocument,modifyVectorShape,undoVectorEdit,redoVectorEdit}=await editor;
  const doc=openVectorDocument(
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">'+
    '<path data-chomp-shape="s0" fill="#123456" fill-rule="evenodd" d="M0 0L30 0L30 30L0 30Z"/></svg>');
  const curve=setVectorPathSegmentType(doc.shapes[0].d,1,'curve');
  assert.match(curve,/C10 0 20 0 30 0/);
  modifyVectorShape(doc,'s0',{d:curve});
  assert.equal(setVectorPathSegmentType(curve,1,'line').includes('L30 0'),true);
  assert.equal(undoVectorEdit(doc),true);
  assert.equal(doc.shapes[0].d,'M0 0L30 0L30 30L0 30Z');
  assert.equal(redoVectorEdit(doc),true);
  assert.equal(doc.shapes[0].d,curve);
});

test('lossless cleanup removes redundant lines without breaking undo/redo',async()=>{
  const {optimizeVectorPath}=await vectorPath;
  const {openVectorDocument,optimizeVectorDocument,undoVectorEdit,redoVectorEdit,
    serializeVectorDocument}=await editor;
  const d='M0 0L10 0L20 0L20 20L0 20Z';
  assert.equal(optimizeVectorPath(d),'M0 0L20 0L20 20L0 20Z');
  const curved='M0 0C10 0 20 0 30 0L30 20L0 20Z';
  assert.equal(optimizeVectorPath(curved),'M0 0L30 0L30 20L0 20Z');
  const doc=openVectorDocument(
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">'+
    '<path data-chomp-shape="s0" fill="#123456" fill-rule="evenodd" d="'+d+'"/>'+
    '<path data-chomp-shape="s1" fill="#abcdef" fill-rule="evenodd" d="'+curved+'"/></svg>');
  const result=optimizeVectorDocument(doc);
  assert.equal(result.changed,2);
  assert.ok(result.bytesSaved>0);
  assert.equal(doc.undoStack.length,1,'cleanup should be one undo step');
  const cleaned=serializeVectorDocument(doc);
  assert.equal(cleaned.includes('L10 0'),false);
  assert.equal(cleaned.includes('C10 0'),false);
  assert.equal(undoVectorEdit(doc),true);
  assert.equal(doc.shapes[0].d,d);
  assert.equal(redoVectorEdit(doc),true);
  assert.equal(doc.shapes[0].d,'M0 0L20 0L20 20L0 20Z');
});
