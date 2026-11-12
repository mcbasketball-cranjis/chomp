/**
 * Flat-artwork detection and foreground-color segmentation for JPG/PNG logos.
 * Unlike generic median-cut quantization, this fits pixels to the line between
 * their background matte and a small number of solid ink colors. JPEG ringing
 * and antialiasing are *coverage*, not dozens of distinct vector fills.
 */
const colorDistance2 = (a, b) => (a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;
const clamp = (n, low, high) => Math.min(high, Math.max(low, n));

function colorAt(data, index) {
  const p = index * 4;
  return [data[p], data[p+1], data[p+2]];
}

function matteCandidates(image) {
  const { width, height, data } = image;
  const inset = Math.min(3, Math.floor(Math.min(width, height) / 8));
  const points = [[inset,inset],[width-1-inset,inset],[inset,height-1-inset],[width-1-inset,height-1-inset]];
  const samples = points.map(([x,y]) => {
    const colors = [[],[],[]], alphas = [];
    const radius = Math.min(2, Math.floor(Math.min(width, height)/12));
    for (let dy=-radius; dy<=radius; dy++) for (let dx=-radius; dx<=radius; dx++) {
      const px=clamp(x+dx,0,width-1), py=clamp(y+dy,0,height-1);
      const i=(py*width+px)*4;
      for(let k=0;k<3;k++)colors[k].push(data[i+k]);
      alphas.push(data[i+3]);
    }
    const middle = xs => xs.sort((a,b)=>a-b)[xs.length>>1];
    return [...colors.map(middle),middle(alphas)];
  });
  const rgb = [0,1,2].map(i=>Math.round(samples.reduce((sum,s)=>sum+s[i],0)/4));
  const opaque = samples.every(s=>s[3]>=240);
  const consistent = samples.every(s=>colorDistance2(s,rgb)<30*30*3);
  return { rgb, opaque, consistent };
}
function lineMatch(rgb, seed, matte) {
  const dr=seed[0]-matte[0], dg=seed[1]-matte[1], db=seed[2]-matte[2];
  const magnitude=dr*dr+dg*dg+db*db;
  if(magnitude<1)return {error:Infinity,coverage:0};
  const coverage=clamp(((rgb[0]-matte[0])*dr+(rgb[1]-matte[1])*dg+(rgb[2]-matte[2])*db)/magnitude,0,1.25);
  const projected=[matte[0]+coverage*dr,matte[1]+coverage*dg,matte[2]+coverage*db];
  return {error:Math.sqrt(colorDistance2(rgb,projected)),coverage};
}
function backgroundStats(image, matte) {
  const {data}=image, n=data.length/4, stride=Math.max(1,Math.ceil(n/24000));
  let near=0,opaque=0,transparent=0,sampled=0;
  for(let i=0;i<n;i+=stride){
    const p=i*4,alpha=data[p+3];sampled++;
    if(alpha<=8)transparent++;
    if(alpha>=240){
      opaque++;
      if(colorDistance2(colorAt(data,i),matte)<29*29*3)near++;
    }
  }
  return {nearFraction:near/sampled,opaqueFraction:opaque/sampled,transparentFraction:transparent/sampled};
}
function binColors(image, matte, matteAware, detail) {
  const {data}=image,n=data.length/4,stride=Math.max(1,Math.ceil(n/40000));
  let maximumAlpha=0;
  for(let p=3;p<data.length;p+=4)maximumAlpha=Math.max(maximumAlpha,data[p]);
  const bins=new Map();
  let count=0;
  for(let i=0;i<n;i+=stride) {
    const p=i*4,alpha=data[p+3];
    if(alpha<Math.max(8,maximumAlpha*.65))continue;
    const rgb=colorAt(data,i);
    if(matteAware && colorDistance2(rgb,matte)<53*53)continue;
    const key=(rgb[0]>>4)*256+(rgb[1]>>4)*16+(rgb[2]>>4);
    let bin=bins.get(key);
    if(!bin){bin={n:0,r:0,g:0,b:0};bins.set(key,bin);}
    bin.n++;bin.r+=rgb[0];bin.g+=rgb[1];bin.b+=rgb[2];count++;
  }
  if(count<3)return null;
  const candidates=[...bins.values()].map(bin=>({
    n:bin.n,rgb:[Math.round(bin.r/bin.n),Math.round(bin.g/bin.n),Math.round(bin.b/bin.n)]
  })).sort((a,b)=>b.n*(matteAware?colorDistance2(b.rgb,matte):65536)-a.n*(matteAware?colorDistance2(a.rgb,matte):65536));
  const maxColors=detail==='simple'?3:detail==='detailed'?6:5;
  const seeds=[];
  for(const candidate of candidates){
    if(candidate.n<Math.max(2,Math.ceil(count*.002)))continue;
    const rgb=candidate.rgb;
    if(matteAware && colorDistance2(rgb,matte)<65*65)continue;
    const error=seeds.length?Math.min(...seeds.map(seed=>matteAware?lineMatch(rgb,seed,matte).error:Math.sqrt(colorDistance2(rgb,seed)))):Infinity;
    if(error>37)seeds.push(rgb);
    if(seeds.length>=maxColors)break;
  }
  if(!seeds.length)return null;
  // Require a majority of strong artwork samples to be representable by a few
  // flat colors. Photographs/gradients should use the original detailed tracer.
  let supported=0,seen=0;
  for(let i=0;i<n;i+=stride){
    const p=i*4;
    if(data[p+3]<Math.max(8,maximumAlpha*.65))continue;
    const rgb=colorAt(data,i);
    if(matteAware && colorDistance2(rgb,matte)<60*60)continue;
    seen++;
    const minError=Math.min(...seeds.map(seed=>matteAware?lineMatch(rgb,seed,matte).error:Math.sqrt(colorDistance2(rgb,seed))));
    if(minError<36)supported++;
  }
  if(!seen||supported/seen<.92)return null;
  // Avoid treating a photograph as a limited-palette logo when most of its
  // nominally "ink" pixels are only medium-strength, natural-image variations.
  if(seeds.length===maxColors && supported/seen<.975)return null;
  return {seeds,maximumAlpha};
}
function removeSpeckles(indices,width,height,minPixels) {
  if(minPixels<=1)return;
  const visited=new Uint8Array(indices.length);
  const queue=new Int32Array(indices.length);
  for(let first=0;first<indices.length;first++){
    if(visited[first]||indices[first]<0)continue;
    const ink=indices[first];let head=0,tail=1;
    queue[0]=first;visited[first]=1;
    while(head<tail){
      const point=queue[head++],x=point%width,y=(point-x)/width;
      const neighbors=[x>0?point-1:-1,x+1<width?point+1:-1,y>0?point-width:-1,y+1<height?point+width:-1];
      for(const next of neighbors)if(next>=0&&!visited[next]&&indices[next]===ink){visited[next]=1;queue[tail++]=next;}
    }
    if(tail<minPixels)for(let i=0;i<tail;i++)indices[queue[i]]=-1;
  }
}
export function flatLogoLayers(image, detail='balanced') {
  const {width,height,data}=image;
  const corners=matteCandidates(image);
  const stats=backgroundStats(image,corners.rgb);
  const opaqueBackground=corners.opaque&&corners.consistent&&stats.nearFraction>=.45&&stats.opaqueFraction>.96;
  // A transparent canvas should only qualify if most surviving ink is solid.
  const transparentLogo=stats.transparentFraction>.12&&stats.opaqueFraction>.015;
  if(!opaqueBackground&&!transparentLogo)return null;
  // The background remover keeps RGB while clearing alpha. On a JPEG the
  // resulting transparent corner may still be white: reuse that matte so
  // pale, antialiased letter edges are not mistaken for additional inks.
  const recoveredMatte = transparentLogo && corners.consistent &&
    corners.rgb.some(value => value > 30);
  const matteAware = opaqueBackground || recoveredMatte;
  const matte = matteAware ? corners.rgb : [0,0,0];
  const clustered=binColors(image,matte,matteAware,detail);
  if(!clustered)return null;
  const {seeds,maximumAlpha}=clustered;
  const indices=new Int16Array(width*height).fill(-1);
  const support=new Uint32Array(seeds.length);
  for(let i=0;i<indices.length;i++){
    const p=i*4,alpha=data[p+3];
    if(alpha<Math.max(8,maximumAlpha*.34))continue;
    const rgb=colorAt(data,i);
    if(matteAware&&colorDistance2(rgb,matte)<32*32)continue;
    let best=-1,bestError=Infinity;
    for(let c=0;c<seeds.length;c++){
      const match=matteAware?lineMatch(rgb,seeds[c],matte):{error:Math.sqrt(colorDistance2(rgb,seeds[c])),coverage:1};
      if(match.coverage<.42)continue;
      if(match.error<bestError){bestError=match.error;best=c;}
    }
    if(best>=0 && bestError < (matteAware?45:34)){indices[i]=best;support[best]++;}
  }
  removeSpeckles(indices,width,height,Math.max(2,Math.min(7,Math.round(width*height*.000012))));
  const colors=seeds.map(seed=>[...seed,maximumAlpha]);
  return {colors,indices,background:opaqueBackground?matte:null};
}
