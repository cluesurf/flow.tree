/**
 * textDocument/inlayHint handler.
 *
 * Shows inferred type hints on variables and parameters
 * that lack explicit type annotations.
 */

import type { Range, Position } from '@/link/protocol'
import type { DocumentStore } from '@/hold/document'
import type { SymbolIndex } from '@/seek/index'
import type { Surf, SurfTask, SurfForm, SurfSave, SurfHost, SurfBase, SurfType, CardSite } from '@/mesh/form'

export type InlayHintKind = 1 | 2

export type InlayHint = {
  position: Position
  label: string
  kind?: InlayHintKind
  paddingLeft?: boolean
  paddingRight?: boolean
}

const HINT_KIND = {
  Type: 1 as InlayHintKind,
  Parameter: 2 as InlayHintKind,
}

/**
 * Cache for benchmark results, populated via `seed/timeResults` notification.
 */
export const benchmarkCache = new Map<string, { mean_ns: number; median_ns: number }>()

export function updateBenchmarkCache(input: {
  results: Array<{ name: string; mean_ns: number; median_ns: number }>
}): void {
  for (const r of input.results) {
    benchmarkCache.set(r.name, { mean_ns: r.mean_ns, median_ns: r.median_ns })
  }
}

function formatNs(ns: number): string {
  if (ns < 1000) return `${ns.toFixed(1)}ns`
  if (ns < 1_000_000) return `${(ns / 1000).toFixed(1)}us`
  if (ns < 1_000_000_000) return `${(ns / 1_000_000).toFixed(1)}ms`
  return `${(ns / 1_000_000_000).toFixed(2)}s`
}

export function handleInlayHints(input: {
  docs: DocumentStore
  index: SymbolIndex
  uri: string
  range: Range
}): InlayHint[] {
  const { docs, uri, range } = input

  const doc = docs.get(uri)
  if (!doc || !doc.card) return []

  const hints: InlayHint[] = []

  for (const node of doc.card.list) {
    collectHints({ node, hints, range })
  }

  return hints
}

function collectHints(input: { node: Surf; hints: InlayHint[]; range: Range }): void {
  const { node, hints, range } = input

  if (node.site.form !== 'card-site') return
  const site = node.site as CardSite

  // Skip nodes outside requested range
  if (site.head.line - 1 < range.start.line) return
  if (site.base.line - 1 > range.end.line) return

  switch (node.form) {
    case 'task': {
      const task = node as SurfTask
      // Show parameter type hints for params without annotations
      for (const b of task.base ?? []) {
        if (!b.like && b.site.form === 'card-site') {
          const bSite = b.site as CardSite
          hints.push({
            position: { line: bSite.head.line - 1, character: bSite.head.mark - 1 },
            label: ': ?',
            kind: HINT_KIND.Type,
            paddingLeft: true,
          })
        }
      }
      // Recurse
      for (const f of task.flow ?? []) collectHints({ node: f, hints, range })
      for (const t of task.task ?? []) collectHints({ node: t, hints, range })
      break
    }
    case 'form': {
      const form = node as SurfForm
      for (const t of form.task ?? []) collectHints({ node: t, hints, range })
      break
    }
    case 'save': {
      const save = node as SurfSave
      // Show type hint after variable name
      if (save.site.form === 'card-site') {
        const sSite = save.site as CardSite
        const name = save.path?.[0]
        if (name) {
          hints.push({
            position: { line: sSite.base.line - 1, character: sSite.base.mark - 1 + 5 + name.length },
            label: ': ?',
            kind: HINT_KIND.Type,
            paddingLeft: true,
          })
        }
      }
      if (save.sift) collectHints({ node: save.sift, hints, range })
      break
    }
    case 'call': {
      const call = node as any
      // Show parameter name hints on bind arguments
      for (const b of call.bind ?? []) {
        if (b.name && b.site.form === 'card-site') {
          const bSite = b.site as CardSite
          hints.push({
            position: { line: bSite.base.line - 1, character: bSite.base.mark - 1 },
            label: `${b.name}:`,
            kind: HINT_KIND.Parameter,
            paddingRight: true,
          })
        }
      }
      break
    }
    case 'fork':
    case 'walk': {
      const n = node as any
      if (n.sift) collectHints({ node: n.sift, hints, range })
      for (const h of n.hook ?? []) collectHints({ node: h, hints, range })
      break
    }
    case 'hook': {
      const n = node as any
      for (const f of n.flow ?? []) collectHints({ node: f, hints, range })
      break
    }
    case 'time': {
      // Show cached benchmark result if available
      const n = node as any
      const cached = benchmarkCache.get(n.name)
      if (cached) {
        hints.push({
          position: { line: site.base.line - 1, character: site.head.mark },
          label: `${formatNs(cached.mean_ns)} mean`,
          kind: HINT_KIND.Type,
          paddingLeft: true,
        })
      }
      break
    }
    case 'meet': {
      const n = node as any
      for (const item of n.list ?? []) collectHints({ node: item, hints, range })
      break
    }
    case 'beam': {
      const n = node as any
      for (const f of n.flow ?? []) collectHints({ node: f, hints, range })
      break
    }
  }
}
