<div align="center">

<img src="assets/icon.png" width="96" height="96" alt="sdd-progress icon">

# sdd-progress

**Live progress of every open [OpenSpec](https://github.com/Fission-AI/OpenSpec) change, in a pane beside the conversation.**

[![Version](https://img.shields.io/badge/version-0.2.0-2563eb?style=flat-square)](CHANGELOG.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-2563eb?style=flat-square)](LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-%E2%89%A5%202.1.275-18181b?style=flat-square)](https://docs.claude.com/en/docs/claude-code)
[![OpenSpec](https://img.shields.io/badge/OpenSpec-1.14.x-15803d?style=flat-square)](https://github.com/Fission-AI/OpenSpec)

[Install](#install) · [How it reads OpenSpec](#how-it-reads-openspec) · [What it shows](#what-it-shows) · [Options](#optional-conventions) · [Privacy](#privacy-and-cost)

</div>

---

## Install

```
/plugin install sdd-progress --marketplace nelomr/claude-mods
```

Or from a terminal:

```bash
claude plugin marketplace add nelomr/claude-mods
claude plugin install sdd-progress@kolen-plugins
```

Requires Claude Code 2.1.275 or later.

## How it reads OpenSpec

It follows the rules of the OpenSpec CLI (checked against 1.14.x), so its counts match `openspec list`:

| Rule | Behaviour |
|---|---|
| Root | The nearest folder at or above the working directory that holds `openspec/changes` or `openspec/specs` |
| Changes | Every folder in `openspec/changes/` except `archive` and dot folders; a folder that only wraps nested changes is reported, not read |
| Schema | `schema` of the change's `.openspec.yaml`, else of `openspec/config.yaml`, else `spec-driven` |
| Schema file | `openspec/schemas/<name>/schema.yaml`, then the user schemas folder (`$XDG_DATA_HOME/openspec`, `%LOCALAPPDATA%\openspec` or `~/.local/share/openspec`), then `node_modules/@fission-ai/openspec/schemas` |
| Task files | The artifact whose `generates` equals `apply.tracks` (else the artifact with id `tasks`); globs such as `plan/**/*.md` are supported, dot files excluded |
| Task lines | Any list marker (`-`, `*`, `+`, `1.`, `1)`) with a one-character checkbox; only `x`/`X` is done, so `[ ]`, `[~]` and `[]` count as pending |
| Artifacts | Every artifact of the schema, present when its `generates` matches a file |

If a schema cannot be found, the change falls back to a top-level `tasks.md`, as the CLI does, and the card shows a warning.

## What it shows

One card per change:

- Overall progress, and progress per `## ` phase of the task files (with several task files, phases are prefixed by the file).
- The current phase and its next task; a button lists its pending tasks.
- The schema artifacts, with missing ones flagged.
- Open questions from the design artifact: items under an "Open Questions" heading that are not marked resolved. When the section numbers its questions (`O1.`, `Q2:`), only numbered items count.
- The age of the newest task file.
- A toast when tasks become ticked.

### Optional conventions

These are not part of OpenSpec. Each has a default and can be changed or disabled in the plugin options (`/config`):

| Option | Default | Effect |
|---|---|---|
| `operatorPattern` | `runbook\|\(operator\b\|operator-only tasks\|agents never run` | Phases whose heading matches count as operator work, split from agent work |
| `gatePattern` | `mandatory gate\|^0\.\s*gates?\b` | A matching phase with pending tasks that names another open change marks the card as blocked by it |
| `unverifiedMarker` | `UNVERIFIED` | Occurrences counted in the design artifact; empty disables it |
| `progressFile` | `apply-progress.md` | Its last `## ` heading is shown as the last activity; empty disables it |

Patterns are case-insensitive regular expressions; an empty or invalid one uses the default.

## Usage

The pane opens when a session starts. Close it with the pane's close mark; reopen it with:

```
/sdd
```

It refreshes after every `Edit`, `Write`, `MultiEdit`, `NotebookEdit` and `Bash` tool call.

## Surfaces

- **Desktop and editor**: each change is an SVG card that follows the system light or dark theme, with text contrast at WCAG AA or better. The only motion is the progress bars easing in, and it is skipped under `prefers-reduced-motion`.
- **Terminal**: the same information as text in the colors of the active Claude Code theme.

## Privacy and cost

- Reads local files only: the OpenSpec folder of the project, schema files, and the `HOME`, `LOCALAPPDATA` and `XDG_DATA_HOME` variables to find user schemas. No network access, no file writes, no processes.
- Makes no model calls and adds nothing to the system prompt or the conversation, apart from the one-line reply of `/sdd`.
- Keeps its state in the session; nothing is stored across sessions.

## Limitations

- OpenSpec stores (`--store`, a global `defaultStore`) are not followed; only the nearest root is read.
- The schema reader understands the `artifacts` (`id`, `generates`) and `apply.tracks` keys in block YAML; flow-style YAML for those keys is not read.
- A change folder is read up to 8 levels deep and 2,000 files.
- The desktop card width is derived from the pane width in code-font cells, with an approximate cell width of 7.8 CSS px.

## License

[MIT](LICENSE)
