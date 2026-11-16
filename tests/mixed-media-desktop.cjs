const { _electron: electron, expect } = require('@playwright/test');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const os=require('node:os');
const {execFileSync}=require('node:child_process');

const root=path.resolve(__dirname,'..');
function cmd(file,args){
  return execFileSync(file,args,{encoding:'utf8',timeout:45000,maxBuffer:2*1024*1024});
}
(async()=>{
  if(process.platform!=='linux')throw new Error('Run mixed-media desktop smoke on Linux CI.');
  const ffmpeg=cmd('which',['ffmpeg']).trim();
  const ffprobe=cmd('which',['ffprobe']).trim();
  const work=await fs.mkdtemp(path.join(os.tmpdir(),'chomp-mixed-bulk-'));
  const profile=path.join(work,'profile');
  const env={...process.env,CHOMP_FFMPEG_BINARY:ffmpeg,CHOMP_FFPROBE_BINARY:ffprobe};
  delete env.ELECTRON_RUN_AS_NODE;
  const app=await electron.launch({args:[root,'--user-data-dir='+profile],env});
  try{
    const page=await app.firstWindow();await page.waitForSelector('#compress');
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const engine=await page.evaluate(()=>window.desktop.getVideoEngine());
    assert.equal(engine.available,true,'FFmpeg should be available for real video test');
    assert.ok(engine.codecs.vp9?.length,'VP9 software encoder required');

    const pngBytes=await page.evaluate(()=>{
      const canvas=document.createElement('canvas');
      canvas.width=320;canvas.height=220;
      const ctx=canvas.getContext('2d');
      ctx.fillStyle='#a6dfd4';ctx.fillRect(0,0,320,220);
      ctx.fillStyle='#053c40';ctx.fillRect(35,30,250,155);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    const image=path.join(work,'sample.png');
    const video=path.join(work,'clip.avi');
    await fs.writeFile(image,Buffer.from(pngBytes,'base64'));
    cmd(ffmpeg,['-hide_banner','-loglevel','error','-y',
      '-f','lavfi','-i','testsrc2=size=320x180:rate=12',
      '-t','2','-c:v','mpeg4','-q:v','6',video]);
    const imageOriginal=await fs.readFile(image);
    const videoOriginal=await fs.readFile(video);

    async function setDialogs({files=[],folders=[],output}){
      await app.evaluate(({dialog},choice)=>{
        dialog.showOpenDialog=async(_win,options)=>{
          const selected=options.properties.includes('createDirectory')?[choice.output]:
            options.properties.includes('openDirectory')?choice.folders:choice.files;
          return {canceled:false,filePaths:selected};
        };
      },{files,folders,output});
    }
    async function runBatch({folderMode,folder,output}){
      await fs.mkdir(output,{recursive:true});
      await setDialogs({files:folder?[]:[image,video],folders:folder?[folder]:[],output});
      await page.click(folder?'#add-folder':'#add');
      await expect(page.locator('.image-row')).toHaveCount(2);
      await expect(page.locator('#video-controls')).toBeVisible();
      await expect(page.locator('#image-format-controls')).toBeVisible();
      await expect(page.locator('[data-workspace="compress"]')).toHaveClass(/active/);
      await expect(page.locator('#video-preview')).toHaveCount(1);
      assert.equal(await page.locator('#video-engine-state').count(),0,
        'No encoder implementation copy should be visible');
      assert.equal((await page.locator('#video-preview').textContent()).includes('HandBrake'),false);
      if(folderMode){
        await expect(page.locator('#quick-panel')).toBeVisible();
        await page.locator('[name="folder-mode"][value="'+folderMode+'"]').check();
      }
      await page.selectOption('#format','webp');
      await page.selectOption('#video-codec','vp9');
      await page.selectOption('#video-format','webm');
      await page.click('#folder');
      await page.click('#compress');
      await expect(page.locator('#cancel')).toHaveText('Stop',{timeout:10000});
      await expect(page.locator('#summary')).toContainText('2 saved',{timeout:90000});
      await expect(page.locator('.status.done')).toHaveCount(2);
      const titles=await page.locator('.image-row').evaluateAll(rows=>
        rows.map(row=>row.getAttribute('title')));
      assert.ok(titles.some(t=>t?.endsWith('.webm')),'Video must be compressed in the same batch');
      assert.ok(titles.some(t=>t?.endsWith('.webp')),'Image must be compressed in the same batch');
      const outDir=folderMode?path.join(output,path.basename(folder)+'-compressed'):output;
      const outputs=await fs.readdir(outDir);
      const encodedVideo=outputs.find(n=>n.endsWith('.webm'));
      const encodedImage=outputs.find(n=>n.endsWith('.webp'));
      assert.ok(encodedVideo && encodedImage,'Both media types must be written to the output folder');
      const probeOut=cmd(ffprobe,['-v','error','-select_streams','v:0','-show_entries',
        'stream=codec_name','-of','default=nokey=1:noprint_wrappers=1',
        path.join(outDir,encodedVideo)]).trim();
      assert.equal(probeOut,'vp9','Output must contain an actual VP9 stream');
      const webp=await fs.readFile(path.join(outDir,encodedImage));
      assert.equal(webp.toString('ascii',0,4),'RIFF','Image should be encoded as WebP');
      assert.deepEqual(await fs.readFile(image),imageOriginal);
      assert.deepEqual(await fs.readFile(video),videoOriginal);
      console.log('PASS mixed media '+(folderMode||'individual files')+
        ' batch: one real VP9 WebM + one WebP image; sources unchanged');
      await page.click('#clear');
    }

    await runBatch({output:path.join(work,'output-files')});
    const folder=path.join(work,'mixed-source');
    await fs.mkdir(folder);
    await fs.copyFile(image,path.join(folder,'sample.png'));
    await fs.copyFile(video,path.join(folder,'clip.avi'));
    await runBatch({folderMode:'copy',folder,output:path.join(work,'output-folder')});
    assert.deepEqual(await fs.readFile(path.join(folder,'sample.png')),imageOriginal);
    assert.deepEqual(await fs.readFile(path.join(folder,'clip.avi')),videoOriginal);
    assert.deepEqual(errors,[],'No renderer errors');
    console.log('PASS mixed-media bulk compression UI and output safety.');
  }finally{await app.close();await fs.rm(work,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
