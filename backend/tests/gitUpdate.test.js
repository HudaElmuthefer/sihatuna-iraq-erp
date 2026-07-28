// backend/tests/gitUpdate.test.js
//
// End-to-end test for the Stage 4 git-based update system, against a fully
// isolated set of temp clones — never against the real project's working
// directory or git history. Test methodology (mirrors the real-world
// scenario exactly, just with local paths standing in for physical media):
//
//   flash-drive.git  — a bare repo, standing in for a USB flash drive or a
//                      shared network folder (both are just a git remote
//                      path to this feature; there is nothing to simulate
//                      differently between them)
//   dev-clone/       — standing in for the developer's machine: where a new
//                      release commit gets made and pushed to the flash drive
//   server-clone/    — standing in for the hospital server: where
//                      "update-source" gets configured and Check for
//                      Updates / Install Update actually run
//
// All three are real git repositories, and gitUpdate.js's real functions are
// called directly (the same functions the actual HTTP routes call) — the
// only thing different from production is the `projectRoot` argument.
//
// One real, intentional side effect: installUpdate() calls the real,
// unmodified codeBackup.js, which always operates on the actual project
// directory regardless of the projectRoot passed to installUpdate() itself
// (it was never parametrized, and this test doesn't change that). This is
// correct — it proves the Stage 3 Code Backup feature is genuinely reused,
// not re-implemented — so a real zip does land in the real
// backend/backups/code/ folder when this test runs. afterAll() deletes that
// specific zip so repeated test runs don't accumulate cruft there.
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  configureUpdateSource,
  getUpdateSource,
  getCurrentCommit,
  checkForUpdates,
  installUpdate,
  rollbackToCommit,
} = require('../utils/gitUpdate');
const { CODE_BACKUPS_DIR } = require('../utils/codeBackup');

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

describe('gitUpdate — Stage 4 differential update (isolated clones, real git)', () => {
  const root = path.join(os.tmpdir(), `sihatuna-update-test-${Date.now()}`);
  const bareRepo = path.join(root, 'flash-drive.git');
  const devClone = path.join(root, 'dev-clone');
  const serverClone = path.join(root, 'server-clone');
  const realProjectRoot = path.join(__dirname, '..', '..');
  let branch;
  let backupFilenamesCreated = [];
  let realProjectHeadBefore;
  let realProjectStatusBefore;

  beforeAll(() => {
    // Snapshot the real project's git state before any of this test's git
    // operations run, so the final test below can prove nothing here — not
    // history, not the working tree — actually touched the real repository,
    // regardless of whatever else is legitimately pending in it right now.
    realProjectHeadBefore = git(['rev-parse', 'HEAD'], realProjectRoot);
    realProjectStatusBefore = git(['status', '--porcelain'], realProjectRoot);

    fs.mkdirSync(root, { recursive: true });

    // The bare repo stands in for the flash drive / network folder.
    git(['init', '--bare', bareRepo]);

    // "Developer's machine": clone the real project (read-only source of
    // history for this test — never written back to) so both sides of the
    // test share real, meaningful history, then point it at the bare repo.
    git(['clone', realProjectRoot, devClone]);
    branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], devClone);
    git(['remote', 'add', 'flash-drive', bareRepo], devClone);
    git(['push', 'flash-drive', branch], devClone);

    // "Hospital server": a separate clone of the same starting point,
    // BEFORE the release commit below exists anywhere.
    git(['clone', '--branch', branch, realProjectRoot, serverClone]);

    // A small, harmless release commit, made on the "developer's machine"
    // clone and pushed to the flash drive — this is the update the server
    // should detect and pull.
    fs.writeFileSync(path.join(devClone, 'UPDATE_TEST_MARKER.txt'), 'test release commit\n');
    git(['add', 'UPDATE_TEST_MARKER.txt'], devClone);
    git(['-c', 'user.email=test@test.local', '-c', 'user.name=Test Release', 'commit', '-m', 'Test release: add UPDATE_TEST_MARKER.txt'], devClone);
    git(['push', 'flash-drive', branch], devClone);
  }, 30000);

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
    // Clean up the real (not test-isolated) code backup zip(s) this test's
    // installUpdate() call(s) actually created in the real project — see
    // the module comment above for why this happens at all.
    backupFilenamesCreated.forEach((name) => {
      const p = path.join(CODE_BACKUPS_DIR, name);
      if (fs.existsSync(p)) fs.rmSync(p);
    });
  });

  test('no source configured yet: checkForUpdates throws NO_SOURCE', async () => {
    // A brand new clone with no "update-source" remote at all.
    const freshClone = path.join(root, 'fresh-no-source');
    git(['clone', '--branch', branch, realProjectRoot, freshClone]);
    await expect(checkForUpdates(freshClone)).rejects.toMatchObject({ code: 'NO_SOURCE' });
  });

  test('configureUpdateSource adds the remote; getUpdateSource reads it back', async () => {
    const result = await configureUpdateSource(bareRepo, serverClone);
    expect(result.remoteName).toBe('update-source');
    const readBack = await getUpdateSource(serverClone);
    expect(readBack).toBe(bareRepo);
  });

  test('re-pointing the source (flash drive re-inserted with a new path) works via set-url', async () => {
    const otherBare = path.join(root, 'other-flash-drive.git');
    git(['init', '--bare', otherBare]);
    await configureUpdateSource(otherBare, serverClone);
    expect(await getUpdateSource(serverClone)).toBe(otherBare);
    // Point it back at the real bare repo for the rest of the tests.
    await configureUpdateSource(bareRepo, serverClone);
  });

  test('unreachable source: checkForUpdates gives a friendly message, not a raw git error', async () => {
    const unreachableClone = path.join(root, 'unreachable-test-clone');
    git(['clone', '--branch', branch, realProjectRoot, unreachableClone]);
    await configureUpdateSource(path.join(root, 'this-path-does-not-exist.git'), unreachableClone);
    await expect(checkForUpdates(unreachableClone)).rejects.toMatchObject({ code: 'UNREACHABLE' });
    try {
      await checkForUpdates(unreachableClone);
    } catch (err) {
      expect(err.message.toLowerCase()).not.toMatch(/fatal:|exit code/); // not a raw git dump
      expect(err.message).toMatch(/unreachable|not found/i);
    }
  });

  test('checkForUpdates detects the real commit pushed to the flash drive', async () => {
    const result = await checkForUpdates(serverClone);
    expect(result.updateAvailable).toBe(true);
    expect(result.commitsBehind).toBe(1);
    expect(result.changelog.length).toBe(1);
    expect(result.changelog[0]).toMatch(/Test release: add UPDATE_TEST_MARKER\.txt/);
  });

  test('installUpdate refuses on a dirty working tree, naming the conflicting file', async () => {
    const dirtyPath = path.join(serverClone, 'backend', 'package.json');
    const original = fs.readFileSync(dirtyPath, 'utf8');
    fs.writeFileSync(dirtyPath, original + '\n// uncommitted local edit for this test\n');
    try {
      await expect(installUpdate(serverClone)).rejects.toMatchObject({ code: 'DIRTY_TREE' });
      try {
        await installUpdate(serverClone);
      } catch (err) {
        expect(err.message).toMatch(/backend\/package\.json/);
      }
    } finally {
      fs.writeFileSync(dirtyPath, original); // clean up before the real install test below
    }
  });

  let beforeCommit;
  let afterCommit;

  test('installUpdate pulls the real change, backs up first, reports the summary', async () => {
    beforeCommit = await getCurrentCommit(serverClone);
    expect(fs.existsSync(path.join(serverClone, 'UPDATE_TEST_MARKER.txt'))).toBe(false);

    const result = await installUpdate(serverClone);

    expect(result.alreadyUpToDate).toBe(false);
    expect(result.backupFilename).toBeTruthy(); // real Stage 3 backup was created
    expect(result.filesChanged).toContain('UPDATE_TEST_MARKER.txt');
    expect(result.beforeCommit).toBe(beforeCommit);
    afterCommit = result.afterCommit;
    expect(afterCommit).not.toBe(beforeCommit);

    // The actual working tree file really changed on disk. Line-ending
    // normalized before comparing — Windows git commonly checks text files
    // out with core.autocrlf converting LF to CRLF, which is expected git
    // behavior unrelated to whether this feature's merge worked correctly.
    expect(fs.existsSync(path.join(serverClone, 'UPDATE_TEST_MARKER.txt'))).toBe(true);
    const markerContent = fs.readFileSync(path.join(serverClone, 'UPDATE_TEST_MARKER.txt'), 'utf8').replace(/\r\n/g, '\n');
    expect(markerContent).toBe('test release commit\n');

    // Confirm the real Stage 3 zip really exists on disk right now, then
    // queue it for cleanup in afterAll (see module comment above).
    expect(fs.existsSync(path.join(CODE_BACKUPS_DIR, result.backupFilename))).toBe(true);
    backupFilenamesCreated.push(result.backupFilename);
  }, 20000);

  test('installUpdate is a no-op when already up to date', async () => {
    const result = await installUpdate(serverClone);
    expect(result.alreadyUpToDate).toBe(true);
  });

  test('checkForUpdates reports no update available once installed', async () => {
    const result = await checkForUpdates(serverClone);
    expect(result.updateAvailable).toBe(false);
  });

  test('rollbackToCommit reverts the working tree to the pre-update commit', async () => {
    const result = await rollbackToCommit(beforeCommit, serverClone);
    expect(result.rolledBackTo).toBe(beforeCommit);
    expect(result.previousCommit).toBe(afterCommit);
    expect(fs.existsSync(path.join(serverClone, 'UPDATE_TEST_MARKER.txt'))).toBe(false);
    expect(await getCurrentCommit(serverClone)).toBe(beforeCommit);
  }, 20000);

  test('rollbackToCommit rejects an unknown commit hash', async () => {
    await expect(rollbackToCommit('0000000000000000000000000000000000000000', serverClone)).rejects.toMatchObject({ code: 'COMMIT_NOT_FOUND' });
  });

  test('the real project repository was never touched by any of the above', () => {
    // Compared against the snapshot taken in beforeAll, before any git
    // operation in this file ran — proves no new commit landed on HEAD and
    // no file's on-disk state changed, regardless of whatever else is
    // legitimately pending in the real repo right now.
    const headAfter = git(['rev-parse', 'HEAD'], realProjectRoot);
    const statusAfter = git(['status', '--porcelain'], realProjectRoot);
    expect(headAfter).toBe(realProjectHeadBefore);
    expect(statusAfter).toBe(realProjectStatusBefore);
  });
});
