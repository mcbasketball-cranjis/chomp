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
