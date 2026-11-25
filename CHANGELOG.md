# Changelog

All notable changes to `@pinkbanana/dsh-balance` are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses [Semantic Versioning](https://semver.org/) (0.x: minor
for features, patch for fixes). Full notes for each version are on the
[GitHub releases page](https://github.com/crazywoola/dsh-balance/releases).

## [Unreleased]

### Added
- `ROADMAP.md` with the ranked release backlog.

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

[Unreleased]: https://github.com/crazywoola/dsh-balance/compare/v0.14.0...HEAD
[0.14.0]: https://github.com/crazywoola/dsh-balance/compare/v0.13.1...v0.14.0
[0.13.1]: https://github.com/crazywoola/dsh-balance/compare/v0.13.0...v0.13.1
[0.13.0]: https://github.com/crazywoola/dsh-balance/compare/v0.12.1...v0.13.0
[0.12.1]: https://github.com/crazywoola/dsh-balance/compare/v0.12.0...v0.12.1
[0.12.0]: https://github.com/crazywoola/dsh-balance/compare/v0.11.0...v0.12.0
