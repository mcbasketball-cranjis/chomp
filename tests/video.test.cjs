const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { videoSupported, VIDEO_LIMIT, videoOptions, handBrakeArgs,
  progressFromText, processVideo, findHandBrake } = require('../electron/video.cjs');
const { scanFolder, prepareBatch, fingerprint, verifyFile } = require('../electron/folders.cjs');

async function withFixture(run) {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'chomp-video-test-'));
  const source = path.join(temp, 'source'), destination = path.join(temp, 'output');
  await fs.mkdir(source); await fs.mkdir(destination);
  const file = path.join(source, 'clip.mov');
  await fs.writeFile(file, Buffer.from('synthetic-video-fixture-no-real-media'));
  const snapshot = fingerprint(await fs.lstat(file));
  const entry = { path: file, snapshot, relative: 'clip.mov' };
  try { await run({ temp, source, destination, entry, file }); }
  finally { await fs.rm(temp, { recursive: true, force: true }); }
}

function fakeSpawn({ fail = false, delay = 0, onEncode = () => {} } = {}) {
  return (_binary, args, options) => {
    assert.equal(options.shell, false);
    const job = new EventEmitter();
    job.stdout = new PassThrough(); job.stderr = new PassThrough();
    const output = args[args.indexOf('--output')+1];
    let stopped = false;
    job.kill = () => { stopped = true; setImmediate(() => job.emit('close', -1)); };
    setTimeout(async () => {
      if (stopped) return;
      try {
        await fs.writeFile(output, Buffer.from('smaller synthetic encoded video'));
        onEncode(output, args);
        job.stderr.write('Encoding: task 1 of 1, 51.25 %\r');
        job.stdout.write('Encoding: task 1 of 1, 100.00 %\r');
        job.emit('close', fail ? 1 : 0);
      } catch (err) { job.emit('error', err); }
    }, delay);
    return job;
  };
}

test('HandBrake arguments use an allowlist and never a shell', () => {
  assert.equal(videoSupported.test('clip.MOV'), true);
  assert.equal(videoSupported.test('photo.png'), false);
  assert.equal(VIDEO_LIMIT, 16*1024*1024*1024);
  assert.deepEqual(handBrakeArgs('/tmp/source mov', '/tmp/out.mp4', {preset:'balanced',format:'mp4'}),
    ['--input','/tmp/source mov','--output','/tmp/out.mp4',
      '--min-duration','0','--preset','Fast 1080p30','--format','av_mp4']);
  assert.equal(videoOptions({preset:'quality',format:'mp4'}).preset,'HQ 1080p30 Surround');
  assert.deepEqual(videoOptions({preset:'small',format:'mkv'}),
    {preset:'Very Fast 720p30',format:'av_mkv',extension:'mkv'});
  assert.throws(()=>handBrakeArgs('a','b',{preset:'--help',format:'mp4'}),/Invalid video/);
  assert.throws(()=>handBrakeArgs('a','b',{preset:'quality',format:'../../bad'}),/Invalid video/);
  assert.equal(progressFromText('Encoding: task 1 of 2, 12.50 % (35 fps)'), 12.5);
  assert.equal(progressFromText('scanning title...'), null);
  assert.equal(progressFromText('Encoding: task 1 of 1, 150 %'), 100);
});

test('external engine detection does not accept an arbitrary command', async () => {
  assert.equal(await findHandBrake(process.execPath), null);
});

test('video file export publishes unique names and preserves untouched source', async () =>
  withFixture(async ({entry,destination,file}) => {
    const progress = [];
    const input = await fs.readFile(file);
    const result = await processVideo({
      executable:'fake-handbrake',entry,directory:destination,preset:'balanced',format:'mp4',
      verifySource:()=>verifyFile(entry),onProgress:value=>progress.push(value),
      spawnProcess:fakeSpawn()
    });
    assert.equal(result.filename,'clip-compressed.mp4');
    assert.equal((await fs.readFile(result.path)).toString(),'smaller synthetic encoded video');
    assert.deepEqual(await fs.readFile(file),input);
    assert.ok(progress.some(p=>p>=51));
    const next=await processVideo({
      executable:'fake-handbrake',entry,directory:destination,preset:'quality',format:'mp4',
      verifySource:()=>verifyFile(entry),spawnProcess:fakeSpawn()
    });
    assert.equal(next.filename,'clip-compressed (1).mp4');
    assert.equal((await fs.readdir(destination)).length,2,'temporary outputs are removed');
  }));

test('duplicated folders include video files and replace their copied version safely',async()=>
  withFixture(async ({source,destination,file})=>{
    const original=await fs.readFile(file);
    const root=await scanFolder(source);
    assert.equal(root.images,0);assert.equal(root.videos,1);
    assert.equal(root.entries.filter(e=>e.video).length,1);
    const batch=await prepareBatch([root],destination,'copy');
    const entry=root.entries.find(e=>e.video);
    const copiedOriginal=path.join(batch.paths[0],entry.relative);
    const result=await processVideo({
      executable:'fake-handbrake',entry,directory:batch.paths[0],
      format:'mkv',preset:'small', copiedOriginal,
      copySnapshot:batch.copySnapshots.get(copiedOriginal),
      verifySource:()=>verifyFile(entry),spawnProcess:fakeSpawn()
    });
    assert.equal(path.basename(result.path),'clip.mkv');
    await assert.rejects(fs.stat(copiedOriginal),{code:'ENOENT'});
    assert.deepEqual(await fs.readFile(file),original);
    assert.ok((await fs.stat(result.path)).size>0);
  }));

test('cancellation deletes partial outputs and retains copied input',async()=>
  withFixture(async ({entry,destination})=>{
    const original=await fs.readFile(entry.path);
    let active;
    const encoding=processVideo({
      executable:'fake-handbrake',entry,directory:destination,
      format:'mp4',preset:'balanced',
      verifySource:()=>verifyFile(entry),
      onJob:job=>{if(job)active=job;},
      spawnProcess:fakeSpawn({delay:100})
    });
    await new Promise(resolve=>setTimeout(resolve,20));
    assert.ok(active);
    active.cancel();
    await assert.rejects(encoding,/canceled/);
    assert.deepEqual(await fs.readdir(destination),[]);
    assert.deepEqual(await fs.readFile(entry.path),original);
  }));

test('video export refuses stale source and cleans temp file after encode',async()=>
  withFixture(async ({entry,destination})=>{
    await assert.rejects(processVideo({
      executable:'fake-handbrake',entry,directory:destination,
      format:'mp4',preset:'balanced',verifySource:()=>verifyFile(entry),
      spawnProcess:fakeSpawn({onEncode:()=>{entry.snapshot.mtimeMs=-123;}})
    }),/Source changed/);
    assert.deepEqual(await fs.readdir(destination),[]);
  }));
