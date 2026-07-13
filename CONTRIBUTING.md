# Contributing to Money Meva

Thanks for your interest! This is a local-first personal finance app built with Next.js and IndexedDB. All contributions are welcome.

## Getting Started

```bash
git clone https://github.com/kuldeep7ke/money-meva.git
cd money-meva
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
  app/           — Pages (App Router)
  components/    — Reusable React components
  lib/           — Data store, auth, utils, etc.
  types/         — TypeScript interfaces
public/          — Static assets, icons, manifest
scripts/         — Utility scripts
```

- All data is stored in IndexedDB via Dexie.js (`src/lib/db.ts` + `src/lib/store.ts`)
- Auth is local (`src/lib/localAuth.ts`) with optional Supabase
- Styling is Tailwind CSS v4

## Before You Code

Read the guide in `node_modules/next/dist/docs/` — this project uses a non-standard Next.js version with breaking changes.

## Code Style

- TypeScript strict mode
- Tailwind CSS for all styling
- Lucide React for icons
- No comments unless absolutely necessary
- Follow existing patterns in the codebase

## Commit Guidelines

- Keep commits focused and atomic
- Write clear, descriptive commit messages
- Reference any relevant issues

## Pull Request Process

1. Fork the repo and create a feature branch
2. Test your changes: `npm run build`
3. Push and open a PR with a clear description of what you changed and why

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).
