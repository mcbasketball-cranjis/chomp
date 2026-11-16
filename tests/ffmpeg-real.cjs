'use strict';
// Real FFmpeg smoke: synthetic frames only, no customer videos in git.
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {detectFFmpeg,transcodeFFmpeg,durationOf}=require('../electron/ffmpeg.cjs');
const {processVideo}=require('../electron/video.cjs');
const {fingerprint,verifyFile}=require('../electron/folders.cjs');

function cmd(tool,args,timeout=30000){
  return execFileSync(tool,args,{encoding:'utf8',timeout,maxBuffer:2*1024*1024});
}
(async()=>{
  const executable=process.env.CHOMP_FFMPEG_BINARY||'ffmpeg';
  const probe=process.env.CHOMP_FFPROBE_BINARY||'ffprobe';
  const engine=await detectFFmpeg({executable,probe});
  assert.ok(engine,'FFmpeg is required for real video test');
  assert.ok(engine.codecs.vp9.length,'Test engine must provide VP9 software codec');
  assert.ok(engine.codecs.gif.length,'Test engine must provide GIF encoder');
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'chomp-ffmpeg-smoke-'));
  try{
    const file=path.join(temp,'synthetic.avi'),directory=path.join(temp,'out');
    await fs.mkdir(directory);
    cmd(executable,['-hide_banner','-loglevel','error','-y','-f','lavfi',
      '-i','testsrc2=size=320x180:rate=24','-t','2','-c:v','mpeg4',file]);
    const original=await fs.readFile(file);
    const entry={path:await fs.realpath(file),
      relative:'synthetic.avi',snapshot:fingerprint(await fs.lstat(file))};
    const duration=await durationOf(probe,entry.path);
    assert.ok(duration>=1.8,'Input should contain two seconds of real video');

    for(const options of [
      {codec:'vp9',format:'webm',preset:'small'},
      {codec:'gif',format:'gif',preset:'balanced'}
    ]){
      const progresses=[];
      const output=await processVideo({
        executable,entry,directory,...options,verifySource:()=>verifyFile(entry),
        encodeVideo:(source,target,settings,onProgress)=>
          transcodeFFmpeg({...engine,duration},source,target,settings,onProgress),
        onProgress:value=>progresses.push(value)
      });
      assert.ok(output.size>1024,options.codec+' produced a nonempty output');
      assert.ok(progresses.includes(100),'Final encoding progress must reach 100');
      const decoded=cmd(probe,['-v','error','-show_entries',
        'stream=codec_name,width,height','-of','default=noprint_wrappers=1',output.path]);
      assert.match(decoded,options.codec==='vp9'?/codec_name=vp9/:/codec_name=gif/);
      assert.deepEqual(await fs.readFile(file),original,'Never modify original input');
      console.log('PASS '+options.codec+' -> '+options.format+' ('+output.size+' bytes)');
    }
    const files=await fs.readdir(directory);
    assert.equal(files.length,2,'No partial output folders remain');
  }finally{await fs.rm(temp,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
