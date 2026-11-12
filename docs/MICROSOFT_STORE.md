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
- Package/Properties/DisplayName: `Chomp Image Converter` (the reserved Store app name)

These are public package identifiers, not passwords or signing credentials. **Both** `Package/Properties/DisplayName` and `uap:VisualElements/@DisplayName` must use the reserved app name, not the short internal brand `Chomp`, or Partner Center will reject the upload.

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
`store/identity.json`, without requiring extra GitHub repository variables
for **packaging**. Automatic Partner Center submission is separately gated
by the two variables and four secrets described below.
The build script permits explicit `CHOMP_STORE_...` environment overrides,
but they must also match the identity of the intended Store listing.

## Automatic updates from GitHub to Microsoft Store

**After the first Chomp release has passed certification and is publicly live**,
the normal versioned release pipeline can submit each new MSIX directly to
Microsoft Store using Microsoft's [Store Developer CLI](https://learn.microsoft.com/windows/apps/publish/msstore-dev-cli/github-actions).

The initial submission must be completed in Partner Center. Microsoft currently
supports CLI/GitHub Action submissions for **free Store products**; confirm that
the Store listing is free before enabling unattended publishing.

### 1. Enable Microsoft Store API access

1. In [Microsoft Entra](https://entra.microsoft.com), register an application
   (or use an appropriate existing registration) in the tenant linked to your
   Partner Center account.
2. In Partner Center **Account settings → User management → Microsoft Entra
   applications**, add the registered application and give it the **Manager**
   role, as Microsoft requires for submission automation.
3. Generate a **client secret** under the Entra app's
   **Certificates & secrets** page. Never commit or paste the secret in an issue
   or chat.

### 2. Configure GitHub Actions

At **GitHub → Chomp repository → Settings → Secrets and variables → Actions**,
create these four **repository secrets**:

| Secret | Source |
|---|---|
| `AZURE_AD_TENANT_ID` | Microsoft Entra tenant ID |
| `AZURE_AD_APPLICATION_CLIENT_ID` | Entra application (client) ID |
| `AZURE_AD_APPLICATION_SECRET` | Entra app's client secret **value** |
| `SELLER_ID` | Partner Center seller/publisher ID |

Create these two **repository variables** (not secrets):

| Variable | Value |
|---|---|
| `CHOMP_STORE_PRODUCT_ID` | The Store **Product ID** shown in Partner Center's Product identity area (often begins with `9N`). This is NOT `CranjisMcBasketball.ChompImageConverter`. |
| `CHOMP_STORE_AUTO_PUBLISH` | Set to `true` **only once the first Chomp version is published live**. Leave absent or set `false` until then. |

The public MSIX package identity remains in `store/identity.json`.
No Partner Center credentials belong in that file.

### 3. Release a new Chomp version

After the above configuration:

1. Update `package.json` to a **higher** version such as `2.1.5` and update
   `RELEASE_NOTES.md`. MSIX uses numeric package version `2.1.5.0`.
2. Merge the changes into `main`.
3. The existing `Build, test, and release` workflow tests the app, builds the
   Mac, Windows EXE, and **Store MSIX** packages, and publishes the GitHub
   release after verifying its artifacts.
4. Its gated `store-submit` job downloads the new Store MSIX directly from
   that release, verifies the GitHub SHA-256 checksum, authenticates to Partner
   Center via the GitHub secrets, and submits it for certification using
   `msstore publish` and the Store Product ID.
5. **After Microsoft approves the updated submission**, Windows Store installs
   the update automatically for users who installed the MSIX through the
   Microsoft Store, subject to device and Store update policies.

This workflow **does not** send every commit to Microsoft. It runs only
after a successful *new* GitHub release, and only while the explicit
`CHOMP_STORE_AUTO_PUBLISH` flag is enabled. If there is a certification or API
problem, the GitHub job fails visibly; the existing published Store version is
left in place.

GitHub's separate NSIS installers continue using Chomp's GitHub updater and
are not updated by the Microsoft Store.

Microsoft reference:
[Publishing app updates with GitHub Actions](https://learn.microsoft.com/en-us/windows/apps/publish/msstore-dev-cli/github-actions).

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

Pull request CI packages an MSIX with Chomp's reserved Store identity and
tests its manifest, package structure, and SDK packing/unpacking. It does not
authenticate to Partner Center or publish a submission.
Final Partner Center certification and first-run behavior under Store
distribution must be tested with a real, reserved app identity.

References:
- https://learn.microsoft.com/windows/apps/publish/view-app-identity-details
- https://learn.microsoft.com/windows/msix/desktop/desktop-to-uwp-manual-conversion
- https://learn.microsoft.com/windows/apps/publish/get-started
