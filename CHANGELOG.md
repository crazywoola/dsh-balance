# Changelog

All notable changes to `@pinkbanana/dsh-balance` are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses [Semantic Versioning](https://semver.org/) (0.x: minor
for features, patch for fixes). Full notes for each version are on the
[GitHub releases page](https://github.com/crazywoola/dsh-balance/releases).

## [Unreleased]

## [0.16.0] - 2026-11-28

### Added
- [Features] Tokener catalog refresh: re-checked the official public catalog on 2026-11-28, added missing models (including context-tier `claude-haiku-5-5`, official off-peak `deepseek-flash` / `deepseek-v4-pro`, and input-only embedding models), and kept the 2026-11-03 snapshot for IDs that left the public catalog.
- [Features] The advisor now offers “wait for off-peak” for Tokener models that publish official off-peak rates, using Tokener's calendar window (2026-01-01 through 2027-12-31).

### Changed
- [Features] Tokener `grok-4.3` and `grok-4.6` rates, and `claude-haiku-5-5` context tiers, follow the 2026-11-28 catalog from 00:00 Beijing time on that day; earlier requests keep the previous snapshot.

## [0.15.4] - 2026-11-27

### Changed
- [UI] Docs screenshots: added narrow (360px) dark-theme captures of the advisor card and the Usage page in zh-TW and en, taken with `pnpm preview`, and embedded them in both READMEs.

## [0.15.3] - 2026-11-27

### Added
- [UX] Docs refresh: current advisor-card and session drill-down screenshots, a short “how estimates are computed” page (zh/en), and README links that document the four next steps, the local advice API, and that the planned `dsh_balance_advise` agent tool is not shipped yet.
- The fixture preview now includes the `/compact` estimate (and its caveat) so screenshots and local checks match the shipped advisor.

## [0.15.2] - 2026-11-27

### Fixed
- [Bugfix] zh-TW terminology review: replaced mainland-only wording with Taiwan usage (供應商, 工作階段, 尖峰/離峰, 權限, 控制台, 存取, 參數, 逾時, 自訂, 清單, 回應, 「」 quotes), fixed “back to overview” (返回總覽); placeholders unchanged. Added a terminology regression test.

## [0.15.1] - 2026-11-26

### Added
- [Stability] GitHub Actions CI: runs `pnpm check` on PRs and `main` (Node 24.22.x and 26.x) and, for `v*` tags, verifies the tag matches the `package.json` version.

## [0.15.0] - 2026-11-26

### Added
- [Features] The advisor now prices `/compact` now (summarizer request over the whole history plus the first post-compact turn, with only the smallest session cache-hit prefix still hitting) next to continue / wait / fresh, in the API, card and dock, zh/zh-TW/en, with an assumptions caveat.
- `ROADMAP.md` with the ranked release backlog.

## [0.14.4] - 2026-11-26

### Fixed
- [UI] The Usage page now forwards the advisor loader, so the next-turn estimate card appears when drilling into a session there (it was only shown in the session tab).
- [UI] Advisor card amounts no longer break inside the "(fixed-rate conversion)" label at narrow widths; long model ids, catalog lines and caveats wrap instead of overflowing.
- [UI] The fixture preview now renders the advisor card/dock and supports `?lang=zh-tw`, so narrow-width and dark-theme checks cover zh-TW and en.

## [0.14.3] - 2026-11-25

### Added
- [UX] Traditional Chinese (zh-TW) locale, registered as the `zh-tw` language (label 繁體中文) that falls back per key to `zh`, then `en`, following DSH locale fallbacks. A test checks it has no missing or extra keys versus zh/en and keeps `{placeholders}` intact.

## [0.14.2] - 2026-11-25

### Fixed
- [Stability] DSH peer ranges now admit `0.2.3-alpha.*`/`0.2.3-rc.*` prereleases under standard semver rules, so npm/pnpm no longer report unmet peers on DSH `0.2.3-alpha.2`. Added regression tests.

## [0.14.1] - 2026-11-25

### Fixed
- [Bugfix] Added the 2027 Chinese public-holiday calendar (国办发明电〔2026〕10号), so weekday holidays from 2027-01-01 are off-peak instead of peak. The advisor now warns when a date is past the last known holiday year.

## [0.14.0] - 2026-11-24

### Added
- Next-turn cost advisor: estimates from the current session's shape, cache savings, peak vs. off-peak and alternative configured models (#10).
- Session drill-down, JSON/CSV usage export, pricing overrides and a display exchange rate.
- Recent balance history and low-balance alerts.

### Fixed
- Install and start on DSH `0.2.1-rc.3` without a version exemption; keeps DSH `0.2.2` prerelease support (#11).
- Retry transient upstream failures; refreshed official DeepSeek Flash and StepFun prices (#9).

## [0.13.1] - 2026-11-06

### Changed
- Broad DSH 0.x compatibility range (`>=0.2.2-rc.1 <1.0.0-0`) for engines and peers.

## [0.13.0] - 2026-11-06

### Fixed
- Support DSH `0.2.2-rc.1`.

## [0.12.1] - 2026-11-03

### Fixed
- Bound usage-statistics memory and share log reads.

## [0.12.0] - 2026-11-03

### Added
- Tokener usage statistics; support DSH `0.2.1-rc.5`.

[Unreleased]: https://github.com/crazywoola/dsh-balance/compare/v0.16.0...HEAD
[0.16.0]: https://github.com/crazywoola/dsh-balance/compare/v0.15.4...v0.16.0
[0.15.4]: https://github.com/crazywoola/dsh-balance/compare/v0.15.3...v0.15.4
[0.15.3]: https://github.com/crazywoola/dsh-balance/compare/v0.15.2...v0.15.3
[0.15.2]: https://github.com/crazywoola/dsh-balance/compare/v0.15.1...v0.15.2
[0.15.1]: https://github.com/crazywoola/dsh-balance/compare/v0.15.0...v0.15.1
[0.15.0]: https://github.com/crazywoola/dsh-balance/compare/v0.14.4...v0.15.0
[0.14.4]: https://github.com/crazywoola/dsh-balance/compare/v0.14.3...v0.14.4
[0.14.3]: https://github.com/crazywoola/dsh-balance/compare/v0.14.2...v0.14.3
[0.14.2]: https://github.com/crazywoola/dsh-balance/compare/v0.14.1...v0.14.2
[0.14.1]: https://github.com/crazywoola/dsh-balance/compare/v0.14.0...v0.14.1
[0.14.0]: https://github.com/crazywoola/dsh-balance/compare/v0.13.1...v0.14.0
[0.13.1]: https://github.com/crazywoola/dsh-balance/compare/v0.13.0...v0.13.1
[0.13.0]: https://github.com/crazywoola/dsh-balance/compare/v0.12.1...v0.13.0
[0.12.1]: https://github.com/crazywoola/dsh-balance/compare/v0.12.0...v0.12.1
[0.12.0]: https://github.com/crazywoola/dsh-balance/compare/v0.11.0...v0.12.0
