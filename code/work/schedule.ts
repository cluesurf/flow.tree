/**
 * Analysis scheduling: debounce and cancellation.
 */

export type AnalysisToken = {
  id: number
  aborted: boolean
  abort(): void
  check(): void
}

let tokenCounter = 0

export function createToken(): AnalysisToken {
  const token: AnalysisToken = {
    id: ++tokenCounter,
    aborted: false,
    abort() {
      token.aborted = true
    },
    check() {
      if (token.aborted) {
        throw new AnalysisCancelled()
      }
    },
  }
  return token
}

export class AnalysisCancelled extends Error {
  constructor() {
    super('Analysis cancelled')
    this.name = 'AnalysisCancelled'
  }
}

export type Scheduler = {
  scheduleImmediate(task: () => void): void
  scheduleDebounced(task: () => void): void
  cancel(): AnalysisToken
  dispose(): void
}

export function createScheduler(input: { debounceMs: number }): Scheduler {
  const { debounceMs } = input
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let currentToken: AnalysisToken | null = null

  return {
    scheduleImmediate(task) {
      // Run synchronously (parse is fast enough)
      task()
    },

    scheduleDebounced(task) {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      debounceTimer = setTimeout(() => {
        debounceTimer = null
        task()
      }, debounceMs)
    },

    cancel() {
      if (currentToken) {
        currentToken.abort()
      }
      currentToken = createToken()
      return currentToken
    },

    dispose() {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      if (currentToken) {
        currentToken.abort()
      }
    },
  }
}
