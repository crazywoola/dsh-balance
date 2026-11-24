# Roadmap

Last researched: 2026-11-24. This is the ranked backlog for the automated
evolution routine. Each item is sized to ship as one release in a single run:
implement → `pnpm check` → PR → squash-merge → tag → GitHub release.
Take the highest unchecked item, unless an upstream break or a pricing change
needs a hotfix first. Tick the box and link the PR/release when it ships.

## Positioning

Other DSH cost plugins (notably `dsh-cost-meter`) already cover quotas, peak
countdowns, heatmaps and many providers, and record cost *after* the fact.
Our wedge is **deciding the next step**: what the next turn costs if you
continue, wait for off-peak, `/compact` now, or start fresh — priced from the
session's real uncached/cache-hit/output shape and official peak/holiday
schedules. Estimates only; the plugin never switches models or compacts on
its own.

Out of scope (do not chase): more relay providers or coding-plan quotas, peak
pop-ups/ring clocks, hard balance blocking, encrypted multi-key switching, a
compaction engine or memory service, a Langfuse clone.

## Ranked backlog

| # | Release | Type | Item |
|---|---------|------|------|
| 1 | patch | fix | **2027 holiday calendar + calendar horizon.** Add the 2027 rest days from 国办发明电〔2026〕10号 (published 2026-11-05: 1/1–3, 2/5–13, 4/3–5, 5/1–5, 6/9, 9/15, 10/1–7). Without it, weekday holidays from 2027-01-01 are priced as peak. Warn (caveat + test) when a date is beyond the last known holiday year instead of silently assuming none. |
| 2 | patch | fix | **DSH 0.2.3 compatibility pass.** Verify install/start on `dsh-v0.2.3-alpha.2` (Node ≥ 24.22.3 / ≥ 26.13.1): peer ranges under standard semver also admit 0.2.3 prereleases; usage from forked/branch sessions (0.2.2-rc.2 SubAgent/AgentTeam, 0.2.3 branch sessions) is not double-counted with the parent; sessions in the official SQLite store are read. Add fixtures for each. |
| 3 | patch | chore | **CI.** GitHub Actions workflow running `pnpm check` on PRs and `main` (Node 24.22.x and 26.x), plus a release-tag job that verifies `package.json` version matches the tag. |
| 4 | minor | feat | **Four-way next-step advisor.** Extend the advisor to continue / wait for off-peak / `/compact` now / fresh session. `/compact` = summarizer request cost (DSH 0.2.3 uses the model that answered last) + post-compact cache shape (system prefix still hits, rewritten history misses). |
| 5 | minor | feat | **Compaction payback and cache-cliff line.** Detect compaction events in session logs; show what the turn after a compaction actually cost vs. the pre-compaction turn, and after how many turns the compaction pays back. |
| 6 | patch | feat | **Advisor accuracy back-test.** Replay each session's history: compare predicted vs. actual next-turn cost, show an error band on the card, and add regression fixtures. Gate item 7 on a reasonable error band. |
| 7 | minor | feat | **Read-only `dsh_balance_advise` agent tool.** Returns the four-way estimate for the current session so the model can decide to compact, wait or switch. Never acts on its own; documented in both READMEs. |
| 8 | minor | feat | **Search/Fetch fees.** DeepSeek Search/Fetch API is billed per successful call (USD 0.75 / CNY 5 per 1,000); since 2026-11-18 12:00 Beijing time, server-side search triggered by DeepSeek models is free and billed only as tokens (DSH 0.2.2-rc.5 routes DeepSeek models to server-side search, other models to the Search API). Count calls from session events with the effective date. |
| 9 | patch | feat | **Pricing coverage panel.** Priced vs. unpriced models, catalog verification date per provider, active overrides, and the StepFun grandfathered-rate limitation, in one place on the Usage page. |
| 10 | patch | chore | **Catalog freshness check.** `scripts/check-prices.mjs` fetches the official DeepSeek (zh/en) and StepFun pricing pages and diffs against the tables in `src/billing.ts`; optional scheduled workflow opens an issue on drift. |
| 11 | minor | feat | **Persisted balance history and runway.** Store balance snapshots locally, chart them, and estimate days left from recent burn rate (peak vs. off-peak aware). |
| 12 | minor | feat | **Soft budget hints.** Daily/session budget in settings; when near the limit, the advisor highlights the cheapest next step (off-peak wait, compact, cheaper configured model). Advice only, never blocks. |
| 13 | patch | feat | **Cache-break detector.** Flag turns where cache-hit ratio collapses unexpectedly (prefix change, model switch, compaction) and estimate what the break cost. |
| 14 | patch | feat | **Traditional Chinese (zh-TW) locale**, following DSH locale fallbacks; check for missing keys in a test. |
| 15 | patch | docs | **Docs refresh.** Current screenshots (advisor card, session drill-down), advisor/agent-tool docs in README/README_EN, and a short "how estimates are computed" page. |
| 16 | patch | chore | **npm publish on release** (blocked: needs an `NPM_TOKEN` repo secret or npm trusted publishing set up by the owner). Workflow publishes with provenance when a `v*` GitHub release is published. |

Hotfixes (upstream DSH breaking a plugin API, official price changes) jump the
queue and ship as patch releases.

## Done

- [x] v0.14.0 — next-turn cost advisor (#10), DeepSeek/StepFun price refresh (#9), DSH 0.2.1-rc.3 compatibility (#11).
