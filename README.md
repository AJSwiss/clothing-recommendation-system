# Thread Match

Thread Match is a runnable clothing recommendation MVP. It combines onboarding preferences with explicit like/dislike history, returning a transparent 0-100 match score.

## Run locally

1. Install Node.js 20+ and PostgreSQL, or start PostgreSQL with `docker compose up db`.
2. Copy `.env.example` to `.env` and set a long random `JWT_SECRET`.
3. Run `npm install` from the repository root. The workspace installs both the API and Vite app.
4. Start both applications with `npm run dev`. The API is at `http://localhost:3000`; Vite is normally at `http://localhost:5173`.

The SQL files in `server/db` are mounted into the Postgres container and create/seed the schema on a fresh volume. To reset seed data, run `docker compose down -v` and start it again.

## Docker

`docker compose up --build` runs Postgres and a production Node container serving the built React application and API at `http://localhost:3000`. Configure `DATABASE_URL`, `JWT_SECRET`, and `PORT` through Compose or an environment file; never commit secrets.

## API

- `POST /api/auth/register`, `POST /api/auth/login`
- `GET/POST /api/user/preferences` (protected)
- `GET /api/discover/next`, `POST /api/discover/swipe` (protected)
- `GET /api/recommendations?page=1&limit=12&category=tops`
- `GET /api/items/:id`, `GET /api/items/:id/similar`, `GET /api/faq`

All SQL uses parameterized queries. Inputs are bounded/validated, passwords use bcrypt, and protected endpoints require short-lived JWT authentication.

## Tests

`npm test` runs the recommendation engine unit test with Jest. The API is structured for Supertest integration tests when a test database is available.


