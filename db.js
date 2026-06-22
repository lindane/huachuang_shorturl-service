const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'shorturl.db');
const db = new Database(dbPath);

function insertUrl(code, originalUrl) {
  const stmt = db.prepare('INSERT INTO urls (code, original_url) VALUES (?, ?)');
  const result = stmt.run(code, originalUrl);
  return result.lastInsertRowid;
}

function findUrlByCode(code) {
  const stmt = db.prepare('SELECT * FROM urls WHERE code = ?');
  return stmt.get(code);
}

function findUrlByOriginalUrl(originalUrl) {
  const stmt = db.prepare('SELECT * FROM urls WHERE original_url = ?');
  return stmt.get(originalUrl);
}

function createTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS urls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      original_url TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function countUrls() {
  const stmt = db.prepare('SELECT COUNT(*) AS count FROM urls');
  return stmt.get().count;
}

function getRecentUrls(limit) {
  const stmt = db.prepare('SELECT code, original_url FROM urls ORDER BY created_at DESC LIMIT ?');
  return stmt.all(limit);
}

module.exports = {
  insertUrl,
  findUrlByCode,
  findUrlByOriginalUrl,
  createTable,
  countUrls,
  getRecentUrls
};
