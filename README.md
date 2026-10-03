# UniBalance: release folder

A personal management app (University, Tasks, Finance, Calendar) that installs on an iPhone as a PWA.
No build step, no server, no accounts. All data stays on the device.

Hosting target: GitHub Pages, account `taimazkhoram`.
Planned address: `https://taimazkhoram.github.io/UniBalance/` (if the repository is named `UniBalance`).

## Before you deploy
- The icons in `assets/icons/` are generated from the final UniBalance logo. To change them later, replace the four files with the same names (`icon-180.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`) and increase the cache number in `service-worker.js`.
- Upload the contents of this folder, not the folder itself: `index.html` must sit at the top level of the repository.

## Deploy to GitHub Pages (free HTTPS)
1. Sign in at github.com as `taimazkhoram`.
2. Create a new **public** repository named `UniBalance` (free Pages needs a public repository).
3. Upload everything in this folder, keeping the `css`, `js` and `assets` folders. On a computer, drag the files and folders into **Add file > Upload files**. The GitHub website on a phone cannot upload folders, so use a computer.
4. Commit to the `main` branch.
5. Open **Settings > Pages**. Under Source choose **Deploy from a branch**, branch `main`, folder `/ (root)`, then Save.
6. Wait 1 to 2 minutes, then open `https://taimazkhoram.github.io/UniBalance/`.

HTTPS is required for installing and offline use. GitHub Pages provides it.

## Install on iPhone
1. Open the address above in **Safari** (not an in-app browser).
2. Tap **Share**, then **Add to Home Screen**, then **Add**.
3. Open UniBalance from the new Home Screen icon. System notifications need iOS 16.4 or later and this installed app.
4. Open the app once while online so it can store itself for offline use.

## Updating the app later
1. Replace the changed files in the repository.
2. In `service-worker.js` increase the number in `unibalance-shell-v2` (to v3, then v4, and so on). This clears the old offline copy.
3. GitHub Pages may serve cached files for about 10 minutes. Reopen the app while online after that.
Your data is not touched by updates.

## Backup and restore
- Settings (gear on Home) > **Export backup** saves `UniBalance-backup-YYYY-MM-DD.json`. On iPhone choose **Save to Files**.
- Settings > **Import backup** validates the file, shows a confirmation, then replaces all current data. Invalid files are rejected and nothing changes.
- Export regularly, and before clearing Safari data or changing phones. Data does not sync between devices.

## Known limitations
- **No reminders while the app is fully closed.** There is no server. Reminders show on Home while the app is open, and as system notifications if allowed. A reminder that comes due while the app is closed appears the next time you open it.
- Data lives only in this browser or app on this device. Clearing browser data, deleting the app, or changing devices erases it. iOS may also clear storage for sites unused for a long time.
- The currency setting changes the label only. Nothing is converted. Amounts are whole numbers.
- Courses repeat every week, with no semester start or end dates.
- Overdue occurrences of repeating tasks are listed for the last 14 days only.
- Recurring task reminders reuse the offset between the reminder and the first due time.
- Jalali dates use the browser's built-in calendar support.
- Not yet verified on a real iPhone (install, offline launch, notifications, pickers, share sheet, safe areas, and how the icon looks on the Home Screen).
