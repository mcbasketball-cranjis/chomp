// Real NSIS installers with the previous identities/versions, used only on CI.
import { spawnSync } from 'node:child_process';
if (process.env.GITHUB_ACTIONS !== 'true' || process.platform !== 'win32') throw new Error('CI Windows only.');
for (const [product, version, id, output] of [
  ['GatorSqoosh', '1.2.1', 'gatorsqoosh', 'legacy-release'],
  ['Chomp', '1.3.0', 'chomp', 'previous-release'],
]) {
  const result = spawnSync('pnpm.cmd', ['exec', 'electron-builder', '--win', 'nsis', '--publish', 'never',
    `--config.productName=${product}`, `--config.appId=io.github.mcbasketballcranjis.${id}`,
    `--config.extraMetadata.name=${id}`, `--config.extraMetadata.version=${version}`,
    `--config.directories.output=${output}`, '--config.nsis.include=installer/legacy-fixture.nsh',
    `--config.nsis.artifactName=${product}-fixture-Setup.exe`,
  ], { stdio: 'inherit', shell: true, env: { ...process.env, CSC_LINK: '', CSC_KEY_PASSWORD: '', CSC_IDENTITY_AUTO_DISCOVERY: 'false' } });
  if (result.status !== 0) process.exit(result.status || 1);
}
