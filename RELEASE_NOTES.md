## Chomp 1.3.0

- Renamed GatorSqoosh to Chomp.
- Cleaner layout with contained scrolling and no in-app theme selector or processing badge.
- System appearance on Windows; optional Appearance menu on Mac.
- Supports image inputs up to 512 MB and 160 megapixels; resize edge up to 32,768 pixels.
- Windows portable ZIP and setup installer. Portable packaging does not bypass Windows security policy.

- Windows setup wizard installs the application and supporting files, creates a Start menu shortcut, and provides an uninstaller. No admin rights are required.
- Portable Windows ZIP remains available; its extracted files must stay together.
- Mac DMGs support the standard drag-to-Applications installation.
- Optional Windows Authenticode signing through protected repository certificate secrets.
- Windows installer lifecycle tests and explicit Defender scan/signature reports in CI.

### Downloads

- Windows x64: run `Chomp-1.3.0-win-x64-Setup.exe`.
- Mac Apple Silicon: open the `mac-arm64` DMG and drag Chomp into Applications.
- Mac Intel: open the `mac-x64` DMG and drag Chomp into Applications.

All apps pass packaged desktop tests on their matching OS and architecture. Windows also tests the installed app and uninstallation; Mac checks the DMG's app and Applications shortcut.

The installer does not by itself remove SmartScreen's unknown-publisher warning. Windows packages remain unsigned unless a trusted certificate is configured. See `Defender-scan.json` for the hosted scanner result and exact hashes; a clean antivirus result does not establish SmartScreen reputation. Mac apps are not Apple-signed or notarized and may require approval in system security settings.
