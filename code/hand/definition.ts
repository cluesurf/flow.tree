/**
 * textDocument/definition handler.
 */

import type { Location, Position } from '@/link/protocol'
import type { DocumentStore } from '@/hold/document'
import { pathToUri } from '@/hold/document'
import type { SymbolIndex } from '@/seek/index'
import { findNodeAt, getNodeName } from '@/seek/query'
import { findDefinitions } from '@/seek/query'
import type { CardSite } from '@/mesh/form'

export function handleDefinition(input: {
  docs: DocumentStore
  index: SymbolIndex
  uri: string
  position: Position
}): Location | Location[] | null {
  const { docs, index, uri, position } = input

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

  // For references, find their definition
  const defs = findDefinitions({ index, name })
  if (defs.length === 0) return null

  const locations: Location[] = defs.map(def => siteToLocation(def.site, def.file))

  return locations.length === 1 ? locations[0]! : locations
}

function siteToLocation(site: CardSite, file: string): Location {
  return {
    uri: pathToUri(file),
    range: {
      start: { line: site.base.line - 1, character: site.base.mark - 1 },
      end: { line: site.head.line - 1, character: site.head.mark - 1 },
    },
  }
}
