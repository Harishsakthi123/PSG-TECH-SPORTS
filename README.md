# PSG Tech Intramurals 2025-26

React + Vite + TS + Tailwind v4 + Framer Motion (client) | Express + MongoDB + Mongoose (server)

## Setup
1. Install Node 20+ and get a MongoDB URI (Atlas free tier or local).
2. Server:
   cd server && cp .env.example .env   (fill in values, including organizer credentials)
   npm install && npm run seed && npm run dev
3. Client (second terminal):
   cd client && npm install && npm run dev
4. Open http://localhost:5173 for the participant portal. Participants can browse and filter games, register, and look up a registration with its reference at `/status`. Organizers can sign in at `/admin` to review registrations, manage games and event details, publish announcements, send pending-registration reminders, and export lists.
5. Tests: cd server && npm test  (needs MONGO_URI_TEST)

## Content
No organizer data is invented. Dates, houses, contacts and games are placeholders ("TBA")
in server/src/seed.js. Fill them from the admin dashboard (Settings / Games).
Sample games are only created when you run `npm run seed -- --sample`.

The organizer account is created by `npm run seed` from `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `server/.env`. The password is stored as a bcrypt hash. Keep `.env` private and use a strong password; do not put credentials in client code or commit them.

## Optional integrations

The participant registration is saved even if an email provider is unavailable. To send confirmation emails and organizer-triggered reminders, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` in the server environment, then restart the server. Reminders are sent manually to pending registrations (optionally filtered by game); a single send is limited to 500 recipients. There is no automatic reminder schedule.

To enable the organizer's rules-drafting assistant, configure an OpenAI API key in `AI_API_KEY`, and set `AI_API_URL` and `AI_MODEL` on the server before restarting it. A ChatGPT subscription is separate from API access. The defaults target the OpenAI Chat Completions API and `gpt-4o-mini`. The assistant sends the game name, category, format, type, current draft rules and organizer's prompts to that provider. It does not receive participant registration records. Suggestions are drafts only: organizers must review them and explicitly add/save them.

## Deploy
Server: Render/Railway. Set env vars from .env.example, start command `npm start`.
Client: Vercel/Netlify. Build `npm run build`, set VITE_API_URL=https://<server>/api.
Set CLIENT_ORIGIN on the server to the client URL.
