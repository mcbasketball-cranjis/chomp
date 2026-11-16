// Download release-pinned LGPL-only FFmpeg binaries at packaging time.
// Never use floating "latest" URLs or silently substitute GPL binaries.
// No executables or customer media are committed to Chomp's source tree.
import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import { execFileSync } from 'node:child_process';

const archives={
  'darwin-arm64':{
    url:'https://github.com/dfloresc/ffmpeg-macos-builds/releases/download/v9.0.1-1/ffmpeg-9.0.1-1-lgpl-macos-arm64.tar.xz',
    sha256:'d0ea5ea43a5adfa5d01d4137c9e5a61728b800a812f12917a26fd7af0c14c03a'
  },
  'darwin-x64':{
    url:'https://github.com/dfloresc/ffmpeg-macos-builds/releases/download/v9.0.1-1/ffmpeg-9.0.1-1-lgpl-macos-x86_64.tar.xz',
    sha256:'d63ad731cbf1eb71c2055130fedfbd7e49edd60a9815ab763e72ba802c1ac666'
  },
  'win32-x64':{
    url:'https://github.com/FFmpeg-Builds/FFmpeg-Builds/releases/download/autobuild-2026-11-15-12-40/ffmpeg-n9.0.2-57-gd838f9f9ae-win64-lgpl-9.0.zip',
    sha256:'fef892bf0e80c9507c5db75e6cf00104bc622235c6280ea73db0814d684e5f0b'
  }
};
async function download(item,target){
  const response=await fetch(item.url,{signal:AbortSignal.timeout(240000)});
  if(!response.ok||!response.body)throw new Error('FFmpeg download failed: HTTP '+response.status);
  const hash=createHash('sha256');
  await pipeline(Readable.fromWeb(response.body),new Transform({
    transform(chunk,_encoding,callback){hash.update(chunk);callback(null,chunk);}
  }),createWriteStream(target,{flags:'wx'}));
  const actual=hash.digest('hex');
  if(actual!==item.sha256)throw new Error('FFmpeg archive SHA-256 mismatch. Expected '+item.sha256+' but got '+actual);
}
function tar(args){return execFileSync('tar',args,{encoding:'utf8',timeout:180000,maxBuffer:24*1024*1024});}
function validateEntries(archive){
  const entries=tar(['-tf',archive]).split(/\r?\n/).filter(Boolean);
  for(const entry of entries){
    const normalized=entry.replaceAll('\\','/');
    if(normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized) ||
      normalized.split('/').includes('..'))
      throw new Error('Unsafe path in FFmpeg archive: '+entry);
  }
}
async function walk(root,files=[]){
  for(const entry of await fs.readdir(root,{withFileTypes:true})){
    const full=path.join(root,entry.name);
    if(entry.isDirectory())await walk(full,files);
    else if(entry.isFile())files.push(full);
  }
  return files;
}
async function stage(target){
  const item=archives[target];
  if(!item)throw new Error('Unsupported bundled FFmpeg target '+target);
  const output=path.resolve('vendor','ffmpeg',target);
  const file=path.join(output,'bin',target.startsWith('win32')?'ffmpeg.exe':'ffmpeg');
  const probe=path.join(output,'bin',target.startsWith('win32')?'ffprobe.exe':'ffprobe');
  try{
    await Promise.all([fs.access(file),fs.access(probe)]);
    console.log('Bundled FFmpeg already staged for '+target);
    return;
  }catch{}
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'chomp-ffmpeg-'));
  try{
    const archive=path.join(temp,'download.'+(item.url.endsWith('.zip')?'zip':'tar.xz'));
    await download(item,archive);validateEntries(archive);
    const extracted=path.join(temp,'extracted');await fs.mkdir(extracted);
    tar(['-xf',archive,'-C',extracted]);
    const all=await walk(extracted);
    const exe=target.startsWith('win32')?'ffmpeg.exe':'ffmpeg';
    const found=all.find(f=>path.basename(f)===exe&&path.basename(path.dirname(f))==='bin');
    if(!found)throw new Error('FFmpeg archive did not contain bin/'+exe);
    const root=path.dirname(path.dirname(found));
    if(!all.includes(path.join(root,'bin',target.startsWith('win32')?'ffprobe.exe':'ffprobe')))
      throw new Error('FFprobe is missing from the matched FFmpeg build.');
    await fs.mkdir(path.dirname(output),{recursive:true});
    await fs.rm(output,{recursive:true,force:true});
    await fs.cp(root,output,{recursive:true});
    if(!target.startsWith('win32')) {
      await fs.chmod(file,0o755);await fs.chmod(probe,0o755);
    }
    // Runtime check only on matching host CPU; cross-architecture Mac packages
    // are verified on a native runner during release QA.
    if((target===process.platform+'-'+process.arch)||
       (process.platform==='darwin'&&target==='darwin-x64'&&process.arch==='arm64')){
      const version=execFileSync(file,['-version'],{encoding:'utf8',timeout:12000,maxBuffer:512*1024});
      if(!version.startsWith('ffmpeg version') ||
        /--enable-(?:gpl|nonfree)(?:\s|$)/.test(version))
        throw new Error('Bundled FFmpeg is not an LGPL-only verified build.');
    }
    // Build provenance and exact source instructions accompany the binary.
    await fs.writeFile(path.join(output,'CHOMP-PROVENANCE.txt'),
      'FFmpeg LGPL-only distribution\nOrigin: '+item.url+'\nSHA256: '+item.sha256+
      '\nThe original FFmpeg and external library sources, build instructions and redistribution obligations are listed in docs/BUNDLED_FFMPEG.md.\n');
    console.log('Prepared bundled LGPL FFmpeg for '+target);
  }finally{await fs.rm(temp,{recursive:true,force:true});}
}
const requested=process.argv.slice(2);
const targets=requested.length?requested:process.platform==='darwin'?['darwin-x64','darwin-arm64']:
  process.platform==='win32'?['win32-x64']:[];
if(!targets.length)throw new Error('Bundling FFmpeg is supported on macOS or Windows.');
for(const target of targets) await stage(target);
