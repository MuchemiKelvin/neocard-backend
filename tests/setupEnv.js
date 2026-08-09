/**
 * Jest setupFiles — runs before any test module is loaded.
 * Forces an isolated SQLite file so tests cannot open the live DB.
 */
process.env.NODE_ENV = 'test';
process.env.DB_PATH = process.env.DB_PATH || './database/test_neocard.db';
