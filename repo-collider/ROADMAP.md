# Repo Collider — Roadmap

## Stage 1: Monolith MVP (✅ Deployed)
The original single-file HTML/JS app — fully working on Vercel.

- [x] Idea generation engine (9 LLM providers)
- [x] Dynamic GitHub repo pool (top 100, 4h cache)
- [x] Geo-awareness (country from timezone)
- [x] Multi-dimensional scoring & advanced prompts
- [x] Persistent idea pool (localStorage)
- [x] Recents sorting, saving, deleting
- [x] Export/Import (CSV, JSON backup)
- [x] Hash-based migration bridge (`migrate.html`)
- [x] File-based auto-import for large backups
- [x] Build package generator (stack, MVP, risks, cost)

## Stage 2: React Migration (⬅️ CURRENT — IN PROGRESS)
Rewrite the monolith into the Vite/React/TypeScript scaffold.

- [ ] State management (port `S` object → React context/hooks)
- [ ] App shell (topbar, sidebar, content area, responsive layout)
- [ ] LLM provider management (9 providers, model select, API key UI)
- [ ] Repo pool management (top 100 fetch, star/manual add, categories)
- [ ] Idea generation pipeline (callLLM, progress, parsing)
- [ ] Idea card grid (display, sort, filter, expand, save, delete)
- [ ] Stats view (session stats, scope distribution)
- [ ] Saved view (saved ideas grid)
- [ ] Export/Import (CSV, JSON backup)
- [ ] Build package modal (LLM-powered)
- [ ] CSS theme alignment (port dark-theme design tokens)

## Stage 3: Auth & Cloud Sync (🔜 NEXT)
Multi-user with server-side persistence.

- [ ] Auth overlay (login/register UI)
- [ ] JWT-based auth (register, login, me endpoints)
- [ ] Idea sync (POST/GET `/api/ideas/sync`)
- [ ] 100-account cap with waitlist messaging
- [ ] User badge + logout in topbar
- [ ] Auth-protected app boot flow

## Stage 4: Foundation & Quality (📋 PLANNED)
- [ ] Error boundaries and loading states
- [ ] Unit tests (vitest)
- [ ] Type-safe API layer
- [ ] Responsive mobile refinement
- [ ] Accessibility pass
- [ ] CI/CD (GitHub Actions)

## Stage 5: Growth Features (🔭 FUTURE)
- [ ] Idea sharing (public links)
- [ ] Team/collaboration workspaces
- [ ] Custom repo collections
- [ ] Analytics dashboard
- [ ] API rate-limit dashboard
- [ ] Waitlist → account approval flow
