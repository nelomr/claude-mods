import type { ArtifactState, ChangeProgress, Phase, Task } from '../types'

// The task line OpenSpec itself counts (dist/utils/task-progress.js, 1.14.x): any
// CommonMark list marker, a checkbox holding at most one marker, and only x/X done.
const TASK_LINE = /^\s*(?:[-*+]|\d{1,9}[.)])\s*\[(?:\s*([^\]\s]?)\s*\](?![([])|\s+\])\s*(.*)/
const TASK_ID = /^(\d+(?:\.\d+)*[a-z]?)\b/
const PHASE = /^##\s+(.*)$/
const BULLET = /^(?:[-*+]|\d{1,9}[.)])\s+(.*)$/
const RESOLVED = /^(?:~~|\*\*)?\s*(?:resolved|answered|closed|done)\b/i

export type Conventions = {
  operator: RegExp
  gate: RegExp
  unverified: string
}

export const DEFAULT_CONVENTIONS: Conventions = {
  operator: /runbook|\(operator\b|operator-only tasks|agents never run/i,
  gate: /mandatory gate|^0\.\s*gates?\b/i,
  unverified: 'UNVERIFIED',
}

export type SchemaInfo = {
  name: string
  artifacts: { id: string; generates: string }[]
  tracks: string | undefined
}

// Built-in `spec-driven` schema of OpenSpec 1.14.x, used when its schema.yaml cannot be read.
export const SPEC_DRIVEN: SchemaInfo = {
  name: 'spec-driven',
  artifacts: [
    { id: 'proposal', generates: 'proposal.md' },
    { id: 'specs', generates: 'specs/**/*.md' },
    { id: 'design', generates: 'design.md' },
    { id: 'tasks', generates: 'tasks.md' },
  ],
  tracks: 'tasks.md',
}

export type TaskFile = { path: string; text: string }

export type Sources = {
  name: string
  schema: string
  taskFiles: TaskFile[]
  design: string | undefined
  progress: string | undefined
  tasksMtimeMs: number
  artifacts: ArtifactState[]
  openChanges: string[]
  warnings: string[]
  conventions: Conventions
}

function unquote(value: string): string {
  const trimmed = value.replace(/\s+#.*$/, '').trim()
  const quoted = /^(['"])(.*)\1$/.exec(trimmed)
  return quoted ? (quoted[2] ?? '') : trimmed
}

// Top-level `key: value` of a YAML file (config.yaml, .openspec.yaml).
export function yamlScalar(yaml: string, key: string): string | undefined {
  for (const line of yaml.split(/\r?\n/)) {
    const match = new RegExp(`^${key}:\\s*(.+)$`).exec(line)
    if (match) return unquote(match[1] ?? '') || undefined
  }
  return undefined
}

// The two parts of an OpenSpec schema.yaml the pane needs: artifacts (id, generates) and apply.tracks.
export function parseSchema(name: string, yaml: string): SchemaInfo {
  const artifacts: { id: string; generates: string }[] = []
  let tracks: string | undefined
  let block = ''
  let current: { id?: string; generates?: string } | undefined
  const flush = () => {
    if (current?.id && current.generates) artifacts.push({ id: current.id, generates: current.generates })
    current = undefined
  }
  for (const line of yaml.split(/\r?\n/)) {
    const top = /^([A-Za-z_][\w-]*):/.exec(line)
    if (top) {
      flush()
      block = top[1] ?? ''
      continue
    }
    if (block === 'artifacts') {
      const item = /^\s*-\s+id:\s*(.+)$/.exec(line)
      if (item) {
        flush()
        current = { id: unquote(item[1] ?? '') }
        continue
      }
      const generates = /^\s+generates:\s*(.+)$/.exec(line)
      if (generates && current) current.generates = unquote(generates[1] ?? '')
    }
    if (block === 'apply') {
      const tracked = /^\s+tracks:\s*(.+)$/.exec(line)
      if (tracked) tracks = unquote(tracked[1] ?? '') || undefined
    }
  }
  flush()
  return { name, artifacts, tracks }
}

// The artifact apply works through: generates equal to apply.tracks, else id `tasks` (OpenSpec's rule).
export function trackedGlob(schema: SchemaInfo): string | undefined {
  if (schema.tracks !== undefined) return schema.artifacts.find(a => a.generates === schema.tracks)?.generates
  return schema.artifacts.find(a => a.id === 'tasks')?.generates
}

export function isGlob(pattern: string): boolean {
  return /[*?{[]/.test(pattern)
}

function expandBraces(pattern: string): string[] {
  const match = /\{([^{}]*)\}/.exec(pattern)
  if (!match) return [pattern]
  const head = pattern.slice(0, match.index)
  const tail = pattern.slice(match.index + match[0].length)
  return (match[1] ?? '').split(',').flatMap(part => expandBraces(`${head}${part}${tail}`))
}

// Glob to RegExp over posix paths relative to the change folder: **, *, ?, {a,b}; dotfiles excluded.
export function globMatcher(pattern: string): (path: string) => boolean {
  const regexes = expandBraces(pattern.replace(/^\.\//, '').replace(/\/+/g, '/')).map(one => {
    let source = ''
    for (let i = 0; i < one.length; i += 1) {
      const char = one[i] ?? ''
      if (char === '*' && one[i + 1] === '*') {
        const slash = one[i + 2] === '/'
        source += slash ? '(?:[^/.][^/]*/)*' : '(?:[^/.][^/]*(?:/[^/.][^/]*)*)?'
        i += slash ? 2 : 1
      } else if (char === '*') source += '(?:[^/.][^/]*)?'
      else if (char === '?') source += '[^/]'
      else source += char.replace(/[.+^$()|[\]\\]/g, '\\$&')
    }
    return new RegExp(`^${source}$`)
  })
  return path => regexes.some(regex => regex.test(path))
}

// Files of a change that match an artifact's `generates`, from one listing of the change folder.
export function matchOutputs(generates: string, files: string[]): string[] {
  if (!isGlob(generates)) {
    const literal = generates.replace(/^\.\//, '')
    return files.includes(literal) ? [literal] : []
  }
  const matches = globMatcher(generates)
  return files.filter(matches).sort()
}

export function parsePhases(files: TaskFile[], conventions: Conventions): Phase[] {
  const phases: Phase[] = []
  const many = files.length > 1
  for (const file of files) {
    let current: Phase | undefined
    for (const line of file.text.split(/\r?\n/)) {
      const heading = PHASE.exec(line)
      if (heading) {
        const title = (heading[1] ?? '').trim()
        current = {
          title: many ? `${file.path} · ${title}` : title,
          done: 0,
          total: 0,
          isOperator: conventions.operator.test(title),
          isGate: conventions.gate.test(title),
          pending: [],
        }
        phases.push(current)
        continue
      }
      const match = TASK_LINE.exec(line)
      if (!match) continue
      if (!current) {
        current = { title: many ? file.path : 'Tasks', done: 0, total: 0, isOperator: false, isGate: false, pending: [] }
        phases.push(current)
      }
      const text = (match[2] ?? '').trim()
      const task: Task = { id: TASK_ID.exec(text)?.[1] ?? '', text, isDone: (match[1] ?? '').toLowerCase() === 'x' }
      current.total += 1
      if (task.isDone) current.done += 1
      else current.pending.push(task)
    }
  }
  return phases.filter(phase => phase.total > 0)
}

// Keys of done tasks: the task id when it has one, else its text, so any layout can be diffed.
export function doneKeys(files: TaskFile[]): string[] {
  const keys: string[] = []
  for (const file of files) {
    for (const line of file.text.split(/\r?\n/)) {
      const match = TASK_LINE.exec(line)
      if (!match || (match[1] ?? '').toLowerCase() !== 'x') continue
      const text = (match[2] ?? '').trim()
      keys.push(TASK_ID.exec(text)?.[1] ?? text)
    }
  }
  return keys
}

// Items under an "Open Questions" heading not marked resolved (the spec-driven design template).
// When the section numbers its questions (`O1.`, `Q2:`), only numbered items count, so notes and
// decision lists kept in the same section are not read as questions; otherwise every bullet counts.
export function openQuestions(design: string): string[] {
  const items: { id: string | undefined; rest: string }[] = []
  let level = 0
  for (const line of design.split(/\r?\n/)) {
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      const depth = (heading[1] ?? '').length
      if (/open questions/i.test(heading[2] ?? '')) level = depth
      else if (level > 0 && depth <= level) level = 0
      continue
    }
    if (level === 0) continue
    const item = BULLET.exec(line)
    if (!item) continue
    const body = (item[1] ?? '').trim()
    const id = /^(?:\*\*)?([A-Z]+\d+)[.:)]/.exec(body)?.[1]
    const rest = id ? body.replace(/^(?:\*\*)?[A-Z]+\d+[.:)](?:\*\*)?\s*/, '') : body
    items.push({ id, rest })
  }
  const isNumbered = items.some(item => item.id !== undefined)
  return items
    .filter(item => !isNumbered || item.id !== undefined)
    .filter(item => !/^none\b/i.test(item.rest) && !RESOLVED.test(item.rest))
    .map(item => item.id ?? (item.rest.length > 40 ? `${item.rest.slice(0, 39)}…` : item.rest))
}

export function lastHeading(markdown: string): string | undefined {
  const headings = markdown.split(/\r?\n/).filter(line => /^##\s/.test(line))
  return headings.at(-1)?.replace(/^##\s+/, '').trim()
}

// Another open change named in a gate phase that still has pending tasks.
export function blockedBy(phases: Phase[], self: string, openChanges: string[]): string[] {
  const blockers = new Set<string>()
  for (const phase of phases) {
    if (!phase.isGate || phase.pending.length === 0) continue
    const text = [phase.title, ...phase.pending.map(task => task.text)].join('\n')
    for (const other of openChanges) {
      if (other !== self && text.includes(other)) blockers.add(other)
    }
  }
  return [...blockers]
}

export function buildProgress(sources: Sources): ChangeProgress {
  const phases = parsePhases(sources.taskFiles, sources.conventions)
  let done = 0
  let total = 0
  let operatorPending = 0
  let agentPending = 0
  for (const phase of phases) {
    done += phase.done
    total += phase.total
    if (phase.isOperator) operatorPending += phase.pending.length
    else agentPending += phase.pending.length
  }
  const current = phases.find(phase => !phase.isOperator && phase.pending.length > 0)
  const marker = sources.conventions.unverified
  return {
    name: sources.name,
    schema: sources.schema,
    done,
    total,
    operatorPending,
    agentPending,
    phases,
    currentPhase: current?.title,
    next: current?.pending[0]?.text,
    blockedBy: blockedBy(phases, sources.name, sources.openChanges),
    lastProgress: sources.progress ? lastHeading(sources.progress) : undefined,
    tasksMtimeMs: sources.tasksMtimeMs,
    artifacts: sources.artifacts,
    unverified: marker && sources.design ? sources.design.split(marker).length - 1 : 0,
    openQuestions: sources.design ? openQuestions(sources.design) : [],
    doneIds: doneKeys(sources.taskFiles),
    warnings: sources.warnings,
  }
}

export function newlyDone(before: ChangeProgress[], after: ChangeProgress[]): string[] {
  const known = new Map(before.map(change => [change.name, new Set(change.doneIds)]))
  const lines: string[] = []
  for (const change of after) {
    const seen = known.get(change.name)
    if (!seen) continue
    for (const key of change.doneIds) {
      if (!seen.has(key)) lines.push(`${change.name} ${key.length > 40 ? `${key.slice(0, 39)}…` : key}`)
    }
  }
  return lines
}

export function age(fromMs: number, nowMs: number): string {
  const minutes = Math.max(0, Math.round((nowMs - fromMs) / 60000))
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

// A user pattern from the plugin options, or the default when it is empty or not a valid RegExp.
export function patternOption(value: unknown, fallback: RegExp): RegExp {
  if (typeof value !== 'string' || value.trim() === '') return fallback
  try {
    return new RegExp(value, 'i')
  } catch {
    return fallback
  }
}
