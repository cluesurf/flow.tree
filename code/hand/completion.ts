/**
 * textDocument/completion handler.
 */

import type { CompletionItem, CompletionList, Position } from '@/link/protocol'
import { COMPLETION_ITEM_KIND } from '@/link/protocol'
import type { DocumentStore } from '@/hold/document'
import type { SymbolIndex, SymbolInfo } from '@/seek/index'
import { findFileSymbols } from '@/seek/query'

/** Keywords valid at top level. */
const TOP_LEVEL_KEYWORDS = [
  'task', 'form', 'mask', 'suit', 'wear', 'load', 'bear', 'test', 'book', 'fuse', 'tree',
]

/** Keywords valid inside a task body. */
const BODY_KEYWORDS = [
  'save', 'call', 'back', 'fork', 'walk', 'make', 'host', 'show', 'dive', 'hint', 'tell', 'kink', 'bust', 'halt', 'rest', 'meet', 'send', 'next', 'slot', 'beam',
]

/** Keywords for type positions. */
const TYPE_KEYWORDS = [
  'like', 'take', 'base', 'head', 'link', 'case',
]

export function handleCompletion(input: {
  docs: DocumentStore
  index: SymbolIndex
  uri: string
  position: Position
}): CompletionList {
  const { docs, index, uri, position } = input

  const doc = docs.get(uri)
  if (!doc) return { isIncomplete: false, items: [] }

  const items: CompletionItem[] = []
  const line = getLineAt({ text: doc.text, line: position.line })
  const prefix = line.slice(0, position.character).trim()
  const lastWord = getLastWord(prefix)

  // Determine context
  const indent = line.length - line.trimStart().length
  const isTopLevel = indent === 0

  if (isTopLevel) {
    // Top-level keyword completions
    for (const kw of TOP_LEVEL_KEYWORDS) {
      if (matchesPrefix(kw, lastWord)) {
        items.push({ label: kw, kind: COMPLETION_ITEM_KIND.Keyword })
      }
    }
  } else {
    // Body keyword completions
    for (const kw of BODY_KEYWORDS) {
      if (matchesPrefix(kw, lastWord)) {
        items.push({ label: kw, kind: COMPLETION_ITEM_KIND.Keyword })
      }
    }
    for (const kw of TYPE_KEYWORDS) {
      if (matchesPrefix(kw, lastWord)) {
        items.push({ label: kw, kind: COMPLETION_ITEM_KIND.Keyword })
      }
    }
  }

  // Context-specific completions
  const prevWord = getPrevWord(prefix)

  if (prevWord === 'call') {
    // After "call", suggest task names
    addSymbolCompletions({ items, index, kind: 'task', prefix: lastWord })
  } else if (prevWord === 'make') {
    // After "make", suggest form names
    addSymbolCompletions({ items, index, kind: 'form', prefix: lastWord })
  } else if (prevWord === 'like') {
    // After "like", suggest type names
    addSymbolCompletions({ items, index, kind: 'form', prefix: lastWord })
    addSymbolCompletions({ items, index, kind: 'mask', prefix: lastWord })
  } else if (!isTopLevel && lastWord.length > 0) {
    // General: suggest visible names
    addAllSymbolCompletions({ items, index, file: doc.file, prefix: lastWord })
  }

  return { isIncomplete: false, items }
}

function addSymbolCompletions(input: {
  items: CompletionItem[]
  index: SymbolIndex
  kind: string
  prefix: string
}): void {
  const { items, index, kind, prefix } = input
  for (const [name, defs] of index.definitions) {
    for (const def of defs) {
      if (def.kind === kind && matchesPrefix(def.shortName, prefix)) {
        items.push({
          label: def.shortName,
          kind: symbolKindToCompletionKind(def.kind),
          detail: `${def.kind} (${def.file.split('/').pop()})`,
        })
        break
      }
    }
  }
}

function addAllSymbolCompletions(input: {
  items: CompletionItem[]
  index: SymbolIndex
  file: string
  prefix: string
}): void {
  const { items, index, file, prefix } = input

  // File-local symbols first
  const local = findFileSymbols({ index, file })
  for (const sym of local) {
    if (matchesPrefix(sym.shortName, prefix)) {
      items.push({
        label: sym.shortName,
        kind: symbolKindToCompletionKind(sym.kind),
        detail: sym.kind,
        sortText: `0${sym.shortName}`,
      })
    }
  }

  // Global symbols
  for (const [name, defs] of index.definitions) {
    for (const def of defs) {
      if (def.file !== file && matchesPrefix(def.shortName, prefix)) {
        items.push({
          label: def.shortName,
          kind: symbolKindToCompletionKind(def.kind),
          detail: `${def.kind} (${def.file.split('/').pop()})`,
          sortText: `1${def.shortName}`,
        })
        break
      }
    }
  }
}

function symbolKindToCompletionKind(kind: string): number {
  switch (kind) {
    case 'task': return COMPLETION_ITEM_KIND.Function
    case 'form': return COMPLETION_ITEM_KIND.Class
    case 'mask': return COMPLETION_ITEM_KIND.Interface
    case 'suit': return COMPLETION_ITEM_KIND.Module
    case 'wear': return COMPLETION_ITEM_KIND.Class
    case 'link': return COMPLETION_ITEM_KIND.Field
    case 'head': return COMPLETION_ITEM_KIND.TypeParameter
    case 'case': return COMPLETION_ITEM_KIND.EnumMember
    case 'host': return COMPLETION_ITEM_KIND.Constant
    case 'save': return COMPLETION_ITEM_KIND.Variable
    case 'test': return COMPLETION_ITEM_KIND.Function
    case 'book': return COMPLETION_ITEM_KIND.Module
    case 'base': return COMPLETION_ITEM_KIND.Variable
    default: return COMPLETION_ITEM_KIND.Text
  }
}

function matchesPrefix(name: string, prefix: string): boolean {
  if (!prefix) return true
  return name.toLowerCase().startsWith(prefix.toLowerCase())
}

function getLineAt(input: { text: string; line: number }): string {
  const lines = input.text.split('\n')
  return lines[input.line] ?? ''
}

function getLastWord(text: string): string {
  const match = text.match(/[\w-]+$/)
  return match ? match[0]! : ''
}

function getPrevWord(text: string): string {
  const stripped = text.replace(/[\w-]+$/, '').trimEnd()
  const match = stripped.match(/[\w-]+$/)
  return match ? match[0]! : ''
}
