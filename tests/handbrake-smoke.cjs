'use strict';
// A real, end-to-end HandBrakeCLI encoding smoke test using ONLY synthetic media.
// Requires ffmpeg, ffprobe and an independently installed HandBrakeCLI.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { findHandBrake, processVideo } = require('../electron/video.cjs');
const { fingerprint, verifyFile } = require('../electron/folders.cjs');

function command(binary, args) {
  const run = spawnSync(binary, args, { encoding:'utf8', windowsHide:true,
    timeout:30000, maxBuffer:2*1024*1024 });
  if (run.error || run.status!==0)
    throw new Error(binary+' failed: '+(run.stderr || run.error?.message || run.stdout || run.status));
  return run.stdout;
}

(async () => {
  const engine=await findHandBrake();
  assert.ok(engine?.executable,'Install HandBrakeCLI to run the real video smoke test.');
  console.log('Using HandBrakeCLI '+engine.version);
  command('ffmpeg',['-version']);
  command('ffprobe',['-version']);

  const folder=await fs.mkdtemp(path.join(os.tmpdir(),'chomp-handbrake-real-'));
  const source=path.join(folder,'synthetic-source.mov');
  const destination=path.join(folder,'output');
  try {
    await fs.mkdir(destination);
    command('ffmpeg', ['-hide_banner','-loglevel','error','-y',
      '-f','lavfi','-i','testsrc2=size=320x180:rate=24',
      '-f','lavfi','-i','sine=frequency=440:sample_rate=48000',
      '-t','3','-c:v','mpeg4','-q:v','6','-c:a','aac','-shortest',source]);
    const original=await fs.readFile(source);
    const entry={path:await fs.realpath(source),relative:path.basename(source),
      snapshot:fingerprint(await fs.lstat(source))};
    assert.ok(original.byteLength>1024,'Synthetic source should contain real video packets.');

    for(const [preset,format] of [
      ['small','mp4'],['balanced','mkv'],['quality','mp4']
    ]) {
      let lastProgress=0, active=null;
      const task=processVideo({
        executable:engine.executable,entry,directory:destination,
        format,preset,verifySource:()=>verifyFile(entry),
        onProgress:p=>{lastProgress=Math.max(lastProgress,p);},
        onJob:job=>{active=job;}
      });
      let timer;
      const timed=new Promise((_,reject)=>{
        timer=setTimeout(()=>{active?.cancel();reject(new Error('Timed out encoding '+preset));},120000);
      });
      let result;
      try { result=await Promise.race([task,timed]); }
      finally { clearTimeout(timer); }
      assert.ok(result.size>1024,preset+' produced an unexpectedly small output');
      assert.ok(result.path.endsWith('.'+format),'Output container extension mismatch');
      const details=JSON.parse(command('ffprobe',[
        '-v','error','-show_entries','format=duration:stream=codec_type,codec_name',
        '-of','json',result.path]));
      assert.ok(details.streams.some(s=>s.codec_type==='video' && s.codec_name==='h264'),
        preset+' must produce a decodable H.264 video stream');
      assert.ok(Number(details.format.duration)>1,preset+' video duration is too short');
      assert.deepEqual(await fs.readFile(source),original,'Never modify the original recording');
      console.log('PASS '+preset+' -> '+format+': '+result.size+' bytes, '+lastProgress.toFixed(1)+'% progress');
    }
    const files=await fs.readdir(destination);
    assert.equal(files.length,3,'No failed or temporary output directories should remain');
    console.log('PASS: Three actual HandBrakeCLI encodes, codec probing, isolated outputs and unchanged original.');
  } finally { await fs.rm(folder,{recursive:true,force:true}); }
})().catch(e=>{console.error(e);process.exitCode=1;});
