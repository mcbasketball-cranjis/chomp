# Microsoft Store MSIX — Chomp

Microsoft Store accepts unsigned MSIX uploads and signs them with a Microsoft
certificate **after certification**. That signature covers the version installed
through the Store. It does **not** sign Chomp's separate GitHub NSIS/portable EXEs.

This repo uses the Windows SDK `makeappx.exe` to produce a native `.msix`.
The pinned electron-builder 26 remains unchanged. The ordinary installers
are also unchanged.

## Obtain the Store identity

1. Create a developer account at https://storedeveloper.microsoft.com.
2. In Partner Center, reserve **Chomp** as an **MSIX/PWA** app, if available.
3. Open **Product management → Product identity** for the reserved app.
4. Copy these values exactly (do not guess or substitute company names):
   - `Package/Identity/Name` → `CHOMP_STORE_PACKAGE_NAME`
   - `Package/Identity/Publisher` → `CHOMP_STORE_PUBLISHER` (an X.509 distinguished name)
   - `Package/Properties/PublisherDisplayName` → `CHOMP_STORE_PUBLISHER_DISPLAY_NAME`

Microsoft checks package identity during submission. A package created with
a placeholder identity will **not** be accepted for your Store listing.

## Build the Store package on GitHub

Open **Actions → Build Microsoft Store MSIX → Run workflow** on `main`.
Enter the three Partner Center values. This Windows job builds and validates
an unsigned `.msix`, then attaches it to the corresponding Chomp GitHub Release
as `Chomp-<version>-win-x64-Store-unsigned.msix`.

Upload the `.msix` to the **Packages** section of the Partner Center
submission. Once certified, Microsoft signs and hosts the Store-distributed
package. There is no need to upload a PFX or buy a code-signing certificate.

The GitHub release's `-Store-unsigned.msix` is **for submission**, not a
click-to-install download for normal Windows users. Windows requires trusted
signatures for MSIX installation outside the Store.

For future Chomp releases you can optionally set these **repository variables**
under GitHub **Settings → Secrets and variables → Actions → Variables**:

- `CHOMP_STORE_PACKAGE_NAME`
- `CHOMP_STORE_PUBLISHER`
- `CHOMP_STORE_PUBLISHER_DISPLAY_NAME`

Once configured, the normal Windows release job builds and uploads the MSIX
automatically on **new versioned releases**. It does not modify an already
published release or use a guessed Store identity.

## Build locally on Windows

Run `pnpm install`, then set all three `CHOMP_STORE_...` environment
variables to your actual identity and run:

```powershell
pnpm dist:store
```

The Windows 10/11 SDK must be installed so `makeappx.exe` is available.
The build script validates the archive by unpacking it and checking the
app executable, Store-specific update marker, icons and manifest identity.

## Installer and update policy

- The Windows Store build is a full-trust packaged desktop app, with
  `runFullTrust` and access to ordinary file/folder dialogs.
- Store builds use **Microsoft Store updates**, never Chomp's GitHub EXE updater.
- GitHub NSIS installers continue using their existing in-app updater.
- Having both installed may show separate app entries and profiles; switch
  channels deliberately instead of installing both accidentally.

## Testing limitations

The pull request CI builds a **CI identity fixture** MSIX and tests manifest,
package structure, and SDK packing/unpacking. It is not Store-uploadable.
Final Partner Center certification and first-run behavior under Store
distribution must be tested with a real, reserved app identity.

References:
- https://learn.microsoft.com/windows/apps/publish/view-app-identity-details
- https://learn.microsoft.com/windows/msix/desktop/desktop-to-uwp-manual-conversion
- https://learn.microsoft.com/windows/apps/publish/get-started
