import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually
function loadEnv() {
  try {
    const envPath = resolve(__dirname, '.env');
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [key, ...vals] = trimmed.split('=');
      if (key && vals.length) {
        process.env[key.trim()] = vals.join('=').trim();
      }
    }
  } catch {
    console.warn('[DB] No .env file found, using existing environment variables.');
  }
}

loadEnv();

// Connection pool (used everywhere)
const pool = mysql.createPool({
  host:             process.env.MYSQL_HOST     || 'localhost',
  port:             parseInt(process.env.MYSQL_PORT || '3306'),
  user:             process.env.MYSQL_USER     || 'root',
  password:         process.env.MYSQL_PASSWORD || '',
  database:         process.env.MYSQL_DATABASE || 'datamorph_db',
  waitForConnections: true,
  connectionLimit:  10,
  queueLimit:       0,
});

/**
 * initDatabase()
 * Called once on server start.
 * Creates the database + all tables if they don't exist.
 * Safe to call on every restart — uses IF NOT EXISTS.
 */
export async function initDatabase() {
  // Step 1 — Create the database itself (no DB selected yet)
  const tempPool = mysql.createPool({
    host:             process.env.MYSQL_HOST     || 'localhost',
    port:             parseInt(process.env.MYSQL_PORT || '3306'),
    user:             process.env.MYSQL_USER     || 'root',
    password:         process.env.MYSQL_PASSWORD || '',
    waitForConnections: true,
    connectionLimit:  2,
  });

  try {
    const dbName = process.env.MYSQL_DATABASE || 'datamorph_db';
    await tempPool.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`  ✅ Database "${dbName}" ready`);
  } finally {
    await tempPool.end();
  }

  // ── BLOCK A: Original general-chat tables (unchanged) ───────────────

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id          VARCHAR(36)  PRIMARY KEY,
      user_uid    VARCHAR(128) NOT NULL,
      title       VARCHAR(255) DEFAULT 'New Chat',
      created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_uid  (user_uid),
      INDEX idx_updated_at (updated_at)
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      session_id  VARCHAR(36)          NOT NULL,
      role        ENUM('user', 'bot')  NOT NULL,
      content     TEXT                 NOT NULL,
      created_at  TIMESTAMP            DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
      INDEX idx_session_id (session_id)
    )
  `);

  console.log('  ✅ General chat tables ready');

  // ── BLOCK B: Schema-builder tables ──────────────────────────────────

  // Users — Firebase UID as primary key, no passwords stored here
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS dm_users (
      user_uid     VARCHAR(128) PRIMARY KEY,
      display_name VARCHAR(255),
      email        VARCHAR(255),
      table_count  INT       DEFAULT 0,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Raw input data pasted by the user (CSV or plain text)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS dm_input_data (
      data_id     INT AUTO_INCREMENT PRIMARY KEY,
      user_uid    VARCHAR(128)           NOT NULL,
      raw_content LONGTEXT               NOT NULL,
      input_type  ENUM('CSV', 'TEXT')    DEFAULT 'CSV',
      uploaded_at TIMESTAMP              DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_inputdata_user
        FOREIGN KEY (user_uid) REFERENCES dm_users(user_uid)
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);

  // One record per schema being built or already built
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS dm_table_master (
      table_id   INT AUTO_INCREMENT PRIMARY KEY,
      user_uid   VARCHAR(128) NOT NULL,
      data_id    INT          NOT NULL,
      table_name VARCHAR(100) NOT NULL,
      row_count  INT          DEFAULT 0,
      created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_tablemaster_user
        FOREIGN KEY (user_uid) REFERENCES dm_users(user_uid)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_tablemaster_input
        FOREIGN KEY (data_id) REFERENCES dm_input_data(data_id)
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);

  // Column-level attributes for each built schema
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS dm_attributes (
      attr_id       INT AUTO_INCREMENT PRIMARY KEY,
      table_id      INT                      NOT NULL,
      column_name   VARCHAR(100)             NOT NULL,
      data_type     VARCHAR(50)              NOT NULL DEFAULT 'VARCHAR(100)',
      is_nullable   ENUM('YES', 'NO')        DEFAULT 'YES',
      is_primary    ENUM('YES', 'NO')        DEFAULT 'NO',
      is_foreign    ENUM('YES', 'NO')        DEFAULT 'NO',
      foreign_ref   VARCHAR(200)             DEFAULT NULL,
      default_value VARCHAR(100)             DEFAULT NULL,
      constraints   VARCHAR(255)             DEFAULT NULL,
      CONSTRAINT fk_attr_table
        FOREIGN KEY (table_id) REFERENCES dm_table_master(table_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT uq_attr UNIQUE (table_id, column_name)
    )
  `);

  // One chatbot session per table-building interaction
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS dm_schema_sessions (
      session_id  INT AUTO_INCREMENT PRIMARY KEY,
      table_id    INT          NOT NULL,
      stage       INT          DEFAULT 0,
      is_complete TINYINT(1)   DEFAULT 0,
      started_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_schemasession_table
        FOREIGN KEY (table_id) REFERENCES dm_table_master(table_id)
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);

  // Every Q&A turn of the schema builder chatbot
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS dm_schema_history (
      chat_id    INT AUTO_INCREMENT PRIMARY KEY,
      session_id INT                      NOT NULL,
      role       ENUM('bot', 'user')      NOT NULL,
      message    TEXT                     NOT NULL,
      created_at TIMESTAMP                DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_history_session
        FOREIGN KEY (session_id) REFERENCES dm_schema_sessions(session_id)
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);

  // Export audit log (SQL + NoSQL)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS dm_exports (
      export_id   INT AUTO_INCREMENT PRIMARY KEY,
      table_id    INT                        NOT NULL,
      user_uid    VARCHAR(128)               NOT NULL,
      export_type ENUM('SQL', 'NoSQL')       DEFAULT 'SQL',
      exported_at TIMESTAMP                  DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_export_table
        FOREIGN KEY (table_id) REFERENCES dm_table_master(table_id)
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);

  // Modification audit log — tracks every schema edit
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS dm_modify_log (
      modify_id   INT AUTO_INCREMENT PRIMARY KEY,
      user_uid    VARCHAR(128) NOT NULL,
      table_id    INT          NOT NULL,
      change_note TEXT,
      modified_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_modify_table
        FOREIGN KEY (table_id) REFERENCES dm_table_master(table_id)
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);

  console.log('  ✅ Schema-builder tables ready (8 new tables)');
}

export default pool;
