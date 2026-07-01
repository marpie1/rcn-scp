/**
 * sqldb.js
 *
 * Thin synchronous wrapper around sql.js.
 * sql.js is a pure-JS SQLite compiled to WebAssembly — no native build needed.
 *
 * Usage:
 *   const { openDb } = require('./sqldb');
 *   const db = openDb('/path/to/file.db');
 *   db.exec('CREATE TABLE IF NOT EXISTS ...');
 *   db.run('INSERT INTO ... VALUES (?,?)', [a, b]);
 *   const rows = db.all('SELECT * FROM ...');
 *   const row  = db.get('SELECT * FROM ... WHERE id = ?', [id]);
 *   db.save();  // flush to disk
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// sql.js WASM is loaded once and reused
let _SQL = null;

function getSql() {
  if (!_SQL) throw new Error('sql.js not initialised — call initDb() first');
  return _SQL;
}

async function initDb() {
  if (_SQL) return;
  _SQL = await initSqlJs();
}

function openDb(filePath) {
  const SQL = getSql();
  let db;

  if (fs.existsSync(filePath)) {
    const fileBuffer = fs.readFileSync(filePath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  function save() {
    const data = db.export();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, Buffer.from(data));
  }

  function exec(sql) {
    db.run(sql);
    save();
  }

  function run(sql, params = []) {
    db.run(sql, params);
    save();
  }

  function all(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  }

  function get(sql, params = []) {
    const rows = all(sql, params);
    return rows[0] || null;
  }

  return { exec, run, all, get, save, _db: db };
}

module.exports = { initDb, openDb };
