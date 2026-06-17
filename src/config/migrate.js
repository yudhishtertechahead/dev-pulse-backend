require('dotenv').config();
const { pool } = require('./db');

async function runMigration() {
  const isFresh = process.argv.includes('--fresh');

  if (isFresh && process.env.NODE_ENV === 'production') {
    console.log('Cannot run fresh migration in production');
    process.exit(1);
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (isFresh) {
      await client.query('DROP TABLE IF EXISTS sessions CASCADE;');
      await client.query('DROP TABLE IF EXISTS password_resets CASCADE;');
      await client.query('DROP TABLE IF EXISTS refresh_tokens CASCADE;'); // backward compat cleanup
      await client.query('DROP TABLE IF EXISTS users CASCADE;');
      console.log('Dropped existing tables.');
    }

    // ── Users ─────────────────────────────────────────────────────────────────
    // Stores identity + hashed password.
    // Never expose the password column outside auth flows.
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(100) NOT NULL,
        email       VARCHAR(150) UNIQUE NOT NULL,
        password    VARCHAR(255) NOT NULL,                -- bcrypt hash
        role        VARCHAR(20)  NOT NULL DEFAULT 'user'
                    CHECK (role IN ('user', 'admin')),
        is_active   BOOLEAN      NOT NULL DEFAULT true,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `);

    // ── Sessions ──────────────────────────────────────────────────────────────
    // One row = one active session (browser tab / device).
    //
    // id                 → session_id embedded in BOTH access & refresh tokens
    // user_id            → FK to users
    // refresh_token_hash → SHA-256 of the raw refresh JWT (never store raw)
    //                      NULLABLE — set to NULL when revoked/logged out.
    //                      Two independent guards: revoked_at AND hash=NULL.
    //                      PostgreSQL UNIQUE allows multiple NULLs, so many
    //                      revoked sessions can coexist without constraint errors.
    // device_info        → User-Agent header
    // ip_address         → client IP (VARCHAR(45) covers IPv6)
    // expires_at         → refresh token expiry; access token expiry is in the JWT itself
    // revoked_at         → NULL = active; non-NULL = revoked/logged out
    // revoked_reason     → 'logout' | 'logout_all' | 'reuse_detected'
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id                  UUID         PRIMARY KEY,     -- app-generated; embedded in JWT before INSERT
        user_id             UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        refresh_token_hash  VARCHAR(255) UNIQUE,          -- SHA-256; NULL when revoked
        device_info         VARCHAR(255),
        ip_address          VARCHAR(45),
        expires_at          TIMESTAMPTZ  NOT NULL,
        created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        revoked_at          TIMESTAMPTZ,                  -- NULL = active
        revoked_reason      VARCHAR(50)                   -- 'logout' | 'logout_all' | 'reuse_detected'
      );
    `);

    // Indexes for the two most common lookups
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token_hash ON sessions(refresh_token_hash);`);

    // ── Password Resets ───────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash  VARCHAR(255) UNIQUE NOT NULL,
        expires_at  TIMESTAMPTZ  NOT NULL,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_password_resets_token_hash ON password_resets(token_hash);`);

    // ── updated_at trigger for users ──────────────────────────────────────────
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await client.query(`DROP TRIGGER IF EXISTS update_users_updated_at ON users;`);

    await client.query(`
      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    // ── Quizzes ───────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS quizzes (
        id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id          UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        difficulty       VARCHAR(20)  NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard', 'any')),
        score            INT          NOT NULL DEFAULT 0,
        total_questions  INT          NOT NULL DEFAULT 20,
        time_taken       INT          NOT NULL DEFAULT 0,
        created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `);

    // ── Quiz Questions ────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS quiz_questions (
        id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        quiz_id          UUID         NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
        question         TEXT         NOT NULL,
        options          JSONB        NOT NULL DEFAULT '[]'::jsonb,
        selected_option  TEXT,
        correct_option   TEXT         NOT NULL,
        is_correct       BOOLEAN      NOT NULL DEFAULT false
      );
    `);

    // Ensure options column exists for already created tables
    await client.query(`
      ALTER TABLE quiz_questions 
      ADD COLUMN IF NOT EXISTS options JSONB NOT NULL DEFAULT '[]'::jsonb;
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_quizzes_user_id ON quizzes(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON quiz_questions(quiz_id);`);

    await client.query('COMMIT');
    console.log('Migration complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
