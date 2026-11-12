const {test} = require('node:test');
const assert = require('node:assert/strict');

const tracer = import('../src/vectorize.js');
const editor = import('../src/vector-editor.js');

function image(w, h) {
  return {width:w,height:h,data:new Uint8ClampedArray(w*h*4)};
}
function rect(img,x0,y0,w,h,rgba) {
  for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++)
    img.data.set(rgba,(y*img.width+x)*4);
}

test('editable tracing separates connected components, but preserves holes', async () => {
  const {traceImageData}=await tracer;
  const {openVectorDocument}=await editor;
  const img=image(100,56);
  // One disconnected block and one ring with a transparent letter counter.
  rect(img,6,7,26,32,[210,50,35,255]);
  rect(img,48,7,43,36,[210,50,35,255]);
  rect(img,59,17,20,16,[0,0,0,0]);
  const legacy=traceImageData(img,{detail:'detailed'});
  const editable=traceImageData(img,{detail:'detailed',editable:true});
  assert.equal((legacy.match(/<path /g)||[]).length,1,
    'default export continues to group color paths for backward compatibility');
  const doc=openVectorDocument(editable);
  assert.equal(doc.shapes.length,2,'each disconnected region should have its own selectable path');
  const withHole=doc.shapes.filter(shape=>(shape.d.match(/M/g)||[]).length===2);
  assert.equal(withHole.length,1,'counter remains attached to its parent filled region');
  assert.ok(!editable.includes('<image') && !editable.includes('<script'));
  assert.equal(doc.width,100);
  assert.equal(doc.boxWidth,100);
});

test('nested filled island becomes its own shape instead of being deleted with the ring',async()=>{
  const {traceImageData}=await tracer;
  const {openVectorDocument}=await editor;
  const img=image(90,90);
  rect(img,12,12,66,66,[20,80,210,255]);
  rect(img,29,29,32,32,[0,0,0,0]);
  rect(img,40,40,10,10,[20,80,210,255]);
  const doc=openVectorDocument(traceImageData(img,{editable:true,detail:'detailed'}));
  assert.equal(doc.shapes.length,2);
  assert.equal(doc.shapes.filter(s=>(s.d.match(/M/g)||[]).length===2).length,1);
});

test('editor recolors and removes only the chosen shape; undo/redo and reset work',async()=>{
  const {traceImageData}=await tracer;
  const {
    openVectorDocument,modifyVectorShape,undoVectorEdit,redoVectorEdit,
    resetVectorEdits,hasVectorEdits,serializeVectorDocument
  }=await editor;
  const img=image(100,56);
  rect(img,5,5,28,30,[250,40,60,255]);
  rect(img,58,5,26,30,[250,40,60,255]);
  const doc=openVectorDocument(traceImageData(img,{editable:true}));
  assert.equal(doc.shapes.length,2);
  assert.equal(modifyVectorShape(doc,'s0',{fill:'#12ab34'}),true);
  assert.equal(modifyVectorShape(doc,'s1',{hidden:true}),true);
  assert.equal(hasVectorEdits(doc),true);
  const modified=serializeVectorDocument(doc);
  assert.match(modified,/fill="#12ab34"/);
  assert.ok(!modified.includes('data-chomp-shape="s1"'));
  assert.equal(undoVectorEdit(doc),true);
  assert.equal(doc.shapes[1].hidden,false);
  assert.equal(undoVectorEdit(doc),true);
  assert.equal(hasVectorEdits(doc),false);
  assert.equal(redoVectorEdit(doc),true);
  assert.equal(doc.shapes[0].fill,'#12ab34');
  assert.equal(redoVectorEdit(doc),true);
  assert.equal(doc.shapes[1].hidden,true);
  resetVectorEdits(doc);
  assert.equal(hasVectorEdits(doc),false);
  assert.equal(doc.undoStack.length,0);
  assert.equal(doc.redoStack.length,0);
  assert.equal(undoVectorEdit(doc),false);
  assert.equal(openVectorDocument(serializeVectorDocument(doc)).shapes.length,2);
});

test('vector cleanup rejects injected markup, invalid colors and missing shapes',async()=>{
  const {openVectorDocument,modifyVectorShape}=await editor;
  assert.throws(()=>openVectorDocument('<svg onload="alert(1)"/>'),/not generated/);
  assert.throws(()=>openVectorDocument(
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><script>alert(1)</script></svg>'
  ),/Unexpected SVG content/);
  const doc=openVectorDocument(
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12"><path data-chomp-shape="s0" fill="#345678" fill-rule="evenodd" d="M1 1L9 1L9 9Z"/></svg>');
  assert.throws(()=>modifyVectorShape(doc,'s0',{fill:'red"} onmouseover="alert(1)'}),/Invalid shape edit/);
  assert.throws(()=>modifyVectorShape(doc,'s9',{hidden:true}),/Unknown vector shape/);
  assert.equal(doc.shapes[0].fill,'#345678');
});
