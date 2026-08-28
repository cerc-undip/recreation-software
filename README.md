# CodeArena

A real-time coding competition platform for one admin and ~100 whitelisted Python participants. Features live session control, browser coding, automated judging via Piston, and a final exportable leaderboard.

## Prerequisites
- Node.js 20+
- pnpm
- Docker & Docker Compose (for Piston)

## Setup

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Environment variables:**
   Copy `.env.example` to `.env` and set the required variables:
   ```env
   DATABASE_URL="file:./dev.db"
   JWT_SECRET="your-32-character-secret-key-here"
   ADMIN_DEFAULT_USERNAME="admin"
   ADMIN_DEFAULT_PASSWORD="password123"
   PISTON_API_URL="http://localhost:2000/api/v2"
   ```

3. **Start Piston (Python execution engine):**
   ```bash
   docker compose up -d
   ```

4. **Database setup:**
   ```bash
   pnpm prisma migrate deploy
   pnpm prisma db seed
   ```

5. **Start the development server:**
   ```bash
   pnpm dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment (VPS)

This application is designed for a single VPS deployment (not Vercel/serverless) due to the SQLite database and local Piston execution engine.

1. Clone the repository on your VPS.
2. Install Node.js, pnpm, and Docker.
3. Set up your `.env` file with a strong `JWT_SECRET` and admin credentials.
4. Run `docker compose up -d` to start Piston.
5. Run `pnpm install`, `pnpm prisma migrate deploy`, and `pnpm prisma db seed`.
6. Build the application: `pnpm build`.
7. Start the production server: `pnpm start` (or use PM2/systemd).
8. Configure a reverse proxy (Nginx/Caddy) to route traffic to port 3000.

## Architecture Notes
- **Execution:** Python code is executed exclusively via the Piston HTTP API. No `child_process` calls are made.
- **State:** Session state is synchronized via lightweight polling (2.5s intervals). No WebSockets are used.
- **Auth:** Admin uses a signed HttpOnly cookie. Participants use a signed Bearer token stored in `localStorage`. No heavy auth frameworks (e.g., NextAuth) are used.
- **Database:** SQLite via Prisma. Submissions and test case results are persisted for auditing.
