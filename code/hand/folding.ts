/**
 * textDocument/foldingRange handler.
 */

import type { FoldingRange } from '@/link/protocol'
import type { DocumentStore } from '@/hold/document'
import type { Surf, CardSite } from '@/mesh/form'

export function handleFoldingRanges(input: {
  docs: DocumentStore
  uri: string
}): FoldingRange[] {
  const { docs, uri } = input
  const doc = docs.get(uri)
  if (!doc || !doc.card) return []

  const ranges: FoldingRange[] = []

  // Fold top-level definitions
  for (const node of doc.card.list) {
    addFoldRange({ node, ranges })
  }

  // Fold consecutive load directives
  addLoadFolds({ nodes: doc.card.list, ranges })

  return ranges
}

function addFoldRange(input: { node: Surf; ranges: FoldingRange[] }): void {
  const { node, ranges } = input
  const site = node.site
  if (site.form !== 'card-site') return

  const s = site as CardSite
  if (s.head.line <= s.base.line) return

  ranges.push({
    startLine: s.base.line - 1,
    endLine: s.head.line - 1,
  })

  // Recurse into children that are foldable
  const foldableChildren = getFoldableChildren(node)
  for (const child of foldableChildren) {
    addFoldRange({ node: child, ranges })
  }
}

function getFoldableChildren(node: Surf): Surf[] {
  switch (node.form) {
    case 'task':
    case 'form':
    case 'mask':
    case 'suit':
    case 'wear':
    case 'test':
    case 'book': {
      const n = node as any
      return [...(n.task ?? []), ...(n.wear ?? []), ...(n.hook ?? [])]
    }
    case 'fork':
    case 'walk': {
      const n = node as any
      return n.hook ?? []
    }
    default:
      return []
  }
}

function addLoadFolds(input: { nodes: Surf[]; ranges: FoldingRange[] }): void {
  const { nodes, ranges } = input
  let loadStart: number | null = null
  let loadEnd: number | null = null

  for (const node of nodes) {
    if (node.form === 'load' && node.site.form === 'card-site') {
      const s = node.site as CardSite
      if (loadStart === null) {
        loadStart = s.base.line - 1
      }
      loadEnd = s.head.line - 1
    } else {
      if (loadStart !== null && loadEnd !== null && loadEnd > loadStart) {
        ranges.push({
          startLine: loadStart,
          endLine: loadEnd,
          kind: 'imports',
        })
      }
      loadStart = null
      loadEnd = null
    }
  }

  // Handle trailing load group
  if (loadStart !== null && loadEnd !== null && loadEnd > loadStart) {
    ranges.push({
      startLine: loadStart,
      endLine: loadEnd,
      kind: 'imports',
    })
  }
}
