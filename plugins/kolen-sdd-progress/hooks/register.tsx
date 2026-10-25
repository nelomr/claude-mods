import { atom, read, update } from 'claude-code'
import type { EngineInterface, PluginOptions, Register } from 'claude-code'

import type { ArtifactState, ChangeProgress, Phase, ScanResult } from '../types'
import type { Conventions, SchemaInfo, TaskFile } from './parse'
import {
  age,
  buildProgress,
  DEFAULT_CONVENTIONS,
  matchOutputs,
  newlyDone,
  parseSchema,
  patternOption,
  SPEC_DRIVEN,
  trackedGlob,
  yamlScalar,
} from './parse'

const PANE = 'kolen-sdd-progress'
const EMPTY: ScanResult = { root: undefined, changes: [], notices: [] }
const scanState = atom({ plugin: 'kolen-sdd-progress', key: 'scan' } as const, EMPTY)
const scannedAt = atom({ plugin: 'kolen-sdd-progress', key: 'scannedAt' } as const, 0)
const expanded = atom({ plugin: 'kolen-sdd-progress', key: 'expanded' } as const, '')
const WRITERS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'Bash'])

const CARD_W = 520
// Approximate advance of the desktop code font in CSS px; bodyColumns is in those cells.
const CELL_PX = 7.8
const PAD = 16
const PHASE_ROW = 18
const MAX_PENDING = 8
// Bounds of one change folder listing: nesting depth and entries read.
const MAX_DEPTH = 8
const MAX_FILES = 2000
const PACKAGE_SCHEMAS = 'node_modules/@fission-ai/openspec/schemas'

type Settings = { conventions: Conventions; progressFile: string }

function settingsFrom(options: PluginOptions): Settings {
  const marker = options.unverifiedMarker
  const progress = options.progressFile
  return {
    conventions: {
      operator: patternOption(options.operatorPattern, DEFAULT_CONVENTIONS.operator),
      gate: patternOption(options.gatePattern, DEFAULT_CONVENTIONS.gate),
      unverified: typeof marker === 'string' ? marker.trim() : DEFAULT_CONVENTIONS.unverified,
    },
    progressFile: typeof progress === 'string' ? progress.trim() : 'apply-progress.md',
  }
}

function ratioOf(done: number, total: number): number {
  return total === 0 ? 0 : done / total
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function phaseLabel(phase: Phase): string {
  return phase.title.replace(/\s*\((?:about|cannot)[^)]*\)\s*$/i, '')
}

function cardHeight(change: ChangeProgress): number {
  return 84 + change.phases.length * PHASE_ROW + 30
}

function parentOf(dir: string): string {
  const cut = dir.replace(/[\\/]+$/, '').replace(/[\\/][^\\/]*$/, '')
  return cut === '' ? '/' : cut
}

// Card drawn by the surface itself: no hook timers, no model calls. Contrast on
// its own background: text >= 13:1, muted >= 7:1, accent, done and warn >= 4.5:1
// (WCAG AA), light and dark. One motion only: the bars ease in on redraw,
// skipped under prefers-reduced-motion.
function card(change: ChangeProgress, pxW: number, marker: string): string {
  const height = cardHeight(change)
  const ratio = ratioOf(change.done, change.total)
  const barW = CARD_W - PAD * 2
  const isDone = change.total > 0 && ratio >= 1
  const pct = Math.round(ratio * 100)
  const bar = (x: number, y: number, w: number, r: number, cls: string, h: number) => {
    const fill = Math.max(r > 0 ? 3 : 0, Math.round(w * r))
    return `<rect class="k" x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}"/>${
      fill === 0
        ? ''
        : `<rect class="${cls}" x="${x}" y="${y}" width="${fill}" height="${h}" rx="${h / 2}"><animate attributeName="width" from="0" to="${fill}" dur="0.6s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.25 0.1 0.25 1"/></rect>`
    }`
  }

  const miniW = 140
  const barStart = CARD_W - PAD - miniW - 44
  const rows = change.phases
    .map((phase, index) => {
      const y = 76 + index * PHASE_ROW
      const r = ratioOf(phase.done, phase.total)
      const isCurrent = phase.title === change.currentPhase
      const titleCls = isCurrent ? 't' : 'm'
      const weight = isCurrent ? ' font-weight="600"' : ''
      const tag = phase.isOperator ? ' <tspan class="w">operator</tspan>' : ''
      const cls = r >= 1 ? 'd' : phase.isOperator ? 'w' : 'a'
      return `<text class="${titleCls}" x="${PAD}" y="${y + 9}" font-size="11"${weight} clip-path="url(#tc)">${esc(phaseLabel(phase))}${tag}</text>
${bar(barStart, y + 3, miniW, r, cls, 5)}
<text class="m" x="${CARD_W - PAD}" y="${y + 9}" font-size="11" text-anchor="end">${phase.done}/${phase.total}</text>`
    })
    .join('\n')

  const mark = (artifact: ArtifactState) =>
    `<tspan class="${artifact.isPresent ? 'm' : 'w'}">${artifact.isPresent ? '' : '✗ '}${esc(artifact.id)}</tspan>`
  const footY = height - 18
  const notes = [
    change.schema !== 'spec-driven' ? `<tspan class="m">${esc(clip(change.schema, 20))}</tspan>` : '',
    change.unverified > 0 ? `<tspan class="w">${change.unverified} ${esc(clip(marker, 14))}</tspan>` : '',
    change.openQuestions.length > 0 ? `<tspan class="w">${change.openQuestions.length} open Q</tspan>` : '',
  ]
    .filter(Boolean)
    .join('<tspan class="m"> · </tspan>')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pxW}" height="${Math.round((pxW * height) / CARD_W)}" viewBox="0 0 ${CARD_W} ${height}" preserveAspectRatio="xMinYMin meet">
<defs><clipPath id="tc"><rect x="${PAD}" y="0" width="${barStart - PAD - 12}" height="${height}"/></clipPath><clipPath id="fc"><rect x="${PAD}" y="0" width="${CARD_W / 2 - PAD}" height="${height}"/></clipPath></defs>
<style>
.s{fill:#ffffff;stroke:#e4e4e7}.t{fill:#18181b}.m{fill:#52525b}.k{fill:#e4e4e7}.a{fill:#2563eb}.d{fill:#15803d}.w{fill:#b45309}.r{stroke:#e4e4e7}
text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
@media (prefers-color-scheme:dark){.s{fill:#18181b;stroke:#27272a}.t{fill:#f4f4f5}.m{fill:#a1a1aa}.k{fill:#27272a}.a{fill:#60a5fa}.d{fill:#4ade80}.w{fill:#fbbf24}.r{stroke:#27272a}}
@media (prefers-reduced-motion:reduce){animate{display:none}}
</style>
<rect class="s" x="0.5" y="0.5" width="${CARD_W - 1}" height="${height - 9}" rx="8"/>
<text class="t" x="${PAD}" y="26" font-size="13" font-weight="600">${esc(clip(change.name, 30))}</text>
<text class="m" x="${CARD_W - PAD}" y="26" font-size="12" text-anchor="end">${change.done} / ${change.total} · <tspan class="${isDone ? 'd' : 'a'}" font-weight="600">${pct}%</tspan></text>
${bar(PAD, 36, barW, ratio, isDone ? 'd' : 'a', 6)}
<text class="m" x="${PAD}" y="60" font-size="11">Agents ${change.agentPending} pending · <tspan class="w">You ${change.operatorPending}</tspan></text>
<line class="r" x1="${PAD}" y1="68" x2="${CARD_W - PAD}" y2="68"/>
${rows}
<line class="r" x1="${PAD}" y1="${footY - 14}" x2="${CARD_W - PAD}" y2="${footY - 14}"/>
<text x="${PAD}" y="${footY}" font-size="11" clip-path="url(#fc)">${change.artifacts.map(mark).join('<tspan class="m"> · </tspan>')}</text>
<text x="${CARD_W - PAD}" y="${footY}" font-size="11" text-anchor="end">${notes}</text>
</svg>`
}

async function exists($: EngineInterface, path: string): Promise<boolean> {
  return $.fs.exists(path).catch(() => false)
}

async function readText($: EngineInterface, path: string): Promise<string | undefined> {
  const text = await $.fs.read(path).catch(() => undefined)
  return typeof text === 'string' ? text : undefined
}

// The nearest folder at or above the working directory holding openspec/changes or openspec/specs,
// as OpenSpec resolves its "nearest" root.
async function findRoot($: EngineInterface): Promise<string | undefined> {
  let dir = await $.session.cwd()
  for (let i = 0; i < 64; i += 1) {
    if ((await exists($, `${dir}/openspec/changes`)) || (await exists($, `${dir}/openspec/specs`))) return dir
    const parent = parentOf(dir)
    if (parent === dir) return undefined
    dir = parent
  }
  return undefined
}

async function walkFiles($: EngineInterface, base: string, rel: string, depth: number, files: string[]): Promise<void> {
  if (depth > MAX_DEPTH || files.length >= MAX_FILES) return
  const entries = await $.fs.list(rel === '' ? base : `${base}/${rel}`).catch(() => [])
  for (const entry of entries) {
    if (entry.name.startsWith('.') || files.length >= MAX_FILES) continue
    const path = rel === '' ? entry.name : `${rel}/${entry.name}`
    if (entry.kind === 'file') files.push(path)
    else if (entry.kind === 'dir') await walkFiles($, base, path, depth + 1, files)
  }
}

// Posix paths of the regular files under a change folder, dot entries skipped like OpenSpec's globs.
async function listFiles($: EngineInterface, base: string): Promise<string[]> {
  const files: string[] = []
  await walkFiles($, base, '', 0, files)
  return files
}

// The user data folder OpenSpec reads user schemas from (XDG_DATA_HOME, LOCALAPPDATA or ~/.local/share).
async function userDataDir($: EngineInterface): Promise<string | undefined> {
  const xdg = await $.env.get('XDG_DATA_HOME')
  if (xdg) return `${xdg}/openspec`
  const local = await $.env.get('LOCALAPPDATA')
  if (local) return `${local}/openspec`
  const home = await $.env.get('HOME')
  return home ? `${home}/.local/share/openspec` : undefined
}

// Project schema, then user schema, then the package built-in, as OpenSpec's resolver orders them.
async function resolveSchema(
  $: EngineInterface,
  root: string,
  name: string,
  cache: Map<string, SchemaInfo | undefined>,
): Promise<SchemaInfo | undefined> {
  if (cache.has(name)) return cache.get(name)
  const userDir = await userDataDir($)
  const candidates = [
    `${root}/openspec/schemas/${name}/schema.yaml`,
    ...(userDir ? [`${userDir}/schemas/${name}/schema.yaml`] : []),
    `${root}/${PACKAGE_SCHEMAS}/${name}/schema.yaml`,
  ]
  let schema: SchemaInfo | undefined
  for (const path of candidates) {
    const yaml = await readText($, path)
    if (yaml === undefined) continue
    schema = parseSchema(name, yaml)
    break
  }
  if (schema === undefined && name === SPEC_DRIVEN.name) schema = SPEC_DRIVEN
  cache.set(name, schema)
  return schema
}

async function scan($: EngineInterface, settings: Settings): Promise<ScanResult> {
  const root = await findRoot($)
  if (root === undefined) return EMPTY
  const dir = `${root}/openspec/changes`
  const config = await readText($, `${root}/openspec/config.yaml`)
  const projectSchema = config ? yamlScalar(config, 'schema') : undefined
  const names = (await $.fs.list(dir).catch(() => []))
    .filter(entry => entry.kind === 'dir' && entry.name !== 'archive' && !entry.name.startsWith('.'))
    .map(entry => entry.name)
  const cache = new Map<string, SchemaInfo | undefined>()
  const notices: string[] = []
  const found: ChangeProgress[] = []
  for (const name of names) {
    const base = `${dir}/${name}`
    const files = await listFiles($, base)
    const metadata = await readText($, `${base}/.openspec.yaml`)
    if (metadata === undefined && files.length > 0 && files.every(file => file.includes('/'))) {
      const nested = await exists($, `${base}/${files[0]?.split('/')[0]}/.openspec.yaml`)
      if (nested) {
        notices.push(`${name} is not a change: it wraps nested changes`)
        continue
      }
    }
    const warnings: string[] = []
    const schemaName = (metadata ? yamlScalar(metadata, 'schema') : undefined) ?? projectSchema ?? SPEC_DRIVEN.name
    const schema = await resolveSchema($, root, schemaName, cache)
    let taskPaths: string[]
    if (schema === undefined) {
      warnings.push(`Schema "${schemaName}" not found; reading tasks.md`)
      taskPaths = files.includes('tasks.md') ? ['tasks.md'] : []
    } else {
      const glob = trackedGlob(schema)
      if (glob === undefined) warnings.push(`Schema "${schemaName}" tracks no tasks artifact`)
      taskPaths = glob === undefined ? [] : matchOutputs(glob, files)
    }
    const taskFiles: TaskFile[] = []
    let tasksMtimeMs = 0
    for (const path of taskPaths) {
      const text = await readText($, `${base}/${path}`)
      if (text === undefined) continue
      taskFiles.push({ path, text })
      const stat = await $.fs.stat(`${base}/${path}`).catch(() => undefined)
      tasksMtimeMs = Math.max(tasksMtimeMs, stat?.mtimeMs ?? 0)
    }
    const artifacts = (schema?.artifacts ?? []).map(artifact => ({
      id: artifact.id,
      isPresent: matchOutputs(artifact.generates, files).length > 0,
    }))
    const designGlob = schema?.artifacts.find(artifact => artifact.id === 'design')?.generates ?? 'design.md'
    const designPath = matchOutputs(designGlob, files)[0]
    const design = designPath ? await readText($, `${base}/${designPath}`) : undefined
    const progress = settings.progressFile ? await readText($, `${base}/${settings.progressFile}`) : undefined
    found.push(
      buildProgress({
        name,
        schema: schemaName,
        taskFiles,
        design,
        progress,
        tasksMtimeMs,
        artifacts,
        openChanges: names,
        warnings,
        conventions: settings.conventions,
      }),
    )
  }
  return { root, changes: found.sort((a, b) => a.name.localeCompare(b.name)), notices }
}

async function refresh($: EngineInterface, settings: Settings, shouldAnnounce: boolean): Promise<void> {
  const result = await scan($, settings).catch(() => undefined)
  if (result === undefined) return
  let ticked: string[] = []
  await update($, scanState, before => {
    ticked = before.root === result.root && before.changes.length > 0 ? newlyDone(before.changes, result.changes) : []
    return result
  })
  await update($, scannedAt, () => Date.now())
  if (shouldAnnounce && ticked.length > 0) {
    const shown = ticked.slice(0, 3).join(', ')
    const more = ticked.length > 3 ? ` and ${ticked.length - 3} more` : ''
    void $.ui.toast(`✓ Done: ${shown}${more}`)
  }
}

export const register: Register = (on, options) => {
  const settings = settingsFrom(options)

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'sdd',
      description: 'Show the OpenSpec task progress pane',
    })
    await refresh($, settings, false)
    void $.ui.open({ id: PANE, title: 'SDD' })

    return next(e)
  })

  on('command.run', { command: 'sdd' }, async $ => {
    await refresh($, settings, false)
    const opened = await $.ui.open({ id: PANE, title: 'SDD' })

    return { text: opened.isPlaced ? 'SDD pane opened.' : `SDD pane not placed: ${opened.reason}` }
  })

  // Observes only: a failed refresh never blocks or changes the tool call.
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (WRITERS.has(e.tool)) await refresh($, settings, true)

    return ran
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const result = await read($, scanState)
    const now = await read($, scannedAt)
    const open = await read($, expanded)
    const hasSvg = e.surface !== 'terminal' && 'Svg' in ui
    const width = Math.max(20, (e.props.bodyColumns ?? 48) - 2)
    const pxW = Math.max(300, Math.round(width * CELL_PX))
    const marker = settings.conventions.unverified

    if (result.root === undefined) return <Text dimColor>No OpenSpec project found from the working directory.</Text>

    return (
      <Box flexDirection="column">
        {result.notices.map(notice => (
          <Text key={notice} color="warning">
            ⚠ {clip(notice, width - 2)}
          </Text>
        ))}
        {result.changes.length === 0 && <Text dimColor>No open OpenSpec changes.</Text>}
        {result.changes.map(change => {
          const isOpen = open === change.name
          const current = change.phases.find(phase => phase.title === change.currentPhase)
          const pending = current?.pending ?? []
          const ratio = ratioOf(change.done, change.total)
          const isDone = change.total > 0 && ratio >= 1
          const barWidth = Math.max(5, Math.min(30, width - 16))
          const filled = Math.round(ratio * barWidth)
          const missing = change.artifacts.filter(artifact => !artifact.isPresent).map(artifact => artifact.id)

          return (
            <Box key={change.name} flexDirection="column" marginBottom={1}>
              {hasSvg && 'Svg' in ui ? (
                <ui.Svg
                  source={card(change, pxW, marker)}
                  width={pxW}
                  height={Math.round((pxW * cardHeight(change)) / CARD_W)}
                  alt={`${change.name}: ${change.done} of ${change.total} tasks done`}
                  isInteractive
                />
              ) : (
                <Box flexDirection="column">
                  <Text bold>{change.name}</Text>
                  <Text>
                    <Text color={isDone ? 'success' : 'suggestion'}>{'█'.repeat(filled)}</Text>
                    <Text color="subtle">{'░'.repeat(barWidth - filled)}</Text>
                    <Text color={isDone ? 'success' : 'suggestion'}> {Math.round(ratio * 100)}%</Text>
                    <Text dimColor>
                      {' '}
                      {change.done}/{change.total}
                    </Text>
                  </Text>
                  {change.phases.map(phase => (
                    <Text
                      key={phase.title}
                      color={phase.done === phase.total ? 'success' : phase.isOperator ? 'warning' : undefined}
                      dimColor={phase.title !== change.currentPhase && phase.done !== phase.total}
                      bold={phase.title === change.currentPhase}
                    >
                      {clip(phaseLabel(phase), width - 10)} {phase.done}/{phase.total}
                    </Text>
                  ))}
                  <Text dimColor>
                    Agents {change.agentPending} · You {change.operatorPending}
                    {change.unverified > 0 ? ` · ${change.unverified} ${marker}` : ''}
                    {change.openQuestions.length > 0 ? ` · ${change.openQuestions.length} open Q` : ''}
                    {missing.length > 0 ? ` · missing ${missing.join(', ')}` : ''}
                    {change.schema !== 'spec-driven' ? ` · ${change.schema}` : ''}
                  </Text>
                </Box>
              )}
              {change.warnings.map(warning => (
                <Text key={warning} color="warning">
                  ⚠ {clip(warning, width - 2)}
                </Text>
              ))}
              {change.blockedBy.length > 0 && (
                <Text color="warning">⏸ Blocked by {change.blockedBy.join(', ')} (gate pending)</Text>
              )}
              {change.next !== undefined && <Text color="suggestion">▸ {clip(change.next, width - 2)}</Text>}
              <Text dimColor>
                tasks {change.tasksMtimeMs > 0 && now > 0 ? age(change.tasksMtimeMs, now) : 'n/a'}
                {settings.progressFile
                  ? change.lastProgress
                    ? ` · last: ${clip(change.lastProgress, width - 24)}`
                    : ` · no ${settings.progressFile}`
                  : ''}
              </Text>
              {pending.length > 0 && (
                <Button
                  key={`toggle-${change.name}`}
                  plain
                  onPress={() => {
                    void update($, expanded, value => (value === change.name ? '' : change.name))
                  }}
                >
                  {isOpen ? '▾ Hide pending' : `▸ Pending in current phase (${pending.length})`}
                </Button>
              )}
              {isOpen &&
                pending.slice(0, MAX_PENDING).map(task => (
                  <Text key={`${change.name}-${task.id || task.text}`} dimColor>
                    {'  '}☐ {clip(task.text, width - 4)}
                  </Text>
                ))}
              {isOpen && pending.length > MAX_PENDING && (
                <Text dimColor>
                  {'  '}… {pending.length - MAX_PENDING} more
                </Text>
              )}
            </Box>
          )
        })}
      </Box>
    )
  })
}
