const db = require('./db');

console.log('Initializing database...');

try {
  db.createTable();
  console.log('Database table "urls" created successfully.');
} catch (err) {
  console.error('Failed to create table:', err.message);
  process.exit(1);
}
