const { test } = require('node:test');
const assert = require('node:assert/strict');
const snap = import('../src/vector-snap.js');

test('snaps shape center to artboard center without changing the other axis',async()=>{
  const {snapShapeTranslation}=await snap;
  const result=snapShapeTranslation(
    {x:10,y:10,width:20,height:10},[],{width:100,height:100},29,3,2);
  assert.equal(result.dx,30);
  assert.equal(result.dy,3);
  assert.deepEqual(result.guides,[{axis:'x',position:50}]);
});
test('snaps nearby shape edges and centers within the tolerance',async()=>{
  const {snapShapeTranslation}=await snap;
  const moving={x:0,y:0,width:20,height:20};
  const other=[{x:34,y:42,width:20,height:20}];
  const result=snapShapeTranslation(moving,other,{width:200,height:200},13.2,41.4,1);
  assert.equal(result.dx,14);
  assert.equal(result.dy,42);
  assert.deepEqual(result.guides,[{axis:'x',position:34},{axis:'y',position:42}]);
});
test('no snap when distant, and tolerance zero allows exact matches',async()=>{
  const {snapShapeTranslation}=await snap;
  const bounds={x:2,y:4,width:10,height:10};
  const plain=snapShapeTranslation(bounds,[],{width:100,height:100},8,5,0.5);
  assert.equal(plain.dx,8); assert.equal(plain.dy,5);
  assert.deepEqual(plain.guides,[]);
  const zero=snapShapeTranslation(bounds,[],{width:100,height:100},-2,-4,0);
  assert.deepEqual(zero.guides,[{axis:'x',position:0},{axis:'y',position:0}]);
});
test('bad snapping coordinates are rejected',async()=>{
  const {snapShapeTranslation}=await snap;
  assert.throws(()=>snapShapeTranslation(null,[],{width:10,height:10},1,1),/Invalid/);
  assert.throws(()=>snapShapeTranslation({x:0,y:0,width:1,height:1},[],{width:10,height:10},NaN,1),/Invalid/);
});
