/**
 * textDocument/rename and textDocument/prepareRename handlers.
 */

import type { Range, Location, WorkspaceEdit, TextEdit } from '@/link/protocol'
import type { DocumentStore } from '@/hold/document'
import { pathToUri } from '@/hold/document'
import type { SymbolIndex } from '@/seek/index'
import { findNodeAt, getNodeName } from '@/seek/query'
import { findReferences, findDefinitions } from '@/seek/query'
import type { CardSite } from '@/mesh/form'

const RENAMEABLE_FORMS = new Set([
  'task', 'form', 'mask', 'suit', 'wear', 'test', 'book',
  'link', 'head', 'base', 'case',
  'call', 'make', 'sift-link', 'sift-read',
  'save', 'host', 'bind', 'find', 'slot',
])

export function handlePrepareRename(input: {
  docs: DocumentStore
  index: SymbolIndex
  uri: string
  position: { line: number; character: number }
}): Range | null {
  const { docs, index, uri, position } = input

  const doc = docs.get(uri)
  if (!doc || !doc.card) return null

  const node = findNodeAt({
    card: doc.card,
    line: position.line + 1,
    col: position.character + 1,
  })
  if (!node) return null
  if (!RENAMEABLE_FORMS.has(node.form)) return null

  const name = getNodeName({ node })
  if (!name) return null

  if (node.site.form !== 'card-site') return null
  const site = node.site as CardSite

  return {
    start: { line: site.base.line - 1, character: site.base.mark - 1 },
    end: { line: site.head.line - 1, character: site.head.mark - 1 },
  }
}

export function handleRename(input: {
  docs: DocumentStore
  index: SymbolIndex
  uri: string
  position: { line: number; character: number }
  newName: string
}): WorkspaceEdit | null {
  const { docs, index, uri, position, newName } = input

  const doc = docs.get(uri)
  if (!doc || !doc.card) return null

  const node = findNodeAt({
    card: doc.card,
    line: position.line + 1,
    col: position.character + 1,
  })
  if (!node) return null

  const name = getNodeName({ node })
  if (!name) return null

  if (!isValidIdentifier(newName)) return null

  const changes: Record<string, TextEdit[]> = {}

  function addEdit(site: CardSite, file: string): void {
    const fileUri = pathToUri(file)
    if (!changes[fileUri]) {
      changes[fileUri] = []
    }
    changes[fileUri].push({
      range: {
        start: { line: site.base.line - 1, character: site.base.mark - 1 },
        end: { line: site.head.line - 1, character: site.head.mark - 1 },
      },
      newText: newName,
    })
  }

  // Collect all definition sites
  const defs = findDefinitions({ index, name })
  for (const def of defs) {
    if (def.site.form === 'card-site') {
      addEdit(def.site as CardSite, def.file)
    }
  }

  // Collect all reference sites
  const refs = findReferences({ index, name })
  for (const ref of refs) {
    if (ref.site.form === 'card-site') {
      addEdit(ref.site as CardSite, ref.file)
    }
  }

  if (Object.keys(changes).length === 0) return null

  return { changes }
}

function isValidIdentifier(name: string): boolean {
  return /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)
}
