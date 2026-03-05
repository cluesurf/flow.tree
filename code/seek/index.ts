/**
 * Symbol index: fast lookup for definitions, references, and scopes.
 */

import type { CardSite } from '@/mesh/form'

export type SymbolKindTag =
  | 'task'
  | 'form'
  | 'mask'
  | 'suit'
  | 'wear'
  | 'link'
  | 'head'
  | 'case'
  | 'host'
  | 'save'
  | 'test'
  | 'book'
  | 'base'

export type SymbolInfo = {
  name: string
  shortName: string
  kind: SymbolKindTag
  site: CardSite
  file: string
  parent: string | null
  exported: boolean
  doc: string | null
}

export type RefKindTag = 'call' | 'type' | 'make' | 'load' | 'read' | 'write'

export type SymbolRef = {
  name: string
  site: CardSite
  file: string
  kind: RefKindTag
}

export type SymbolIndex = {
  definitions: Map<string, SymbolInfo[]>
  references: Map<string, SymbolRef[]>
  fileSymbols: Map<string, SymbolInfo[]>
  fileRefs: Map<string, SymbolRef[]>
}

export function createIndex(): SymbolIndex {
  return {
    definitions: new Map(),
    references: new Map(),
    fileSymbols: new Map(),
    fileRefs: new Map(),
  }
}

/**
 * Clear all index entries for a given file, in preparation for re-indexing.
 */
export function clearFile(input: { index: SymbolIndex; file: string }): void {
  const { index, file } = input

  // Remove file symbols from definitions map
  const oldSymbols = index.fileSymbols.get(file)
  if (oldSymbols) {
    for (const sym of oldSymbols) {
      const defs = index.definitions.get(sym.name)
      if (defs) {
        const filtered = defs.filter(d => d.file !== file)
        if (filtered.length === 0) {
          index.definitions.delete(sym.name)
        } else {
          index.definitions.set(sym.name, filtered)
        }
      }
    }
  }
  index.fileSymbols.delete(file)

  // Remove file refs from references map
  const oldRefs = index.fileRefs.get(file)
  if (oldRefs) {
    for (const ref of oldRefs) {
      const refs = index.references.get(ref.name)
      if (refs) {
        const filtered = refs.filter(r => r.file !== file)
        if (filtered.length === 0) {
          index.references.delete(ref.name)
        } else {
          index.references.set(ref.name, filtered)
        }
      }
    }
  }
  index.fileRefs.delete(file)
}

/**
 * Add a symbol definition to the index.
 */
export function addDefinition(input: { index: SymbolIndex; symbol: SymbolInfo }): void {
  const { index, symbol } = input

  if (!index.definitions.has(symbol.name)) {
    index.definitions.set(symbol.name, [])
  }
  index.definitions.get(symbol.name)!.push(symbol)

  if (!index.fileSymbols.has(symbol.file)) {
    index.fileSymbols.set(symbol.file, [])
  }
  index.fileSymbols.get(symbol.file)!.push(symbol)
}

/**
 * Add a symbol reference to the index.
 */
export function addReference(input: { index: SymbolIndex; ref: SymbolRef }): void {
  const { index, ref } = input

  if (!index.references.has(ref.name)) {
    index.references.set(ref.name, [])
  }
  index.references.get(ref.name)!.push(ref)

  if (!index.fileRefs.has(ref.file)) {
    index.fileRefs.set(ref.file, [])
  }
  index.fileRefs.get(ref.file)!.push(ref)
}
