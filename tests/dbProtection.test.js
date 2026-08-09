/**
 * Stage 5 — production DB must never be opened by automated tests.
 */
const path = require('path');
const fs = require('fs');

describe('Database protection', () => {
  const liveRelative = './database/neocard.db';
  const testRelative = './database/test_neocard.db';

  beforeEach(() => {
    jest.resetModules();
    process.env.NODE_ENV = 'test';
    delete process.env.DB_PATH;
  });

  test('getDatabasePath uses isolated test DB under NODE_ENV=test', () => {
    const config = require('../config');
    expect(config.getDatabasePath()).toBe(testRelative);
  });

  test('getDatabasePath ignores live DB_PATH from env when NODE_ENV=test', () => {
    process.env.DB_PATH = liveRelative;
    const config = require('../config');
    expect(config.getDatabasePath()).toBe(testRelative);
    expect(path.basename(config.getDatabasePath())).not.toBe('neocard.db');
  });

  test('connect under NODE_ENV=test never opens the live database file', async () => {
    process.env.DB_PATH = liveRelative;
    const db = require('../database');
    await db.connect();
    expect(path.basename(db.dbPath)).toBe('test_neocard.db');
    expect(path.resolve(db.dbPath)).not.toBe(path.resolve(liveRelative));
    await db.close();
  });

  test('assertSafeDatabasePath rejects live basename in test env', () => {
    const db = require('../database');
    expect(() => {
      db.assertSafeDatabasePath(path.resolve(liveRelative));
    }).toThrow(/Refusing to open live database/);
  });

  test('live database file is not deleted by connecting the test DB', async () => {
    const livePath = path.resolve(liveRelative);
    const existedBefore = fs.existsSync(livePath);
    const db = require('../database');
    await db.connect();
    await db.close();
    expect(fs.existsSync(livePath)).toBe(existedBefore);
  });
});
