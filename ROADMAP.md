# Roadmap

Last researched: 2026-11-25. This is the ranked backlog for the automated
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

Organized by area; ranks within each area are priority order. Pick the area served least recently, then its top unchecked item.

### Stability

1. **DSH 0.2.3 compatibility pass.** Verify install/start on `dsh-v0.2.3-alpha.2` (Node ≥ 24.22.3 / ≥ 26.13.1): peer ranges under standard semver also admit 0.2.3 prereleases; usage from forked/branch sessions (0.2.2-rc.2 SubAgent/AgentTeam, 0.2.3 branch sessions) is not double-counted with the parent; sessions in the official SQLite store are read. Add fixtures for each.  _(was #2, patch fix)_
2. **CI.** GitHub Actions workflow running `pnpm check` on PRs and `main` (Node 24.22.x and 26.x), plus a release-tag job that verifies `package.json` version matches the tag.  _(was #3, patch chore)_
3. **Catalog freshness check.** `scripts/check-prices.mjs` fetches the official DeepSeek (zh/en) and StepFun pricing pages and diffs against the tables in `src/billing.ts`; optional scheduled workflow opens an issue on drift.  _(was #10, patch chore)_
4. **npm publish on release** (blocked: needs an `NPM_TOKEN` repo secret or npm trusted publishing set up by the owner). Workflow publishes with provenance when a `v*` GitHub release is published.  _(was #16, patch chore)_

### Bugfix

1. **zh-TW terminology review.** The 0.14.3 zh-TW dictionary was converted from zh with OpenCC (s2twp) plus manual term fixes; have a native reader review billing/advice wording and fix mistranslations, keeping `{placeholders}` intact.  _(patch fix)_

### Features

1. **Four-way next-step advisor.** Extend the advisor to continue / wait for off-peak / `/compact` now / fresh session. `/compact` = summarizer request cost (DSH 0.2.3 uses the model that answered last) + post-compact cache shape (system prefix still hits, rewritten history misses).  _(was #4, minor feat)_
2. **Compaction payback and cache-cliff line.** Detect compaction events in session logs; show what the turn after a compaction actually cost vs. the pre-compaction turn, and after how many turns the compaction pays back.  _(was #5, minor feat)_
3. **Advisor accuracy back-test.** Replay each session's history: compare predicted vs. actual next-turn cost, show an error band on the card, and add regression fixtures. Gate item 7 on a reasonable error band.  _(was #6, patch feat)_
4. **Read-only `dsh_balance_advise` agent tool.** Returns the four-way estimate for the current session so the model can decide to compact, wait or switch. Never acts on its own; documented in both READMEs.  _(was #7, minor feat)_
5. **Search/Fetch fees.** DeepSeek Search/Fetch API is billed per successful call (USD 0.75 / CNY 5 per 1,000); since 2026-11-18 12:00 Beijing time, server-side search triggered by DeepSeek models is free and billed only as tokens (DSH 0.2.2-rc.5 routes DeepSeek models to server-side search, other models to the Search API). Count calls from session events with the effective date.  _(was #8, minor feat)_
6. **Pricing coverage panel.** Priced vs. unpriced models, catalog verification date per provider, active overrides, and the StepFun grandfathered-rate limitation, in one place on the Usage page.  _(was #9, patch feat)_
7. **Persisted balance history and runway.** Store balance snapshots locally, chart them, and estimate days left from recent burn rate (peak vs. off-peak aware).  _(was #11, minor feat)_
8. **Soft budget hints.** Daily/session budget in settings; when near the limit, the advisor highlights the cheapest next step (off-peak wait, compact, cheaper configured model). Advice only, never blocks.  _(was #12, minor feat)_
9. **Cache-break detector.** Flag turns where cache-hit ratio collapses unexpectedly (prefix change, model switch, compaction) and estimate what the break cost.  _(was #13, patch feat)_

### UX

1. **Docs refresh.** Current screenshots (advisor card, session drill-down), advisor/agent-tool docs in README/README_EN, and a short "how estimates are computed" page.  _(was #15, patch docs)_

### UI

1. **Advisor card polish.** Check the advisor card and Usage page at narrow widths and in dark theme (contrast, wrapping of longer zh-TW/en strings), using the `?lang=…&theme=dark` preview, and refresh affected screenshots.  _(patch fix)_

Hotfixes (upstream DSH breaking a plugin API, official price changes) jump the
queue and ship as patch releases.

## Done

- [x] v0.14.3 — [UX] Traditional Chinese (zh-TW) locale (`zh-tw` language, falls back to `zh` then `en`; key-parity test).
- [x] v0.14.2 — [Stability] DSH `0.2.3-alpha.*` peer ranges under standard semver (peer fix + tests). Remaining part of old #2 (forked-session double-count, SQLite store) stays open as Stability #1.

- [x] v0.14.1 — [Bugfix] 2027 holiday calendar + calendar-horizon caveat.
- [x] v0.14.0 — next-turn cost advisor (#10), DeepSeek/StepFun price refresh (#9), DSH 0.2.1-rc.3 compatibility (#11).
