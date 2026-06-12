# DevPulse API

Production-ready REST API with JWT access + refresh token rotation and multi-session management.

## Tech Stack
- Node.js 20, Express 4
- PostgreSQL (pg)
- JWT (jsonwebtoken) — 15min access tokens + 7 day refresh tokens
- bcrypt — password hashing (12 rounds)
- helmet, cors, express-rate-limit — security

## Setup

1. Clone and install
   npm install

2. Create .env from example
   cp .env.example .env
   (fill in your DATABASE_URL and generate strong JWT secrets)

3. Create database
   createdb devpulse

4. Run migrations
   npm run migrate

5. Start dev server
   npm run dev

## API Reference

### Auth (public)
POST   /api/v1/auth/register       — create account, returns accessToken + sets cookie
POST   /api/v1/auth/login          — login, returns accessToken + sets cookie
POST   /api/v1/auth/refresh        — rotate refresh token, returns new accessToken
POST   /api/v1/auth/logout         — revoke current session, clears cookie
POST   /api/v1/auth/logout-all     — revoke all sessions (requires access token)
GET    /api/v1/auth/sessions       — list all active sessions (requires access token)
GET    /api/v1/auth/me             — get own profile (requires access token)

### Users (protected)
GET    /api/v1/users               — list all users (admin only)
GET    /api/v1/users/:id           — get user (own profile or admin)
PUT    /api/v1/users/:id           — update user (own profile or admin)
DELETE /api/v1/users/:id           — deactivate user (admin only)
GET    /api/v1/users/:id/sessions  — view user sessions (admin only)
DELETE /api/v1/users/:id/sessions  — revoke user sessions (admin only)

## Token Flow
- Access token: returned in JSON body — store in memory (not localStorage)
- Refresh token: set as httpOnly cookie — never readable by JS
- On 401: call POST /api/v1/auth/refresh to silently get new access token
- Refresh token reuse triggers full session wipe (stolen token protection)

## Security Features
- Refresh token rotation on every use
- Token reuse detection — revokes all sessions on suspected theft
- Tokens stored as SHA-256 hashes in DB — raw token never persisted
- Soft delete (deactivate) instead of hard delete
- Generic error messages prevent account enumeration
- Rate limiting on all auth endpoints (20 req / 15 min per IP)
