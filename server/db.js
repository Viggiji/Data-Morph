import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually (no dotenv dependency needed)
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

// Create connection pool
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'datamorph_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

/**
 * Initialize the database — creates DB and tables if they don't exist.
 * Called once on server startup.
 */
export async function initDatabase() {
  // First, connect without specifying a database to create it
  const tempPool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    waitForConnections: true,
    connectionLimit: 2,
  });

  try {
    const dbName = process.env.MYSQL_DATABASE || 'datamorph_db';
    await tempPool.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`  ✅ Database "${dbName}" ready`);
  } finally {
    await tempPool.end();
  }

  // Now create tables using the main pool (which has the DB selected)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id VARCHAR(36) PRIMARY KEY,
      user_uid VARCHAR(128) NOT NULL,
      title VARCHAR(255) DEFAULT 'New Chat',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_uid (user_uid),
      INDEX idx_updated_at (updated_at)
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id VARCHAR(36) NOT NULL,
      role ENUM('user', 'bot') NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
      INDEX idx_session_id (session_id)
    )
  `);

  console.log('  ✅ Tables "chat_sessions" and "chat_messages" ready');
}

export default pool;
