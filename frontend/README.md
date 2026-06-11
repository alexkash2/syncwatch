# SyncWatch frontend

React 19 + TypeScript single-page app, built with Vite.

- **Styling** — Tailwind CSS v4 (single token set in `src/index.css`).
- **State** — zustand store for the room (`src/store/roomStore.ts`), React context for auth and i18n.
- **Routing** — react-router (`/`, `/room/:id`, 404).
- **API** — axios client with a 401-refresh interceptor (`src/api/client.ts`); WS protocol types in `src/types/ws.ts`.

## Commands

```bash
npm install
npm run dev        # http://localhost:3000, proxies /api and /ws to :8000
npx tsc --noEmit   # type check
npx eslint .       # lint
npm run test:run   # Vitest (single run)
npm run build      # production build (dist/)
```

How the frontend talks to the backend — see [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md); message reference — [docs/WS_PROTOCOL.md](../docs/WS_PROTOCOL.md).
