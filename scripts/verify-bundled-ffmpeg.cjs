'use strict';
// Verify prepared resource content, licensing, and runtime codec capabilities.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {detectFFmpeg,bundledPaths}=require('../electron/ffmpeg.cjs');

(async()=>{
  const targets=process.platform==='darwin'?['darwin-x64','darwin-arm64']:
    process.platform==='win32'?['win32-x64']:[];
  assert.ok(targets.length,'Native FFmpeg package check only supports macOS/Windows');
  for(const target of targets){
    const [platform,arch]=target.split('-');
    const paths=bundledPaths(path.resolve('vendor'),platform,arch);
    // prepared paths are in vendor/ffmpeg
    const executable=path.resolve('vendor','ffmpeg',target,'bin',platform==='win32'?'ffmpeg.exe':'ffmpeg');
    const probe=path.resolve('vendor','ffmpeg',target,'bin',platform==='win32'?'ffprobe.exe':'ffprobe');
    for(const f of [executable,probe,path.resolve('vendor','ffmpeg',target,'CHOMP-PROVENANCE.txt')]){
      assert.ok((await fs.stat(f)).size>50,'Required video engine file missing or empty: '+f);
    }
    const provenance=await fs.readFile(path.resolve('vendor','ffmpeg',target,'CHOMP-PROVENANCE.txt'),'utf8');
    assert.match(provenance,/SHA256: [a-f0-9]{64}/);
    if(platform===process.platform && arch===process.arch){
      const engine=await detectFFmpeg({executable,probe},{requireLGPL:true});
      assert.ok(engine,'The bundled FFmpeg engine does not execute.');
      assert.ok(engine.codecs.av1?.length || engine.codecs.vp9?.length,
        'The bundled engine should contain a modern video software encoder.');
      for(const output of ['mp4','mkv','webm','mov','gif'])
        assert.ok(engine.formats.includes(output));
      console.log('PASS native '+target+' FFmpeg '+engine.version);
    }else console.log('PASS packaged cross-architecture FFmpeg files present: '+target);
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
