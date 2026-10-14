# Points Dashboard

A simple single-page dashboard for managing kids' points, including earned points, deductions, and reward redemptions.

Records are stored in a lightweight local database at `data/points.sqlite`. Deletes use soft deletion by writing `deletedAt`; deleted items remain in the database and are automatically excluded from totals.

## Local Development

```bash
npm install
npm run dev
```

`npm run dev` starts both services:

- The Vite frontend development server
- The local SQLite API for reading and writing `data/points.sqlite`

Debug mode shows a `Permanently Delete` button in `Deleted Items`. It only allows permanent deletion of records that have already been soft-deleted:

```bash
npm run dev:debug
```

If you want to sync data across machines, commit the SQLite database file:

```bash
git add data/points.sqlite
git commit -m "Update points data"
```

## Current Scope

- React + TypeScript + Vite project setup
- Tailwind CSS base styling
- Local SQLite persistence: `data/points.sqlite`
- Dashboard, fitness points, gaming deductions, rewards, and rules sections
- Add earned or deducted point records
- Add reward redemption records
- Mark records as deleted and view deleted items
- Permanently delete soft-deleted items in debug mode
- Weekly net points chart

## Storage

The app has migrated from a single JSON file to `data/points.sqlite`:

- Faster writes: adding or deleting updates only the related rows instead of rewriting the full JSON file.
- Better querying: dates, categories, deletion state, indexes, and pagination can be added later.
- Safer data: SQLite transactions reduce the risk of file corruption during interrupted writes.

When the API starts for the first time, it automatically imports legacy `data/points.json` if that file exists and the database is empty. This repository now uses `data/points.sqlite` as the source of truth.
