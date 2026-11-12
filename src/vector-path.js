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
