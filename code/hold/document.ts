/**
 * Document manager: tracks open files and their content.
 */

import type { Range } from '@/link/protocol'
import type { SurfCard, Kink } from '@/mesh/form'

export type DocumentState = {
  file: string
  version: number
  text: string
  open: boolean
  card: SurfCard | null
  parseErrors: Kink[]
  checkErrors: Kink[]
  dirty: boolean
}

export type DocumentStore = {
  get(uri: string): DocumentState | undefined
  open(input: { uri: string; version: number; text: string }): DocumentState
  close(input: { uri: string }): void
  change(input: { uri: string; version: number; changes: Array<{ range?: Range; text: string }> }): DocumentState | undefined
  setCard(input: { uri: string; card: SurfCard; parseErrors: Kink[] }): void
  setCheckErrors(input: { uri: string; errors: Kink[] }): void
  allFiles(): DocumentState[]
  markDirty(input: { uri: string }): void
  markClean(input: { uri: string }): void
}

export function createDocumentStore(): DocumentStore {
  const docs = new Map<string, DocumentState>()

  return {
    get(uri) {
      return docs.get(uri)
    },

    open(input) {
      const doc: DocumentState = {
        file: uriToPath(input.uri),
        version: input.version,
        text: input.text,
        open: true,
        card: null,
        parseErrors: [],
        checkErrors: [],
        dirty: true,
      }
      docs.set(input.uri, doc)
      return doc
    },

    close(input) {
      const doc = docs.get(input.uri)
      if (doc) {
        doc.open = false
      }
    },

    change(input) {
      const doc = docs.get(input.uri)
      if (!doc) return undefined

      for (const change of input.changes) {
        if (change.range) {
          doc.text = applyEdit({ text: doc.text, range: change.range, newText: change.text })
        } else {
          doc.text = change.text
        }
      }

      doc.version = input.version
      doc.dirty = true
      return doc
    },

    setCard(input) {
      const doc = docs.get(input.uri)
      if (doc) {
        doc.card = input.card
        doc.parseErrors = input.parseErrors
      }
    },

    setCheckErrors(input) {
      const doc = docs.get(input.uri)
      if (doc) {
        doc.checkErrors = input.errors
      }
    },

    allFiles() {
      return [...docs.values()]
    },

    markDirty(input) {
      const doc = docs.get(input.uri)
      if (doc) doc.dirty = true
    },

    markClean(input) {
      const doc = docs.get(input.uri)
      if (doc) doc.dirty = false
    },
  }
}

/**
 * Apply an incremental text edit to a document.
 */
function applyEdit(input: { text: string; range: Range; newText: string }): string {
  const { text, range, newText } = input
  const lines = text.split('\n')

  const startOffset = lineColToOffset({ lines, line: range.start.line, col: range.start.character })
  const endOffset = lineColToOffset({ lines, line: range.end.line, col: range.end.character })

  return text.slice(0, startOffset) + newText + text.slice(endOffset)
}

function lineColToOffset(input: { lines: string[]; line: number; col: number }): number {
  const { lines, line, col } = input
  let offset = 0
  for (let i = 0; i < line && i < lines.length; i++) {
    offset += lines[i]!.length + 1
  }
  return offset + col
}

/**
 * Convert a file:// URI to a filesystem path.
 */
export function uriToPath(uri: string): string {
  if (uri.startsWith('file://')) {
    return decodeURIComponent(uri.slice(7))
  }
  return uri
}

/**
 * Convert a filesystem path to a file:// URI.
 */
export function pathToUri(filePath: string): string {
  return `file://${encodeURIComponent(filePath).replace(/%2F/g, '/')}`
}
