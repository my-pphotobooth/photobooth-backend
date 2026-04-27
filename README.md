# my-photobooth backend

Express + PostgreSQL API for the photobooth frontend.

## Setup

```bash
cp .env.example .env
docker compose up -d db
npm install
npm run migrate
npm run dev
```

API: `http://localhost:3000`

## Endpoints

- `POST   /api/photos`        — multipart `file` (png/jpeg)
- `GET    /api/photos`        — `?limit=&cursor=` keyset pagination
- `GET    /api/photos/:id`
- `DELETE /api/photos/:id`    — soft delete
- `GET    /api/health`
- `GET    /uploads/:filename` — local-only static serving

## Storage

`STORAGE_DRIVER=local` writes to `./uploads/`. The `storage` interface in
`src/storage/index.js` is the seam for an S3 driver later — routes only call
`storage.put` / `storage.getUrl` / `storage.delete`.
