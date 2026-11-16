'use strict';
// Chomp's local native-video engine. Packaged releases use only checksum-pinned,
// LGPL configured FFmpeg executables placed in app resources during CI builds.
// The executable is an internal implementation detail; no shell is involved.
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const runFile = promisify(execFile);

const CODEC_ENCODERS = Object.freeze({
  h264: ['libopenh264','h264_videotoolbox','h264_mf','h264_nvenc','h264_qsv','h264_amf'],
  hevc: ['hevc_videotoolbox','hevc_nvenc','hevc_qsv','hevc_amf','hevc_mf'],
  av1: ['libsvtav1','libaom-av1','av1_nvenc','av1_qsv'],
  vp9: ['libvpx-vp9'],
  gif: ['gif']
});
const OUTPUT_FORMATS = Object.freeze({
  mp4: ['h264','hevc','av1'],
  mkv: ['h264','hevc','av1','vp9'],
  mov: ['h264','hevc'],
  webm: ['vp9','av1'],
  gif: ['gif']
});
const QUALITY = Object.freeze({
  small: { width: 1280, height: 720, fps: 30, bitrate: '1600k', crf: 38 },
  balanced: { width: 1920, height: 1080, fps: null, bitrate: '3500k', crf: 30 },
  quality: { width: null, height: null, fps: null, bitrate: '8500k', crf: 24 }
});
const CODES = Object.freeze(Object.keys(CODEC_ENCODERS));
const CONTAINERS = Object.freeze(Object.keys(OUTPUT_FORMATS));

function bundledPaths(resourcesPath, platform=process.platform, arch=process.arch) {
  if (!['win32','darwin'].includes(platform) || !['x64','arm64'].includes(arch)) return null;
  const dir=path.join(resourcesPath,'ffmpeg',platform+'-'+arch);
  return {
    executable:path.join(dir,'bin',platform==='win32'?'ffmpeg.exe':'ffmpeg'),
    probe:path.join(dir,'bin',platform==='win32'?'ffprobe.exe':'ffprobe')
  };
}
function detectEncoders(output) {
  const encoders=new Set();
  for(const line of String(output).split(/\r?\n/)) {
    const match=line.match(/^\s*[VAS\.][A-Z\.]{5}\s+(\S+)\s/);
    if(match) encoders.add(match[1]);
  }
  // Some FFmpeg builds use output formats other than six-flag encoder listings.
  return encoders;
}
function codecsForEncoders(encoders) {
  const result={};
  for(const [codec, candidates] of Object.entries(CODEC_ENCODERS))
    result[codec]=candidates.filter(candidate=>encoders.has(candidate));
  return result;
}
function supportedContainers(codec) {
  return CONTAINERS.filter(container=>OUTPUT_FORMATS[container].includes(codec));
}
function selectEncoder(codec, encoders) {
  const preferred=CODEC_ENCODERS[codec];
  if(!preferred)throw new Error('Unsupported video codec.');
  const chosen=preferred.find(name=>encoders.has(name));
  if(!chosen)throw new Error('This device or FFmpeg build does not support '+codec.toUpperCase()+' encoding.');
  return chosen;
}
function validateVideoSettings(options, encoders) {
  if(!options || !CODES.includes(options.codec) ||
     !CONTAINERS.includes(options.format) || !Object.hasOwn(QUALITY,options.preset) ||
     !OUTPUT_FORMATS[options.format].includes(options.codec))
    throw new Error('Choose a valid codec and compatible video container.');
  return { encoder: selectEncoder(options.codec, encoders), quality:QUALITY[options.preset] };
}
function ffmpegArgs(input, output, options, encoders) {
  const { encoder, quality }=validateVideoSettings(options,encoders);
  const args=['-hide_banner','-nostdin','-y','-i',input,'-map','0:v:0'];
  if(options.codec==='gif') {
    const gifSize=quality.width ? Math.min(quality.width,640) : 800;
    args.push('-an','-sn','-dn','-vf','fps=12,scale=min(iw\\,'+gifSize+'):-2:flags=lanczos',
      '-c:v','gif','-loop','0','-f','gif');
  } else {
    // Optional first audio track; subtitles and data can use unsupported codecs.
    args.push('-map','0:a:0?','-sn','-dn');
    const filters=[];
    if(quality.width && quality.height)
      filters.push("scale=w='min(iw,"+quality.width+")':h='min(ih,"+quality.height+")'"+
        ':force_original_aspect_ratio=decrease:force_divisible_by=2');
    if(quality.fps) filters.push('fps='+quality.fps);
    filters.push('format=yuv420p');
    args.push('-vf',filters.join(','),'-c:v',encoder);
    if(encoder==='libaom-av1'||encoder==='libvpx-vp9')
      args.push('-crf',String(options.codec==='vp9'?quality.crf:quality.crf),
        '-b:v','0','-cpu-used',options.preset==='small'?'7':options.preset==='quality'?'4':'6');
    else if(encoder==='libsvtav1')
      args.push('-crf',String(quality.crf),'-preset',
        options.preset==='small'?'10':options.preset==='quality'?'5':'8');
    else args.push('-b:v',quality.bitrate);
    if(encoder.endsWith('_videotoolbox'))args.push('-allow_sw','1');
    if(options.codec==='hevc' && (options.format==='mp4'||options.format==='mov'))
      args.push('-tag:v','hvc1');
    if(options.format==='webm')args.push('-c:a','libopus','-b:a','128k');
    else args.push('-c:a','aac','-b:a','160k');
    if(options.format==='mp4'||options.format==='mov')args.push('-movflags','+faststart');
  }
  args.push('-progress','pipe:1','-nostats',output);
  return args;
}
function progressFromFFmpeg(text, durationSeconds) {
  if(!(durationSeconds>0))return null;
  const matches=[...String(text).matchAll(/out_time_(?:us|ms)=(\d+)/g)];
  if(!matches.length)return null;
  const microseconds=Number(matches.at(-1)[1]);
  return Number.isFinite(microseconds)?Math.min(99.9,Math.max(0,microseconds/(durationSeconds*10000))):null;
}
function transcodeFFmpeg(engine,input,output,options,onProgress=()=>{},spawnProcess=spawn) {
  const args=ffmpegArgs(input,output,options,new Set(engine.encoders));
  let child=null,canceled=false,tail='',log='';
  const promise=new Promise((resolve,reject)=>{
    try { child=spawnProcess(engine.executable,args,{
      shell:false,windowsHide:true,stdio:['ignore','pipe','pipe'],
      cwd:path.dirname(input)
    });}catch(e){reject(e);return;}
    child.stdout.on('data',data=>{
      tail=(tail+String(data)).slice(-1200);
      const progress=progressFromFFmpeg(tail,engine.duration);
      if(progress!==null)onProgress(progress);
    });
    child.stderr.on('data',data=>{log=(log+String(data)).slice(-8000);});
    child.on('error',reject);
    child.on('close',code=>{
      if(canceled)return reject(new Error('Video compression canceled.'));
      if(code!==0)return reject(new Error('FFmpeg could not encode this media. '+
        log.replace(/[\r\n]+/g,' ').slice(-450)));
      onProgress(100);resolve();
    });
  });
  return {promise,cancel(){canceled=true;child?.kill();}};
}
async function durationOf(probe, source) {
  if(!probe)return 0;
  try {
    const {stdout}=await runFile(probe,[
      '-v','error','-show_entries','format=duration',
      '-of','default=noprint_wrappers=1:nokey=1',source
    ],{timeout:12000,maxBuffer:128*1024,windowsHide:true});
    const value=Number(stdout.trim());return Number.isFinite(value)&&value>0?value:0;
  }catch{return 0;}
}
async function detectFFmpeg(paths,{requireLGPL=false}={}) {
  if(!paths)return null;
  try {
    await Promise.all([fs.access(paths.executable),fs.access(paths.probe)]);
    const [version,encoders]=await Promise.all([
      runFile(paths.executable,['-version'],{timeout:10000,windowsHide:true,maxBuffer:512*1024}),
      runFile(paths.executable,['-hide_banner','-encoders'],{timeout:10000,windowsHide:true,maxBuffer:2*1024*1024})
    ]);
    if(!/^ffmpeg version /i.test(version.stdout))return null;
    if(requireLGPL && /--enable-(?:gpl|nonfree)(?:\s|$)/.test(version.stdout))
      throw new Error('Bundled FFmpeg contains forbidden GPL/nonfree build flags.');
    const found=detectEncoders(encoders.stdout);
    return {
      ...paths, version:version.stdout.match(/^ffmpeg version\s+(\S+)/i)?.[1]||'',
      encoders:[...found],codecs:codecsForEncoders(found),
      formats:CONTAINERS
    };
  }catch(e){
    if(e.message?.includes('forbidden GPL'))throw e;
    return null;
  }
}
module.exports={CODEC_ENCODERS,OUTPUT_FORMATS,QUALITY,bundledPaths,detectEncoders,
  codecsForEncoders,supportedContainers,selectEncoder,validateVideoSettings,
  ffmpegArgs,progressFromFFmpeg,transcodeFFmpeg,durationOf,detectFFmpeg};
