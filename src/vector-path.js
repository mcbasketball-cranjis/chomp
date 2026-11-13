/**
 * Small, strict parser for the absolute path commands produced by Chomp.
 * No arbitrary SVG grammar, scripting, transforms, or external assets.
 * H/V are normalized to L when a point is actually edited.
 */
const TOKEN = /[MLCHVZ]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;
const COUNTS = { M:2, L:2, C:6, H:1, V:1, Z:0 };
const POSITION_LIMIT = 32768;

export function parseVectorPath(d) {
  if (typeof d !== 'string' || !d.length || d.length > 2_000_000)
    throw new Error('Invalid vector path.');
  const tokens = d.match(TOKEN) || [];
  if (tokens.join('') !== d.replace(/[\s,]/g, ''))
    throw new Error('Unsupported vector path command.');
  let i=0,x=0,y=0,firstX=0,firstY=0;
  const commands=[];
  while(i<tokens.length){
    const kind=tokens[i++];
    if (!Object.prototype.hasOwnProperty.call(COUNTS,kind))
      throw new Error('Unsupported vector path command.');
    const count=COUNTS[kind];
    const values=[];
    for(let k=0;k<count;k++){
      const token=tokens[i++];
      if (token===undefined || /^[MLCHVZ]$/.test(token))
        throw new Error('Missing vector path coordinate.');
      const n=Number(token);
      if(!Number.isFinite(n)||Math.abs(n)>POSITION_LIMIT)
        throw new Error('Invalid vector path coordinate.');
      values.push(n);
    }
    if(kind==='M'){
      x=values[0];y=values[1];firstX=x;firstY=y;
      commands.push({type:'M',values});
    }else if(kind==='L'){
      x=values[0];y=values[1];
      commands.push({type:'L',values});
    }else if(kind==='H'){
      x=values[0];commands.push({type:'L',values:[x,y]});
    }else if(kind==='V'){
      y=values[0];commands.push({type:'L',values:[x,y]});
    }else if(kind==='C'){
      x=values[4];y=values[5];
      commands.push({type:'C',values});
    }else{
      x=firstX;y=firstY;commands.push({type:'Z',values:[]});
    }
    if(commands.length>12000)throw new Error('Too many vector path commands.');
  }
  if(commands[0]?.type!=='M' || commands.some((c,j)=>j>0&&c.type==='M'&&commands[j-1].type!=='Z'))
    throw new Error('Invalid path structure.');
  return commands;
}

function number(n) {
  const result = Math.round(n * 100) / 100;
  return String(Object.is(result,-0)?0:result);
}

export function serializeVectorPath(commands){
  return commands.map(({type,values})=>type+values.map(number).join(' ')).join('');
}

export function vectorPathPoints(d, limit=800){
  const commands=parseVectorPath(d);
  const nodes=[];
  for(let index=0;index<commands.length;index++){
    const {type,values}=commands[index];
    if(type==='Z')continue;
    if(type==='C'){
      nodes.push({index,role:'control1',x:values[0],y:values[1]});
      nodes.push({index,role:'control2',x:values[2],y:values[3]});
    }
    nodes.push({index,role:'anchor',x:values.at(-2),y:values.at(-1)});
    if(nodes.length>limit)return {nodes:[],tooMany:true,count:nodes.length};
  }
  return {nodes,tooMany:false,count:nodes.length};
}

export function vectorPathBounds(d){
  const commands=parseVectorPath(d);
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const {values} of commands){
    for(let i=0;i<values.length;i+=2){
      // Coordinates have already been normalized to pairs.
      const x=values[i],y=values[i+1];
      minX=Math.min(minX,x);minY=Math.min(minY,y);
      maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
    }
  }
  return commands.length ? {
    x:minX,y:minY,width:Math.max(0,maxX-minX),height:Math.max(0,maxY-minY)
  } : {x:0,y:0,width:0,height:0};
}

export function moveVectorPathPoint(d,index,role,x,y) {
  const commands=parseVectorPath(d);
  if(!Number.isSafeInteger(index)||index<0||index>=commands.length ||
     !Number.isFinite(x)||!Number.isFinite(y)||
     Math.abs(x)>POSITION_LIMIT||Math.abs(y)>POSITION_LIMIT)
    throw new Error('Invalid vector point.');
  const command=commands[index];
  const offsets=role==='anchor' ? (command.type==='C'?[4,5]:[0,1])
    : role==='control1'&&command.type==='C'?[0,1]
    : role==='control2'&&command.type==='C'?[2,3] : null;
  if(!offsets || command.type==='Z')
    throw new Error('Invalid vector handle.');
  command.values[offsets[0]]=x;
  command.values[offsets[1]]=y;
  return serializeVectorPath(commands);
}


function lerpPoint(a,b,t){
  return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
}
function cubicAt(p0,p1,p2,p3,t){
  const a=lerpPoint(p0,p1,t),b=lerpPoint(p1,p2,t),c=lerpPoint(p2,p3,t);
  return lerpPoint(lerpPoint(a,b,t),lerpPoint(b,c,t),t);
}
/** Identify the closest actual SVG line or cubic segment in document coordinates. */
export function nearestVectorPathSegment(d,x,y) {
  if(!Number.isFinite(x)||!Number.isFinite(y))throw new Error('Invalid insertion position.');
  const commands=parseVectorPath(d);
  if(commands.length>900)throw new Error('Too many segments for interactive insertion.');
  let current=null,origin=null,best=null;
  function evaluate(index,kind,p0,p1,p2,p3){
    const point=t=>kind==='C'?cubicAt(p0,p1,p2,p3,t):lerpPoint(p0,p3,t);
    let bestT=.5,bestDistance=Infinity;
    for(let n=0;n<=24;n++){
      const t=n/24,pt=point(t),distance=(pt[0]-x)**2+(pt[1]-y)**2;
      if(distance<bestDistance){bestT=t;bestDistance=distance;}
    }
    let lo=Math.max(0,bestT-1/24),hi=Math.min(1,bestT+1/24);
    for(let n=0;n<12;n++){
      const a=lo+(hi-lo)/3,b=hi-(hi-lo)/3;
      const pa=point(a),pb=point(b);
      if((pa[0]-x)**2+(pa[1]-y)**2 < (pb[0]-x)**2+(pb[1]-y)**2)hi=b;
      else lo=a;
    }
    const t=(lo+hi)/2,p=point(t),distance=Math.hypot(p[0]-x,p[1]-y);
    if(!best||distance<best.distance)best={index,t:Math.max(.02,Math.min(.98,t)),distance};
  }
  commands.forEach((command,index)=>{
    if(command.type==='M'){current=command.values.slice();origin=current.slice();return;}
    if(!current)return;
    if(command.type==='Z'){
      if(origin) evaluate(index,'L',current,null,null,origin);
      current=origin;return;
    }
    const v=command.values;
    const end=command.type==='C'?[v[4],v[5]]:[v[0],v[1]];
    evaluate(index,command.type,current,command.type==='C'?[v[0],v[1]]:null,
      command.type==='C'?[v[2],v[3]]:null,end);
    current=end;
  });
  return best;
}

export function insertVectorPathPoint(d,index,t=.5) {
  if(!Number.isSafeInteger(index)||!Number.isFinite(t)||t<.02||t>.98)
    throw new Error('Invalid insertion position.');
  const commands=parseVectorPath(d);
  const target=commands[index];
  if(!target||!['L','C','Z'].includes(target.type))
    throw new Error('Select a line or curved segment.');
  let prior=null,origin=null;
  for(let i=0;i<index;i++){
    const command=commands[i];
    if(command.type==='M'){origin=command.values;prior=command.values;}
    else if(command.type==='L')prior=command.values;
    else if(command.type==='C')prior=command.values.slice(4);
    else if(command.type==='Z')prior=origin;
  }
  if(!prior||!origin)throw new Error('Invalid vector segment.');
  if(target.type==='C'){
    const p0=prior,p1=target.values.slice(0,2),p2=target.values.slice(2,4),
      p3=target.values.slice(4,6);
    const q0=lerpPoint(p0,p1,t),q1=lerpPoint(p1,p2,t),q2=lerpPoint(p2,p3,t);
    const r0=lerpPoint(q0,q1,t),r1=lerpPoint(q1,q2,t),p=lerpPoint(r0,r1,t);
    commands.splice(index,1,{type:'C',values:[...q0,...r0,...p]},
      {type:'C',values:[...r1,...q2,...p3]});
  }else{
    const end=target.type==='Z'?origin:target.values;
    const p=lerpPoint(prior,end,t);
    commands.splice(index,0,{type:'L',values:p});
  }
  return serializeVectorPath(commands);
}

export function deleteVectorPathPoint(d,index) {
  const commands=parseVectorPath(d);
  if(!Number.isSafeInteger(index)||!['L','C'].includes(commands[index]?.type))
    throw new Error('Select an editable anchor point.');
  let start=index;
  while(start>=0&&commands[start].type!=='M')start--;
  let end=index;
  while(end<commands.length&&commands[end].type!=='Z')end++;
  // Preserve at least three vertices so a closed letter region remains valid.
  const anchors=commands.slice(start,Math.min(commands.length,end+1))
    .filter(c=>['M','L','C'].includes(c.type)).length;
  if(start<0||anchors<=3)throw new Error('At least three anchors must remain.');
  commands.splice(index,1);
  return serializeVectorPath(commands);
}

export function setVectorPathSegmentType(d,index,style) {
  const commands=parseVectorPath(d);
  if(!Number.isSafeInteger(index)||!['line','curve'].includes(style)||
     !['L','C'].includes(commands[index]?.type))
    throw new Error('Select an editable line or curve.');
  const current=commands[index];
  if((style==='line'&&current.type==='L')||(style==='curve'&&current.type==='C'))
    return d;
  let start=null;
  for(let i=0;i<index;i++){
    const c=commands[i];
    if(c.type==='M'||c.type==='L')start=c.values;
    else if(c.type==='C')start=c.values.slice(4);
  }
  if(!start)throw new Error('Invalid segment.');
  if(style==='line')commands[index]={type:'L',values:current.values.slice(4)};
  else{
    const end=current.values;
    const a=lerpPoint(start,end,1/3),b=lerpPoint(start,end,2/3);
    commands[index]={type:'C',values:[...a,...b,...end]};
  }
  return serializeVectorPath(commands);
}

/** Lossless simplification: remove exactly collinear intermediate line points,
 * duplicate line endpoints and straight cubic segments with collinear handles.
 */
export function optimizeVectorPath(d) {
  const commands=parseVectorPath(d);
  let current=null,origin=null;
  const cleaned=[];
  for(const original of commands){
    let c={type:original.type,values:[...original.values]};
    if(c.type==='M'){origin=c.values;current=c.values;cleaned.push(c);continue;}
    if(c.type==='Z'){cleaned.push(c);current=origin;continue;}
    if(!current)throw new Error('Invalid path structure.');
    if(c.type==='C'){
      const end=c.values.slice(4),a=c.values.slice(0,2),b=c.values.slice(2,4);
      const dx=end[0]-current[0],dy=end[1]-current[1],length=Math.hypot(dx,dy);
      const lineDistance=p=>length
        ?Math.abs(dx*(p[1]-current[1])-dy*(p[0]-current[0]))/length
        :Math.hypot(p[0]-current[0],p[1]-current[1]);
      // Strict tolerance is below the SVG coordinate precision, preserving look.
      const between=p=> (p[0]-current[0])*dx+(p[1]-current[1])*dy>=0 &&
        (p[0]-end[0])*dx+(p[1]-end[1])*dy<=0;
      if(lineDistance(a)<.004 && lineDistance(b)<.004 && between(a)&&between(b))
        c={type:'L',values:end};
    }
    if(c.type==='L'){
      if(Math.hypot(c.values[0]-current[0],c.values[1]-current[1])<.004){
        current=c.values;continue;
      }
      const prev=cleaned[cleaned.length-1];
      if(prev?.type==='L'){
        const before=cleaned[cleaned.length-2],anchor=before?.type==='C'
          ? before.values.slice(4):before?.values.slice(0,2);
        if(anchor?.length===2){
          const mid=prev.values,end=c.values;
          const cross=(mid[0]-anchor[0])*(end[1]-mid[1])-
                      (mid[1]-anchor[1])*(end[0]-mid[0]);
          const dot=(mid[0]-anchor[0])*(end[0]-mid[0])+
                    (mid[1]-anchor[1])*(end[1]-mid[1]);
          if(Math.abs(cross)<.004 && dot>=0)cleaned.pop();
        }
      }
    }
    cleaned.push(c);
    current=c.type==='C'?c.values.slice(4):c.values;
  }
  return serializeVectorPath(cleaned);
}
