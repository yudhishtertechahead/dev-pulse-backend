/**
 * seed.admin.js — Creates the initial admin user.
 *
 * Production practices followed:
 *   - Admin credentials come ENTIRELY from env variables (never hardcoded)
 *   - Password is bcrypt-hashed before insert — plain text never hits the DB
 *   - Idempotent: uses INSERT ... ON CONFLICT DO NOTHING so re-running is safe
 *   - Explicitly checks required env vars before doing anything
 *   - Closes the DB pool cleanly on exit
 *   - Works in both dev and production (just set the right env vars)
 *
 * Usage:
 *   npm run seed:admin
 *
 * Required env vars (add to .env):
 *   ADMIN_NAME=Super Admin
 *   ADMIN_EMAIL=admin@example.com
 *   ADMIN_PASSWORD=a-strong-password-min-12-chars
 */

require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('../config/db');

// ─── Validate env vars ────────────────────────────────────────────────────────

const REQUIRED = ['DATABASE_URL', 'ADMIN_NAME', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'BCRYPT_ROUNDS'];

const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`\n❌  Missing required env variables: ${missing.join(', ')}`);
  console.error('   Add them to your .env file and try again.\n');
  process.exit(1);
}

const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, BCRYPT_ROUNDS } = process.env;

if (ADMIN_PASSWORD.length < 12) {
  console.error('\n❌  ADMIN_PASSWORD must be at least 12 characters for security.\n');
  process.exit(1);
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function seedAdmin() {
  const client = await pool.connect();

  try {
    console.log('\n🌱  Seeding admin user...');

    const saltRounds = parseInt(BCRYPT_ROUNDS, 10) || 12;
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, saltRounds);

    /*
     * ON CONFLICT DO NOTHING — idempotent.
     * If an account with this email already exists (any role), we skip silently.
     * This means re-running the script is always safe.
     */
    const { rows } = await client.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (email) DO NOTHING
       RETURNING id, name, email, role, created_at`,
      [ADMIN_NAME, ADMIN_EMAIL.toLowerCase(), hashedPassword]
    );

    if (rows.length === 0) {
      console.log(`⚠️   Admin with email "${ADMIN_EMAIL}" already exists — skipped.\n`);
    } else {
      const admin = rows[0];
      console.log('✅  Admin user created successfully:');
      console.log(`    ID:    ${admin.id}`);
      console.log(`    Name:  ${admin.name}`);
      console.log(`    Email: ${admin.email}`);
      console.log(`    Role:  ${admin.role}`);
      console.log(`    At:    ${admin.created_at}\n`);
    }
  } catch (err) {
    console.error('\n❌  Seed failed:', err.message, '\n');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedAdmin();
