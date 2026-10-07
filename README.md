# Thread Match

Thread Match is a runnable clothing recommendation MVP. It combines onboarding preferences with explicit like/dislike history, returning a transparent 0-100 match score.

## Run locally

1. Install Node.js 20+ and PostgreSQL, or start PostgreSQL with `docker compose up db`.
2. Copy `.env.example` to `.env` and set a long random `JWT_SECRET`.
3. Run `npm install` from the repository root. The workspace installs both the API and Vite app.
4. Start both applications with `npm run dev`. The API is at `http://localhost:3000`; Vite is normally at `http://localhost:5173`.

## Kaggle catalog data

Download and unzip the Kaggle clothing dataset before starting Docker. From the repository root, create a folder named `kaggledata` and place the dataset files in this layout:

```text
kaggledata/
├── styles.csv
└── images/
    ├── 10000.jpg
    ├── 10001.jpg
    └── ...
```

On Windows, right-click the downloaded ZIP file, choose **Extract All**, select the project folder (`clothing-recommendation-system`), and extract it. If the ZIP creates an extra nested folder, move `styles.csv` and the `images` folder directly into:

```text
C:\Users\<your-name>\Documents\code\clothing-recommendation-system\kaggledata
```

You can also extract it from PowerShell:

```powershell
Expand-Archive -Path "$HOME\Downloads\archive.zip" -DestinationPath ".\kaggledata"
```

Verify that these paths exist before starting the app:

```powershell
Test-Path .\kaggledata\styles.csv
Test-Path .\kaggledata\images
```

Both commands should return `True`. Docker mounts this folder read-only, imports the catalog when the API starts, and serves the local product images.

The SQL files in `server/db` are mounted into the Postgres container and create the schema on a fresh volume. On startup, the API imports the Myntra catalog from `kaggledata/styles.csv` and serves its matching images from `kaggledata/images`. To reset catalog data, run `docker compose down -v` and start it again.

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
