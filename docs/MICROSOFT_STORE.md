# Microsoft Store MSIX — Chomp

Microsoft Store accepts unsigned MSIX uploads and signs them with a Microsoft
certificate **after certification**. That signature covers the version installed
through the Store. It does **not** sign Chomp's separate GitHub NSIS/portable EXEs.

This repo uses the Windows SDK `makeappx.exe` to produce a native `.msix`.
The pinned electron-builder 26 remains unchanged. The ordinary installers
are also unchanged.

## Configured Partner Center identity

Chomp's real Partner Center identity is committed in
[`store/identity.json`](../store/identity.json), using the exact values supplied
for its reserved Microsoft Store product:

- Package/Identity/Name: `CranjisMcBasketball.ChompImageConverter`
- Package/Identity/Publisher: `CN=5CADBE67-B82C-4702-A7DC-41355D6CC8AF`
- Package/Properties/PublisherDisplayName: `Cranjis McBasketball`

These are public package identifiers, not passwords or signing credentials.

## Build the Store package on GitHub

When this identity is first merged into `main`, the **Build Microsoft Store
MSIX** GitHub Actions workflow runs automatically. For later rebuilds, open
**Actions → Build Microsoft Store MSIX → Run workflow** on `main`. It no longer
requires manually entering the identity each time.

The Windows job builds and validates an unsigned `.msix`, then attaches it
to the corresponding Chomp GitHub Release as
`Chomp-<version>-win-x64-Store-unsigned.msix`.

Upload the `.msix` to the **Packages** section of the Partner Center
submission. Once certified, Microsoft signs and hosts the Store-distributed
package. There is no need to upload a PFX or buy a code-signing certificate.

The GitHub release's `-Store-unsigned.msix` is **for submission**, not a
click-to-install download for normal Windows users. Windows requires trusted
signatures for MSIX installation outside the Store.

Future versioned releases automatically build and upload an MSIX using
`store/identity.json`, without requiring extra GitHub repository variables.
The build script permits explicit `CHOMP_STORE_...` environment overrides,
but they must also match the identity of the intended Store listing.

## Build locally on Windows

Run `pnpm install`, then build the MSIX with the committed identity:

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
