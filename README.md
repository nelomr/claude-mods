<div align="center">

# claude-mods

**`kolen-plugins` — a Claude Code plugin marketplace of local-first mods for spec-driven development.**

[![License: MIT](https://img.shields.io/badge/license-MIT-2563eb?style=flat-square)](LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-%E2%89%A5%202.1.275-18181b?style=flat-square)](https://docs.claude.com/en/docs/claude-code)
[![Plugins](https://img.shields.io/badge/plugins-1-15803d?style=flat-square)](#plugins)
[![No model calls](https://img.shields.io/badge/model%20calls-0-52525b?style=flat-square)](#principles)

[Plugins](#plugins) · [Quick start](#quick-start) · [Principles](#principles) · [Development](#development)

</div>

---

## Plugins

<table>
  <tr>
    <td width="96" align="center" valign="top">
      <img src="plugins/sdd-progress/assets/icon.png" width="64" height="64" alt="sdd-progress icon">
    </td>
    <td valign="top">
      <h3><a href="plugins/sdd-progress">sdd-progress</a> <sub><code>v0.2.0</code></sub></h3>
      A pane beside the conversation with the live progress of every open <a href="https://github.com/Fission-AI/OpenSpec">OpenSpec</a> change: per-phase task bars, next task, missing artifacts, open questions and gate blockers. Counts match <code>openspec list</code>, custom schemas and <code>apply.tracks</code> included.
      <br><br>
      <code>sdd-progress@kolen-plugins</code>
    </td>
  </tr>
</table>

## Quick start

Add the marketplace once, then install any plugin from it:

```bash
claude plugin marketplace add nelomr/claude-mods
claude plugin install sdd-progress@kolen-plugins
```

Or in one step from inside Claude Code:

```
/plugin install sdd-progress --marketplace nelomr/claude-mods
```

Keep them current:

```bash
claude plugin marketplace update kolen-plugins
```

## Principles

Every plugin here follows the same rules:

| | |
|---|---|
| **Local first** | Reads files on your machine. No network access, no telemetry. |
| **Zero token cost** | No model calls and nothing added to the system prompt or the conversation. |
| **Read only** | Never writes to your project, runs processes or changes settings. |
| **Accessible** | Light and dark themes, WCAG AA contrast, honours reduced motion. |
| **Documented** | A README, a CHANGELOG with [Semantic Versioning](https://semver.org/) and an MIT license per plugin. |

## Repository layout

```
.claude-plugin/
  marketplace.json          marketplace manifest (kolen-plugins)
plugins/
  <plugin>/
    .claude-plugin/
      plugin.json           plugin manifest and options
    hooks/                  hooks module
    types/                  state contract
    assets/icon.png         listing icon
    README.md
    CHANGELOG.md
    LICENSE
```

## Development

Validate before every release:

```bash
claude plugin validate .
claude plugin validate plugins/<plugin> --profile directory
```

A release:

1. Bumps `version` in the plugin's `plugin.json` and in `marketplace.json`.
2. Adds an entry to the plugin's `CHANGELOG.md`.
3. Passes both validations above.

## License

[MIT](LICENSE) © 2026 nelomr
