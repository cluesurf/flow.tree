/**
 * workspace/symbol handler.
 */

import type { Location } from '@/link/protocol'
import { SYMBOL_KIND } from '@/link/protocol'
import { pathToUri } from '@/hold/document'
import type { SymbolIndex, SymbolInfo } from '@/seek/index'
import type { CardSite } from '@/mesh/form'

export type WorkspaceSymbol = {
  name: string
  kind: number
  location: Location
  containerName?: string
}

export function handleWorkspaceSymbols(input: {
  index: SymbolIndex
  query: string
}): WorkspaceSymbol[] {
  const { index, query } = input
  const results: WorkspaceSymbol[] = []
  const lowerQuery = query.toLowerCase()

  for (const [name, defs] of index.definitions) {
    for (const def of defs) {
      if (!matchesQuery(def, lowerQuery)) continue
      if (def.site.form !== 'card-site') continue

      const site = def.site as CardSite
      results.push({
        name: def.shortName,
        kind: symbolKindToLsp(def.kind),
        location: {
          uri: pathToUri(def.file),
          range: {
            start: { line: site.base.line - 1, character: site.base.mark - 1 },
            end: { line: site.head.line - 1, character: site.head.mark - 1 },
          },
        },
        containerName: def.parent ?? undefined,
      })
    }
  }

  return results.slice(0, 200)
}

function matchesQuery(def: SymbolInfo, lowerQuery: string): boolean {
  if (!lowerQuery) return true

  const lowerName = def.shortName.toLowerCase()
  const lowerFull = def.name.toLowerCase()

  // Exact prefix match
  if (lowerName.startsWith(lowerQuery)) return true
  if (lowerFull.startsWith(lowerQuery)) return true

  // Subsequence match (fuzzy)
  let qi = 0
  for (let i = 0; i < lowerName.length && qi < lowerQuery.length; i++) {
    if (lowerName[i] === lowerQuery[qi]) qi++
  }
  if (qi === lowerQuery.length) return true

  // Segment match (kebab-case segments)
  const segments = lowerName.split('-')
  const querySegments = lowerQuery.split('-')
  if (querySegments.every(qs => segments.some(s => s.startsWith(qs)))) return true

  return false
}

function symbolKindToLsp(kind: string): number {
  switch (kind) {
    case 'task': return SYMBOL_KIND.Function
    case 'form': return SYMBOL_KIND.Class
    case 'mask': return SYMBOL_KIND.Interface
    case 'suit': return SYMBOL_KIND.Module
    case 'wear': return SYMBOL_KIND.Class
    case 'link': return SYMBOL_KIND.Field
    case 'head': return SYMBOL_KIND.TypeParameter
    case 'case': return SYMBOL_KIND.EnumMember
    case 'host': return SYMBOL_KIND.Constant
    case 'save': return SYMBOL_KIND.Variable
    case 'test': return SYMBOL_KIND.Function
    case 'book': return SYMBOL_KIND.Namespace
    case 'base': return SYMBOL_KIND.Variable
    default: return SYMBOL_KIND.Variable
  }
}
