<div align="center">

# claude-mods

### Claude Code Plugin Marketplace (`kolen-plugins`)

A collection of **local-first**, **zero-token** Claude Code mods for **spec-driven development**, built on the Claude Code hooks API and the **OpenSpec** workflow.

[![Claude Code](https://img.shields.io/badge/Claude_Code-%E2%89%A52.1.275-D97757?style=for-the-badge&logo=claude&logoColor=white)](https://docs.claude.com/en/docs/claude-code)
[![Marketplace](https://img.shields.io/badge/Marketplace-kolen--plugins-18181B?style=for-the-badge&logo=anthropic&logoColor=white)](#plugins)
[![Plugins](https://img.shields.io/badge/Plugins-1-2563EB?style=for-the-badge)](#plugins)
[![OpenSpec](https://img.shields.io/badge/OpenSpec-1.14.x-15803D?style=for-the-badge)](https://github.com/Fission-AI/OpenSpec)
[![Model calls](https://img.shields.io/badge/Model_calls-0-52525B?style=for-the-badge)](#key-highlights)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](./LICENSE)

<br/>

[**Plugins**](#plugins) •
[**Quick Start**](#quick-start) •
[**Key Highlights**](#key-highlights) •
[**Repository Layout**](#repository-layout) •
[**Development**](#development)

---

</div>

> [!TIP]
> **Install once, update in one command**: add the marketplace with `claude plugin marketplace add nelomr/claude-mods`, then install any plugin as `<plugin>@kolen-plugins`.

## Plugins

<table>
  <tr>
    <td width="96" align="center" valign="top">
      <img src="plugins/kolen-sdd-progress/assets/icon.png" width="64" height="64" alt="kolen-sdd-progress icon">
    </td>
    <td valign="top">
      <h3><a href="plugins/kolen-sdd-progress">kolen-sdd-progress</a> <sub><code>v0.4.1</code></sub></h3>
      A pane beside the conversation with the live progress of every open <a href="https://github.com/Fission-AI/OpenSpec">OpenSpec</a> change: per-phase task bars, next task, missing artifacts, open questions and gate blockers. Counts match <code>openspec list</code>, custom schemas and <code>apply.tracks</code> included.
      <br><br>
      <code>kolen-sdd-progress@kolen-plugins</code>
    </td>
  </tr>
</table>

## Quick Start

Add the marketplace once, then install any plugin from it:

```bash
claude plugin marketplace add nelomr/claude-mods
claude plugin install kolen-sdd-progress@kolen-plugins
```

Or in one step from inside Claude Code:

```
/plugin install kolen-sdd-progress --marketplace nelomr/claude-mods
```

Keep them current:

```bash
claude plugin marketplace update kolen-plugins
```

## Key Highlights

<table>
  <tr>
    <td width="33%" valign="top">
      <h4>Local First</h4>
      <p>Plugins read files on your machine only. No network access and no telemetry.</p>
    </td>
    <td width="33%" valign="top">
      <h4>Zero Token Cost</h4>
      <p>No model calls and nothing added to the system prompt or the conversation.</p>
    </td>
    <td width="33%" valign="top">
      <h4>Read Only</h4>
      <p>Never writes to your project, runs processes or changes settings.</p>
    </td>
  </tr>
  <tr>
    <td width="33%" valign="top">
      <h4>WCAG 2.1 AA Accessible</h4>
      <p>Light and dark themes, AA contrast or better, and honours <code>prefers-reduced-motion</code>.</p>
    </td>
    <td width="33%" valign="top">
      <h4>Every Surface</h4>
      <p>SVG cards on desktop and in the editor; themed text in the terminal.</p>
    </td>
    <td width="33%" valign="top">
      <h4>Documented &amp; Versioned</h4>
      <p>A README, a CHANGELOG with <a href="https://semver.org/">Semantic Versioning</a> and an MIT license per plugin.</p>
    </td>
  </tr>
</table>

## Repository Layout

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

[MIT](./LICENSE) © 2026 nelomr
