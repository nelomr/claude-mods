export type Task = { id: string; text: string; isDone: boolean }

export type Phase = {
  title: string
  done: number
  total: number
  isOperator: boolean
  isGate: boolean
  pending: Task[]
}

export type ArtifactState = { id: string; isPresent: boolean }

export type ChangeProgress = {
  name: string
  schema: string
  done: number
  total: number
  operatorPending: number
  agentPending: number
  phases: Phase[]
  currentPhase: string | undefined
  next: string | undefined
  blockedBy: string[]
  lastProgress: string | undefined
  tasksMtimeMs: number
  artifacts: ArtifactState[]
  unverified: number
  openQuestions: string[]
  doneIds: string[]
  warnings: string[]
}

export type ScanResult = {
  root: string | undefined
  changes: ChangeProgress[]
  notices: string[]
}

declare module 'claude-code' {
  interface PluginState {
    'sdd-progress': { scan: ScanResult; scannedAt: number; expanded: string }
  }
}
