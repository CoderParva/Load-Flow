import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PERMISSION_CATALOG } from '../lib/permissions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../loadflow.db');

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Keep the permissions table (which role_permissions FKs against) in sync
// with the JS catalog automatically on every boot -- code is the source
// of truth for what permissions exist.
const upsertPerm = db.prepare(
  `INSERT INTO permissions (key, description) VALUES (?, ?)
   ON CONFLICT(key) DO UPDATE SET description = excluded.description`
);
for (const p of PERMISSION_CATALOG) upsertPerm.run(p.key, p.description);

export default db;
