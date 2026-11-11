## GatorSqoosh 1.2.1

- Windows setup wizard installs the application and supporting files, creates a Start menu shortcut, and provides an uninstaller. No admin rights are required.
- Portable Windows ZIP remains available; its extracted files must stay together.
- Mac DMGs support the standard drag-to-Applications installation.
- Optional Windows Authenticode signing through protected repository certificate secrets.
- Windows installer lifecycle tests and explicit Defender scan/signature reports in CI.

### Downloads

- Windows x64: run `GatorSqoosh-1.2.1-win-x64-Setup.exe`.
- Mac Apple Silicon: open the `mac-arm64` DMG and drag GatorSqoosh into Applications.
- Mac Intel: open the `mac-x64` DMG and drag GatorSqoosh into Applications.

All apps pass packaged desktop tests on their matching OS and architecture. Windows also tests the installed app and uninstallation; Mac checks the DMG's app and Applications shortcut.

The installer does not by itself remove SmartScreen's unknown-publisher warning. Windows packages remain unsigned unless a trusted certificate is configured. See `Defender-scan.json` for the hosted scanner result and exact hashes; a clean antivirus result does not establish SmartScreen reputation. Mac apps are not Apple-signed or notarized and may require approval in system security settings.
