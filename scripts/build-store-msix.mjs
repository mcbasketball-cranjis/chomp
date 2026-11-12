import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';

// Build an unsigned MSIX using the Windows SDK; Microsoft's Store signs it.
// The pinned electron-builder v26 lacks the native v27 MSIX target.
if (process.platform !== 'win32') throw new Error('MSIX packaging requires Windows and the Windows SDK.');
const fixture = process.argv.includes('--ci-fixture');
// Product identity is public: keeping it in source ensures every Store build
// (including unattended release builds) matches the reserved Partner Center app.
const reservedIdentity = JSON.parse(await fs.readFile('store/identity.json','utf8'));
const identity = {
  name: fixture ? 'Chomp.CIPackagingTest' : process.env.CHOMP_STORE_PACKAGE_NAME || reservedIdentity.name,
  publisher: fixture ? 'CN=Chomp CI Packaging Test' : process.env.CHOMP_STORE_PUBLISHER || reservedIdentity.publisher,
  publisherDisplayName: fixture ? 'Chomp CI Packaging Test' : process.env.CHOMP_STORE_PUBLISHER_DISPLAY_NAME || reservedIdentity.publisherDisplayName
};
if (!identity.name || !identity.publisher || !identity.publisherDisplayName)
  throw new Error('Set CHOMP_STORE_PACKAGE_NAME, CHOMP_STORE_PUBLISHER and CHOMP_STORE_PUBLISHER_DISPLAY_NAME from Partner Center > Product identity.');
if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]{2,49}$/.test(identity.name) || /[.]$|[.]{2}/.test(identity.name))
  throw new Error('Invalid Store Package Identity Name.');
if (!/^CN=[^<>"\r\n]{2,}/i.test(identity.publisher) || identity.publisher.length > 512)
  throw new Error('Invalid Store Publisher distinguished name.');
if (identity.publisherDisplayName.length > 256 || /[\u0000-\u001f]/.test(identity.publisherDisplayName))
  throw new Error('Invalid publisher display name.');
const xml=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const pkg=JSON.parse(await fs.readFile('package.json','utf8'));
if(!/^\d+\.\d+\.\d+$/.test(pkg.version))throw new Error('MSIX requires numeric app version.');
const input=path.resolve('release/win-unpacked');
await fs.access(path.join(input,'Chomp.exe')).catch(()=>{throw new Error('Missing win-unpacked/Chomp.exe; run pnpm dist:win first.');});
async function findSdk(){
  if(process.env.MAKEAPPX_PATH){await fs.access(process.env.MAKEAPPX_PATH);return process.env.MAKEAPPX_PATH;}
  for(const root of [process.env['ProgramFiles(x86)'],'C:\\Program Files (x86)'].filter(Boolean)){
    const bin=path.join(root,'Windows Kits','10','bin');
    let versions;try{versions=(await fs.readdir(bin)).filter(v=>/^10\.\d+\.\d+\.\d+$/.test(v));}catch{continue;}
    versions.sort((a,b)=>{const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<4;i++)if(x[i]!==y[i])return y[i]-x[i];return 0;});
    for(const version of versions){const tool=path.join(bin,version,'x64','makeappx.exe');try{await fs.access(tool);return tool;}catch{}}
  }
  throw new Error('Missing makeappx.exe; install Windows SDK.');
}
const makeappx=await findSdk();
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'chomp-msix-'));
const stage=path.join(temp,'package');
const output=path.resolve('release','Chomp-'+pkg.version+'-win-x64-Store-'+(fixture?'CI-TEST-':'')+'unsigned.msix');
try{
  await fs.cp(input,stage,{recursive:true,force:true});
  // Distinguishes Store packages from NSIS even if process.windowsStore is unset.
  await fs.writeFile(path.join(stage,'chomp-store-package.json'),'{"store":true}\n');
  const assets=path.join(stage,'Assets');
  await fs.mkdir(assets,{recursive:true});
  for(const [filename,w,h] of [
    ['StoreLogo.png',50,50],['Square150x150Logo.png',150,150],
    ['Square44x44Logo.png',44,44],['Wide310x150Logo.png',310,150]
  ]){
    await sharp('assets/icon-source.png')
      .resize(w,h,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}})
      .png().toFile(path.join(assets,filename));
  }
  const manifest=[
    '<?xml version="1.0" encoding="utf-8"?>',
    '<Package xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"',
    ' xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"',
    ' xmlns:uap10="http://schemas.microsoft.com/appx/manifest/uap/windows10/10"',
    ' xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"',
    ' IgnorableNamespaces="uap uap10 rescap">',
    '  <Identity Name="'+xml(identity.name)+'" Publisher="'+xml(identity.publisher)+'"',
    '    Version="'+pkg.version+'.0" ProcessorArchitecture="x64" />',
    '  <Properties>',
    '    <DisplayName>Chomp</DisplayName>',
    '    <PublisherDisplayName>'+xml(identity.publisherDisplayName)+'</PublisherDisplayName>',
    '    <Description>Local image compression and vector tracing</Description>',
    '    <Logo>Assets\\StoreLogo.png</Logo>',
    '  </Properties>',
    '  <Resources><Resource Language="en-US"/></Resources>',
    '  <Dependencies><TargetDeviceFamily Name="Windows.Desktop"',
    '    MinVersion="10.0.19041.0" MaxVersionTested="10.0.26100.0" /></Dependencies>',
    '  <Applications><Application Id="Chomp" Executable="Chomp.exe"',
    '    uap10:RuntimeBehavior="packagedClassicApp" uap10:TrustLevel="mediumIL">',
    '    <uap:VisualElements DisplayName="Chomp" Description="Local image compression and vector tracing"',
    '      BackgroundColor="transparent" Square150x150Logo="Assets\\Square150x150Logo.png"',
    '      Square44x44Logo="Assets\\Square44x44Logo.png">',
    '      <uap:DefaultTile Wide310x150Logo="Assets\\Wide310x150Logo.png"/>',
    '    </uap:VisualElements>',
    '  </Application></Applications>',
    '  <Capabilities><rescap:Capability Name="runFullTrust"/></Capabilities>',
    '</Package>'
  ].join('\n');
  await fs.writeFile(path.join(stage,'AppxManifest.xml'),manifest,'utf8');
  await fs.mkdir(path.dirname(output),{recursive:true});
  const pack=spawnSync(makeappx,['pack','/o','/v','/d',stage,'/p',output],{encoding:'utf8',maxBuffer:16*1024*1024});
  if(pack.status!==0)throw new Error('MakeAppx pack failed: '+(pack.stderr||pack.stdout||pack.error?.message));
  const stat=await fs.stat(output);
  if(stat.size<1024*1024)throw new Error('MSIX package unexpectedly small.');
  const check=path.join(temp,'check');
  const unpack=spawnSync(makeappx,['unpack','/o','/p',output,'/d',check],{encoding:'utf8',maxBuffer:16*1024*1024});
  if(unpack.status!==0)throw new Error('MakeAppx unpack failed: '+(unpack.stderr||unpack.stdout||unpack.error?.message));
  for(const file of ['AppxManifest.xml','Chomp.exe','chomp-store-package.json','Assets/StoreLogo.png','Assets/Square44x44Logo.png','Assets/Square150x150Logo.png']){
    await fs.access(path.join(check,file));
  }
  const result=await fs.readFile(path.join(check,'AppxManifest.xml'),'utf8');
  if(!result.includes('Name="'+xml(identity.name)+'"')||
     !result.includes('Publisher="'+xml(identity.publisher)+'"')||
     !result.includes('<PublisherDisplayName>'+xml(identity.publisherDisplayName)+'</PublisherDisplayName>'))
    throw new Error('Packaged MSIX manifest identity mismatch.');
  console.log('PASS: '+(fixture?'CI fixture':'Store upload')+' MSIX: '+output+' ('+Math.round(stat.size/1048576)+' MiB)');
  console.log('This MSIX is unsigned for Microsoft Store submission, not direct sideloading.');
}finally{
  await fs.rm(temp,{recursive:true,force:true,maxRetries:4,retryDelay:300});
}
