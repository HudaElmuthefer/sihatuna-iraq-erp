// backend/tests/backup.test.js
//
// Verifies the BACKUP_ON_STARTUP gate on startAutoBackup(): the immediate
// pg_dump-driven backup on server startup is opt-in (default off), while
// the hourly scheduled backup stays unconditional either way. fs and
// child_process are fully mocked here -- this never touches the real
// backend/backups/ directory or spawns a real pg_dump process.
//
// Note: backend/config/backup.js is an abandoned earlier copy of this file
// -- nothing in the app requires it (server.js and routes/backupsRoutes.js
// both require ../utils/backup, this one) -- so it's deliberately not
// covered here or touched by the BACKUP_ON_STARTUP change.
jest.mock('fs', () => ({
  existsSync: jest.fn(() => false),
  mkdirSync: jest.fn(),
  copyFileSync: jest.fn(),
  readdirSync: jest.fn(() => []),
  statSync: jest.fn(() => ({ isDirectory: () => true })),
  rmSync: jest.fn(),
  rmdirSync: jest.fn(),
}));
jest.mock('child_process', () => ({
  execFile: jest.fn((cmd, args, opts, cb) => cb(new Error('mocked -- no real pg_dump in tests'))),
}));

const fs = require('fs');
const backup = require('../utils/backup');

describe('startAutoBackup — BACKUP_ON_STARTUP gate', () => {
  const ORIGINAL_ENV = process.env.BACKUP_ON_STARTUP;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(global, 'setInterval').mockReturnValue({ unref: jest.fn() });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) delete process.env.BACKUP_ON_STARTUP;
    else process.env.BACKUP_ON_STARTUP = ORIGINAL_ENV;
    jest.restoreAllMocks();
  });

  // runBackup() is async but its first statement (ensureDir, which calls
  // fs.existsSync/mkdirSync) runs synchronously before the first await --
  // so whether it ran at all is already observable immediately after
  // startAutoBackup() returns, with no need to await anything.
  test('does not touch the backups folder when BACKUP_ON_STARTUP is unset (default)', () => {
    delete process.env.BACKUP_ON_STARTUP;
    backup.startAutoBackup();
    expect(fs.existsSync).not.toHaveBeenCalled();
    expect(global.setInterval).toHaveBeenCalledWith(backup.runBackup, expect.any(Number));
  });

  test('does not touch the backups folder when BACKUP_ON_STARTUP=false', () => {
    process.env.BACKUP_ON_STARTUP = 'false';
    backup.startAutoBackup();
    expect(fs.existsSync).not.toHaveBeenCalled();
    expect(global.setInterval).toHaveBeenCalledWith(backup.runBackup, expect.any(Number));
  });

  test('creates a backup folder immediately when BACKUP_ON_STARTUP=true, and still schedules the hourly one', () => {
    process.env.BACKUP_ON_STARTUP = 'true';
    backup.startAutoBackup();
    expect(fs.existsSync).toHaveBeenCalled();
    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(global.setInterval).toHaveBeenCalledWith(backup.runBackup, expect.any(Number));
  });
});
