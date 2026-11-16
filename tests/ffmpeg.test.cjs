const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {CODEC_ENCODERS,OUTPUT_FORMATS,bundledPaths,detectEncoders,codecsForEncoders,
  supportedContainers,selectEncoder,validateVideoSettings,ffmpegArgs,progressFromFFmpeg}=
  require('../electron/ffmpeg.cjs');
test('bundled paths select exact architecture and are never user-controlled',()=>{
  assert.deepEqual(bundledPaths('/app/resources','win32','x64'),{
    executable:path.join('/app/resources','ffmpeg','win32-x64','bin','ffmpeg.exe'),
    probe:path.join('/app/resources','ffmpeg','win32-x64','bin','ffprobe.exe')
  });
  assert.equal(bundledPaths('/resources','linux','x64'),null);
  assert.equal(bundledPaths('/resources','darwin','mips'),null);
});
const sample=`Encoders:
 V..... = Video
 A..... = Audio
 V....D libvpx-vp9    libvpx VP9
 V..... libaom-av1    AV1 encoder
 V..... h264_videotoolbox H.264 VideoToolbox
 V..... gif          GIF image
 A..... aac          AAC
`;
test('codec detection selects usable video encoders and output containers',()=>{
  const found=detectEncoders(sample);
  assert.ok(found.has('libvpx-vp9'));
  assert.ok(found.has('libaom-av1'));
  assert.ok(found.has('h264_videotoolbox'));
  assert.ok(found.has('gif'));
  assert.deepEqual(codecsForEncoders(found).hevc,[]);
  assert.deepEqual(supportedContainers('vp9'),['mkv','webm']);
  assert.equal(selectEncoder('h264',found),'h264_videotoolbox');
  assert.throws(()=>selectEncoder('hevc',found),/does not support/);
});
test('invalid codec/container combinations and arbitrary arguments rejected',()=>{
  const found=detectEncoders(sample);
  assert.throws(()=>validateVideoSettings({codec:'vp9',format:'mp4',preset:'balanced'},found),/valid codec/);
  assert.throws(()=>validateVideoSettings({codec:'h264',format:'../../',preset:'balanced'},found),/valid codec/);
  assert.throws(()=>validateVideoSettings({codec:'h264',format:'mp4',preset:'--help'},found),/valid codec/);
  assert.throws(()=>validateVideoSettings({codec:'h264',format:'mp4',preset:'balanced'},new Set()),/does not support/);
});
test('FFmpeg command arrays use no shell and preserve local paths as one argument',()=>{
  const found=detectEncoders(sample);
  const h=ffmpegArgs('C:\\Users\\test\\my clip.mp4','C:\\output\\my movie.mov',
    {codec:'h264',format:'mov',preset:'balanced'},found);
  assert.equal(h[h.indexOf('-i')+1],'C:\\Users\\test\\my clip.mp4');
  assert.equal(h.at(-1),'C:\\output\\my movie.mov');
  assert.ok(h.includes('h264_videotoolbox'));
  assert.ok(h.includes('-progress'));
  assert.ok(h.includes('0:a:0?'));
  const w=ffmpegArgs('source','out.webm',{codec:'vp9',format:'webm',preset:'quality'},found);
  assert.ok(w.includes('libvpx-vp9'));
  assert.ok(w.includes('libopus'));
  assert.ok(w.includes('0'));
  const gif=ffmpegArgs('source','out.gif',{codec:'gif',format:'gif',preset:'small'},found);
  assert.ok(gif.includes('-an'));
  assert.ok(!gif.includes('libopus'));
});
test('FFmpeg progress parses microsecond timestamps and clamps before finish',()=>{
  assert.equal(progressFromFFmpeg('out_time_us=1500000\nprogress=continue\n',3),50);
  assert.equal(progressFromFFmpeg('out_time_ms=3000000\n',3),99.9);
  assert.equal(progressFromFFmpeg('no progress',3),null);
  assert.equal(progressFromFFmpeg('out_time_us=0',0),null);
});
