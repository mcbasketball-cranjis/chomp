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

test('group recolor and removal remain one undo step and export keeps unaffected fills',async()=>{
  const {traceImageData}=await tracer;
  const {openVectorDocument,modifyVectorShapes,matchingShapeIds,vectorPalette,
    undoVectorEdit,redoVectorEdit,serializeVectorDocument}=await editor;
  const img=image(110,60);
  rect(img,5,10,24,28,[210,40,40,255]);
  rect(img,42,10,24,28,[210,40,40,255]);
  rect(img,78,10,24,28,[30,70,220,255]);
  const doc=openVectorDocument(traceImageData(img,{editable:true,detail:'detailed'}));
  assert.equal(doc.shapes.length,3);
  const red=doc.shapes.find(x=>x.fill==='#d22828');
  assert.ok(red);
  const matching=matchingShapeIds(doc,red.id);
  assert.equal(matching.length,2);
  assert.equal(vectorPalette(doc).find(p=>p.fill==='#d22828').count,2);
  assert.equal(modifyVectorShapes(doc,matching,{fill:'#209d4c'}),true);
  assert.equal(doc.undoStack.length,1,'one grouped change should have one undo entry');
  assert.equal(doc.shapes.filter(x=>x.fill==='#209d4c').length,2);
  assert.equal(undoVectorEdit(doc),true);
  assert.equal(doc.shapes.filter(x=>x.fill==='#d22828').length,2);
  assert.equal(redoVectorEdit(doc),true);
  const green=doc.shapes.find(x=>x.fill==='#209d4c');
  assert.equal(modifyVectorShapes(doc,matchingShapeIds(doc,green.id),{hidden:true}),true);
  assert.equal(vectorPalette(doc).length,1);
  assert.equal(doc.shapes.filter(x=>x.hidden).length,2);
  assert.equal(undoVectorEdit(doc),true);
  const output=serializeVectorDocument(doc);
  assert.equal((output.match(/<path /g)||[]).length,3);
  assert.match(output,/fill="#1e46dc"/);
  assert.equal(doc.undoStack.length,1);
});

test('cleaned SVG with missing shape IDs reopens for further editing',async()=>{
  const {openVectorDocument,modifyVectorShape,serializeVectorDocument}=await editor;
  const input='<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">'+
    '<path data-chomp-shape="s0" fill="#111111" fill-rule="evenodd" d="M1 1L4 1L4 4Z"/>'+
    '<path data-chomp-shape="s1" fill="#222222" fill-rule="evenodd" d="M5 5L8 5L8 8Z"/>'+
    '<path data-chomp-shape="s2" fill="#333333" fill-rule="evenodd" d="M9 9L12 9L12 12Z"/></svg>';
  const doc=openVectorDocument(input);
  modifyVectorShape(doc,'s1',{hidden:true});
  const reopened=openVectorDocument(serializeVectorDocument(doc));
  assert.deepEqual(reopened.shapes.map(x=>x.id),['s0','s2']);
  modifyVectorShape(reopened,'s2',{fill:'#ffffff'});
  const reexport=serializeVectorDocument(reopened);
  assert.match(reexport,/data-chomp-shape="s2" fill="#ffffff"/);
  assert.ok(!reexport.includes('data-chomp-shape="s1"'));
  assert.throws(()=>openVectorDocument(input.replace('data-chomp-shape="s1"', 'data-chomp-shape="s0"')),
    /Invalid editable SVG path/);
  assert.throws(()=>openVectorDocument(input.replace('data-chomp-shape="s1"', 'data-chomp-shape="s3"')),
    /Invalid editable SVG path/);
});

test('group edits validate all shape IDs atomically before any mutation',async()=>{
  const {openVectorDocument,modifyVectorShapes}=await editor;
  const doc=openVectorDocument(
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12">'+
    '<path data-chomp-shape="s0" fill="#123456" fill-rule="evenodd" d="M1 1L5 1L5 5Z"/>'+
    '<path data-chomp-shape="s1" fill="#654321" fill-rule="evenodd" d="M6 6L9 6L9 9Z"/></svg>');
  assert.throws(()=>modifyVectorShapes(doc,['s0','s999'],{fill:'#ffffff'}),/Unknown vector shape/);
  assert.equal(doc.shapes[0].fill,'#123456');
  assert.equal(doc.undoStack.length,0);
  assert.throws(()=>modifyVectorShapes(doc,['s0','s0'],{hidden:true}),/Invalid shape selection/);
  assert.equal(doc.shapes[0].hidden,false);
});
