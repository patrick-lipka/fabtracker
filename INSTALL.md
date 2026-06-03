### Installing FaB Tracker
FaB Tracker is an open-source hobby app, so the builds aren't paid-code-signed yet. Your browser and OS will show "unknown/unverified" warnings — that's expected for unsigned apps, not a sign anything's wrong. You only do this once; after that, in-app updates install seamlessly.

#### Windows
##### Download (getting past Microsoft Edge / SmartScreen)
On the release page, download the .exe installer (e.g. FaB Tracker_0.2.0_x64-setup.exe).
Edge may block it ("…isn't commonly downloaded" / "was blocked"). Open the downloads flyout (top-right arrow, or Ctrl+J), find the blocked file, click the ⋯ (more actions) next to it → Keep.
If a follow-up box appears ("This app might harm your device"), choose Show more → Keep anyway.
##### Install
Double-click the downloaded .exe.
Windows SmartScreen may show a blue "Windows protected your PC" dialog → click More info → Run anyway.
Follow the installer; launch FaB Tracker from the Start menu.

#### macOS (Apple Silicon and Intel — one universal build)
##### Download (getting past Edge, if you use it)
Download the .dmg (e.g. FaB Tracker_0.2.0_universal.dmg).
If Microsoft Edge blocks it, open the downloads flyout → ⋯ next to the file → Keep → Keep anyway. (Safari/Chrome usually just download it.)
#### Install
Open the .dmg and drag FaB Tracker into the Applications folder.
#### First launch (Gatekeeper) — use whichever applies to your macOS:
Most versions: in Applications, right-click (or Control-click) FaB Tracker → Open, then Open in the dialog.
macOS Sequoia (15) and newer, if there's no "Open" button: open System Settings → Privacy & Security, scroll to the message "FaB Tracker was blocked…" and click Open Anyway, then confirm with Open.
(Advanced, optional) If it still won't open, run in Terminal: xattr -dr com.apple.quarantine "/Applications/FaB Tracker.app"
You only need this on the first launch.

### After installing (both platforms)
On first run, click Download card data (a one-time ~20 MB fetch). Everything works offline after that. Future updates are handled in-app: the ⓘ button (top-right) shows a dot when an update is available — Check for updates → Install & restart.

FaB Tracker is an unofficial, fan-made tool, not affiliated with Legend Story Studios. Flesh and Blood card data & images are © LSS.
