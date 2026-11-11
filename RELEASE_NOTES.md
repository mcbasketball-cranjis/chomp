## Chomp 1.3.1

- Windows setup updates installed Chomp versions and removes installed GatorSqoosh copies for the same Windows user, including old shortcuts and uninstall registration. User data is retained. Portable copies must be replaced manually.
- Every Windows ZIP includes **Sign on this PC.cmd**, **Sign installed Chomp.cmd**, the PowerShell signing script, and instructions. Existing local Chomp/GatorSqoosh signing keys are reused where available; private keys stay on that computer.
- CI tests previous-version installers, migration, repeat upgrades, user-data preservation, local signing, and signing-kit contents.

### Windows downloads

- [Installer + signing kit](https://github.com/mcbasketball-cranjis/chomp/releases/download/v1.3.1/Chomp-1.3.1-win-x64-Setup.zip): extract everything, run **Sign on this PC.cmd**, then Setup.exe. After installing, use **Sign installed Chomp.cmd** if the installed app also needs signing.
- [Single-file portable + signing kit](https://github.com/mcbasketball-cranjis/chomp/releases/download/v1.3.1/Chomp-1.3.1-win-x64-Portable.zip): extract everything, run **Sign on this PC.cmd**, then Portable.exe.
- [Portable folder + signing kit](https://github.com/mcbasketball-cranjis/chomp/releases/download/v1.3.1/Chomp-1.3.1-win-x64.zip): extract everything, run **Sign on this PC.cmd**, then Chomp.exe. Keep its supporting app files together.
- Standalone Setup.exe and Portable.exe remain available; download **Chomp-Windows-Signing-Kit.zip** beside either EXE for the same signing commands.

From Windows PowerShell in the extracted folder:

```powershell
powershell.exe -NoProfile -File ".\Sign-Locally.ps1"
# After installation or an update:
powershell.exe -NoProfile -File ".\Sign-Locally.ps1" -Installed
```

The script creates/reuses a non-exportable local signing key after you approve it. It does not install certificate trust or change security policy. Self-signing can still be blocked by SmartScreen or company policy and does not verify the original publisher. Signing an installer does not sign its embedded app. Compare original EXE hashes with Defender-scan.json before signing; signing changes the hashes.

### macOS

Open the DMG for Apple Silicon (arm64) or Intel (x64) and drag Chomp into Applications. Apps are not Apple-signed or notarized.
