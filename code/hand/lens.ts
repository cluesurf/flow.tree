/**
 * textDocument/codeLens handler.
 *
 * Shows reference counts above definitions and
 * "run test" above test blocks.
 */

import type { Range } from '@/link/protocol'
import type { DocumentStore } from '@/hold/document'
import type { SymbolIndex } from '@/seek/index'
import { findReferences } from '@/seek/query'
import type { Surf, CardSite } from '@/mesh/form'

export type CodeLens = {
  range: Range
  command?: {
    title: string
    command: string
    arguments?: any[]
  }
}

export function handleCodeLens(input: {
  docs: DocumentStore
  index: SymbolIndex
  uri: string
}): CodeLens[] {
  const { docs, index, uri } = input

  const doc = docs.get(uri)
  if (!doc || !doc.card) return []

  const lenses: CodeLens[] = []

  for (const node of doc.card.list) {
    collectLenses({ node, lenses, index, uri })
  }

  return lenses
}

function collectLenses(input: { node: Surf; lenses: CodeLens[]; index: SymbolIndex; uri: string }): void {
  const { node, lenses, index, uri } = input
  if (node.site.form !== 'card-site') return

  const site = node.site as CardSite
  const range: Range = {
    start: { line: site.base.line - 1, character: site.base.mark - 1 },
    end: { line: site.base.line - 1, character: site.head.mark - 1 },
  }

  switch (node.form) {
    case 'task':
    case 'form':
    case 'mask':
    case 'suit': {
      const n = node as any
      const name = n.name
      if (!name) break

      const refs = findReferences({ index, name })
      const count = refs.length
      const label = count === 1 ? '1 reference' : `${count} references`

      lenses.push({
        range,
        command: {
          title: label,
          command: 'editor.action.findReferences',
          arguments: [uri, { line: site.base.line - 1, character: site.base.mark - 1 }],
        },
      })

      // Recurse into nested tasks
      if (node.form === 'task' || node.form === 'form') {
        for (const t of n.task ?? []) {
          collectLenses({ node: t, lenses, index, uri })
        }
      }
      if (node.form === 'mask') {
        for (const t of n.task ?? []) {
          collectLenses({ node: t, lenses, index, uri })
        }
      }
      break
    }
    case 'test': {
      const n = node as any
      lenses.push({
        range,
        command: {
          title: 'run test',
          command: 'seed.runTest',
          arguments: [n.name],
        },
      })
      break
    }
    case 'time': {
      const n = node as any
      lenses.push({
        range,
        command: {
          title: 'run time',
          command: 'seed.runTime',
          arguments: [n.name],
        },
      })
      lenses.push({
        range,
        command: {
          title: 'profile',
          command: 'seed.profileTime',
          arguments: [n.name],
        },
      })
      break
    }
    case 'wear': {
      const n = node as any
      for (const t of n.task ?? []) {
        collectLenses({ node: t, lenses, index, uri })
      }
      break
    }
  }
}
