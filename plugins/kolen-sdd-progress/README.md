<div align="center">

<img src="assets/icon.png" width="96" height="96" alt="kolen-sdd-progress icon">

# kolen-sdd-progress

### Live OpenSpec Progress Pane for Claude Code

Every open **OpenSpec** change in a pane beside the conversation: **per-phase progress**, **next task**, **missing artifacts**, **open questions** and **gate blockers**, read straight from the change files.

[![Version](https://img.shields.io/badge/Version-0.4.0-2563EB?style=for-the-badge)](./CHANGELOG.md)
[![Claude Code](https://img.shields.io/badge/Claude_Code-%E2%89%A52.1.275-D97757?style=for-the-badge&logo=claude&logoColor=white)](https://docs.claude.com/en/docs/claude-code)
[![OpenSpec](https://img.shields.io/badge/OpenSpec-1.14.x-15803D?style=for-the-badge)](https://github.com/Fission-AI/OpenSpec)
[![Model calls](https://img.shields.io/badge/Model_calls-0-52525B?style=for-the-badge)](#privacy-and-cost)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](./LICENSE)

<br/>

[**Install**](#install) •
[**How It Reads OpenSpec**](#how-it-reads-openspec) •
[**What It Shows**](#what-it-shows) •
[**Options**](#optional-conventions) •
[**Privacy**](#privacy-and-cost)

---

</div>

> [!TIP]
> **Counts you can trust**: tasks are read with the same rules as the OpenSpec CLI, so the pane always agrees with `openspec list`, custom schemas and `apply.tracks` included.

## Install

```
/plugin install kolen-sdd-progress --marketplace nelomr/claude-mods
```

Or from a terminal:

```bash
claude plugin marketplace add nelomr/claude-mods
claude plugin install kolen-sdd-progress@kolen-plugins
```

Requires Claude Code 2.1.275 or later.

## How it reads OpenSpec

It follows the rules of the OpenSpec CLI (checked against 1.14.x), so its counts match `openspec list`:

| Rule | Behaviour |
|---|---|
| Root | The nearest folder at or above the working directory that holds `openspec/changes` or `openspec/specs` |
| Changes | Every folder in `openspec/changes/` except `archive` and dot folders; a folder that only wraps nested changes is reported, not read |
| Schema | `schema` of the change's `.openspec.yaml`, else of `openspec/config.yaml`, else `spec-driven` |
| Schema file | `openspec/schemas/<name>/schema.yaml`, then the user schemas folder set in the `userSchemasDir` option (skipped when empty), then `node_modules/@fission-ai/openspec/schemas` |
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
| `userSchemasDir` | empty | Absolute path of your OpenSpec user schemas folder, usually `~/.local/share/openspec/schemas` expanded (`%LOCALAPPDATA%\openspec\schemas` on Windows); empty skips user-level schemas |

Patterns are case-insensitive regular expressions; an empty or invalid one uses the default.

## Usage

The pane opens when a session starts. Close it with the pane's close mark; reopen it with:

```
/sdd
```

It refreshes after every `Edit`, `Write`, `MultiEdit`, `NotebookEdit` and `Bash` tool call.

## Hooks

The mod registers four hooks and one command. This is everything it does:

| Hook | When it runs | What it does |
|---|---|---|
| `session.start` | Once per session | Registers the `/sdd` command, reads the OpenSpec changes and opens the pane |
| `command.run` (`/sdd`) | When you type `/sdd` | Reads the changes again, reopens the pane and replies with one line: `SDD pane opened.` |
| `tool.call` | After every tool call | Lets the call run unchanged; after `Edit`, `Write`, `MultiEdit`, `NotebookEdit` or `Bash` it reads the changes again and shows a toast for newly ticked tasks. It never blocks, rewrites or delays a call, and a failed read leaves the call as it was |
| `ui.render` (pane) | When the pane is drawn | Draws the cards from the session state; the pending-tasks button only toggles which card is expanded |

Reading the changes means listing `openspec/changes`, reading the task, design and progress files of each change and the schema files, and stating the task files for their modification time.

## Surfaces

- **Desktop and editor**: each change is an SVG card that follows the system light or dark theme, with text contrast at WCAG AA or better. The only motion is the progress bars easing in, and it is skipped under `prefers-reduced-motion`.
- **Terminal**: the same information as text in the colors of the active Claude Code theme.

## Privacy and cost

- Reads local files only: the OpenSpec folder of the project and the schema files above. It reads no environment variables and no credentials. No network access, no file writes, no processes.
- Makes no model calls and adds nothing to the system prompt or the conversation, apart from the one-line reply of `/sdd`.
- Keeps its state in the session; nothing is stored across sessions.

## Limitations

- OpenSpec stores (`--store`, a global `defaultStore`) are not followed; only the nearest root is read.
- The schema reader understands the `artifacts` (`id`, `generates`) and `apply.tracks` keys in block YAML; flow-style YAML for those keys is not read.
- A change folder is read up to 8 levels deep and 2,000 files.
- The desktop card width is derived from the pane width in code-font cells, with an approximate cell width of 7.8 CSS px.

## License

[MIT](LICENSE)
