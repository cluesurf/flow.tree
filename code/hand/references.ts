/**
 * textDocument/references handler.
 */

import type { Location, Position } from '@/link/protocol'
import type { DocumentStore } from '@/hold/document'
import { pathToUri } from '@/hold/document'
import type { SymbolIndex } from '@/seek/index'
import { findNodeAt, getNodeName } from '@/seek/query'
import { findReferences, findDefinitions } from '@/seek/query'
import type { CardSite } from '@/mesh/form'

export function handleReferences(input: {
  docs: DocumentStore
  index: SymbolIndex
  uri: string
  position: Position
  includeDeclaration: boolean
}): Location[] {
  const { docs, index, uri, position, includeDeclaration } = input

  const doc = docs.get(uri)
  if (!doc || !doc.card) return []

  const node = findNodeAt({
    card: doc.card,
    line: position.line + 1,
    col: position.character + 1,
  })
  if (!node) return []

  const name = getNodeName({ node })
  if (!name) return []

  const locations: Location[] = []

  // Add references
  const refs = findReferences({ index, name })
  for (const ref of refs) {
    locations.push(siteToLocation(ref.site, ref.file))
  }

  // Add definition sites
  if (includeDeclaration) {
    const defs = findDefinitions({ index, name })
    for (const def of defs) {
      locations.push(siteToLocation(def.site, def.file))
    }
  }

  return locations
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
