# Changelog

All notable changes to this plugin are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the plugin uses [Semantic Versioning](https://semver.org/).

## [0.4.2] - 2026-10-25

### Changed

- `plugin.json` no longer declares `types`; the state contract in `types/index.d.ts` is still found and checked by convention.

## [0.4.1] - 2026-10-25

### Fixed

- The card's bar helper no longer names a parameter `h`, which JSX compiles element calls to (directory finding `MOD_CAPABILITY_USE_NOT_PLAIN`).
- Identifiers named `key` in the parser are renamed (`field`, `doneTaskIds`), which the directory read as reading the installer's key.

### Changed

- README states that the `command.run` hook matches only the mod's own `/sdd` command.

## [0.4.0] - 2026-10-25

### Changed

- User-level schemas are read from the new `userSchemasDir` option instead of the `HOME`, `LOCALAPPDATA` and `XDG_DATA_HOME` variables; the mod no longer reads environment variables.
- README documents every hook and what it does.

## [0.3.0] - 2026-10-25

### Changed

- Plugin renamed from `sdd-progress` to `kolen-sdd-progress` (install id `kolen-sdd-progress@kolen-plugins`). The `/sdd` command and the pane title are unchanged.

## [0.2.0] - 2026-10-25

### Added

- Schema-aware task files: the change's or project's schema is resolved like the OpenSpec CLI (project, user and package schemas) and `apply.tracks` selects the task files, globs included.
- Artifact presence for every artifact of the schema.
- OpenSpec root resolution from the working directory upwards.
- Notice for folders that wrap nested changes; warning when a schema cannot be found.
- Plugin options for the optional conventions: `operatorPattern`, `gatePattern`, `unverifiedMarker`, `progressFile`.

### Changed

- Task lines are recognised exactly as the OpenSpec CLI counts them (any list marker, one-character checkbox, only `x`/`X` done), so totals match `openspec list`.
- Open questions: any unresolved item under "Open Questions"; only numbered items when the section numbers them.
- Ticked-task toasts also work for tasks without a numeric id.

## [0.1.0] - 2026-10-25

### Added

- Pane with one card per open OpenSpec change: overall and per-phase progress, agent and operator pending counts, gate blockers, next task, artifact presence, `UNVERIFIED` markers, open questions and last activity.
- `/sdd` command to reopen the pane.
- Toast for newly ticked tasks and a button that lists the pending tasks of the current phase.
- SVG cards with light and dark themes for desktop and editor; themed text for the terminal.
