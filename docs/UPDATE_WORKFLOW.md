# Update Workflow (Stage 4: Git-Based Differential Update)

This describes how new releases get from the developer's machine to the
hospital server, and how the admin installs them. The mechanism is ordinary
git — the "Updates" tab in Settings is a thin, admin-friendly wrapper around
`git fetch` + `git merge`, not a custom protocol.

## Why a flash drive (or a network folder) instead of just GitHub

The hospital server may not have reliable internet access. This system
supports **either**:

- An **offline source**: a bare git repository copied onto a USB flash drive,
  or placed in a shared network folder — no internet required at all.
- A **real remote**: a standard GitHub URL, for when internet access is
  available.

Both are configured the exact same way (one path/URL, entered once in the
Updates tab), because both are just git remotes to the update mechanism —
the difference is invisible past that point.

## One-time setup: creating the flash-drive source

On the **developer's machine**, create a bare repository — this is a git
repository with no working directory, meant only to be pushed to and fetched
from, which is exactly what a distribution medium needs:

```bash
git init --bare "E:\sihatuna-updates.git"
```

(Swap `E:\` for wherever the flash drive is mounted, or use a UNC path like
`\\SERVER\share\sihatuna-updates.git` for a network folder instead — nothing
else about this workflow changes.)

Then add it as a normal git remote in the actual project, and push to it:

```bash
git remote add flash-drive "E:\sihatuna-updates.git"
git push flash-drive main
```

## Releasing a new version

Every time you're ready to ship a release to the hospital server:

1. Commit and test your changes on the developer's machine as normal.
2. Plug in the same flash drive used for the initial setup (or reconnect to
   the same network folder).
3. Push the new commits to it:
   ```bash
   git push flash-drive main
   ```
4. Physically deliver the flash drive to the hospital (or, if it's a network
   folder, there's nothing to deliver — it's already there).

That's the entire release step. The bare repo now has your latest commits;
nothing on the hospital server has been touched yet.

## Installing the update at the hospital

On the **hospital server**, as an admin, in Settings → Updates:

1. **Configure Update Source** (first time only, or whenever the flash
   drive's letter changes — Windows can assign a different letter each time
   a drive is re-inserted): enter the current path, e.g. `E:\sihatuna-updates.git`,
   and save. This points a git remote named `update-source` at it — this is
   always a separate remote from the developer's own GitHub remote
   (`origin`), so this feature can never touch that.
2. **Check for Updates**: fetches from the configured source and reports
   whether the server is behind, by how many commits, and a short changelog
   of what changed.
3. **Install Update**: if an update is available —
   - Takes a full source code backup automatically first (the same Code
     Backup feature from Settings → Backups), so there's always a way back.
   - Refuses and clearly lists the affected files if the server's working
     directory has any uncommitted local changes that would conflict,
     rather than silently overwriting them.
   - Pulls only the changed files (a git merge, not a full reinstall).
   - Runs `npm install` automatically for the backend and/or frontend, but
     only if that side's `package.json` actually changed in this update.
   - Restarts the app via PM2 automatically.
4. **Rollback**, if something goes wrong after installing: reverts the
   working directory back to the exact commit recorded right before the
   install, and restarts the app again. This stays available until the next
   successful install overwrites the recorded rollback point.

## If the flash drive isn't plugged in (or the network folder is unreachable)

"Check for Updates" and "Install Update" will both report this clearly (not
a raw git error) and take no action. Nothing is at risk in this case — it's
exactly the same as any other network hiccup.

## Reconnecting a flash drive after Windows assigns it a new letter

This is expected and normal — just re-run **Configure Update Source** with
whatever the new letter is (check File Explorer). The remote is re-pointed
in place; no other step in this workflow changes.
