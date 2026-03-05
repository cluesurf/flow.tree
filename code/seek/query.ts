/**
 * Symbol index query functions.
 */

import type { SymbolIndex, SymbolInfo, SymbolRef } from '@/seek/index'
import type { Surf, SurfCard, CardSite } from '@/mesh/form'

/**
 * Find symbol definitions by name.
 */
export function findDefinitions(input: { index: SymbolIndex; name: string }): SymbolInfo[] {
  return input.index.definitions.get(input.name) ?? []
}

/**
 * Find all references to a symbol by name.
 */
export function findReferences(input: { index: SymbolIndex; name: string }): SymbolRef[] {
  return input.index.references.get(input.name) ?? []
}

/**
 * Find all symbols defined in a file.
 */
export function findFileSymbols(input: { index: SymbolIndex; file: string }): SymbolInfo[] {
  return input.index.fileSymbols.get(input.file) ?? []
}

/**
 * Find the Surf node at a given position in a SurfCard.
 */
export function findNodeAt(input: { card: SurfCard; line: number; col: number }): Surf | null {
  let best: Surf | null = null

  function check(node: Surf): void {
    if (!containsPosition({ site: node.site, line: input.line, col: input.col })) return
    best = node

    // Recurse into children to find tightest match
    const children = getChildren(node)
    for (const child of children) {
      check(child)
    }
  }

  for (const node of input.card.list) {
    check(node)
  }

  return best
}

/**
 * Extract the name from a Surf node (if it has one).
 */
export function getNodeName(input: { node: Surf }): string | null {
  const node = input.node
  switch (node.form) {
    case 'task':
    case 'form':
    case 'mask':
    case 'suit':
    case 'wear':
    case 'test':
    case 'book':
    case 'host':
    case 'call':
    case 'make':
    case 'slot':
      return (node as any).name ?? null
    case 'save':
      return (node as any).path?.[0] ?? null
    case 'sift-link':
    case 'sift-read':
      return (node as any).path?.[0] ?? null
    case 'link':
    case 'head':
    case 'base':
    case 'find':
      return (node as any).name ?? null
    default:
      return null
  }
}

/**
 * Check if a position falls within a Site.
 */
function containsPosition(input: { site: { form: string }; line: number; col: number }): boolean {
  const { site, line, col } = input
  if (site.form !== 'card-site') return false

  const s = site as CardSite
  if (line < s.base.line || line > s.head.line) return false
  if (line === s.base.line && col < s.base.mark) return false
  if (line === s.head.line && col > s.head.mark) return false
  return true
}

/**
 * Get direct children of a Surf node.
 */
function getChildren(node: Surf): Surf[] {
  const children: Surf[] = []

  switch (node.form) {
    case 'task': {
      const n = node as any
      children.push(...(n.head ?? []), ...(n.base ?? []), ...(n.flow ?? []), ...(n.task ?? []))
      break
    }
    case 'form': {
      const n = node as any
      children.push(...(n.head ?? []), ...(n.link ?? []), ...(n.case ?? []), ...(n.bond ?? []), ...(n.task ?? []), ...(n.wear ?? []))
      if (n.hold) children.push(...n.hold)
      break
    }
    case 'mask': {
      const n = node as any
      children.push(...(n.task ?? []))
      break
    }
    case 'suit': {
      const n = node as any
      children.push(...(n.wear ?? []))
      break
    }
    case 'wear': {
      const n = node as any
      children.push(...(n.task ?? []))
      break
    }
    case 'test': {
      const n = node as any
      children.push(...(n.flow ?? []))
      break
    }
    case 'book': {
      const n = node as any
      children.push(...(n.list ?? []))
      break
    }
    case 'call': {
      const n = node as any
      children.push(...(n.bind ?? []))
      for (const h of Object.values(n.hook ?? {})) {
        children.push(h as Surf)
      }
      break
    }
    case 'fork':
    case 'walk': {
      const n = node as any
      if (n.sift) children.push(n.sift)
      children.push(...(n.hook ?? []))
      break
    }
    case 'hook': {
      const n = node as any
      children.push(...(n.base ?? []), ...(n.flow ?? []))
      break
    }
    case 'save':
    case 'host': {
      const n = node as any
      if (n.sift) children.push(n.sift)
      if (n.list) children.push(...n.list)
      break
    }
    case 'make': {
      const n = node as any
      children.push(...(n.bind ?? []))
      break
    }
    case 'bind': {
      const n = node as any
      if (n.sift) children.push(n.sift)
      break
    }
    case 'load': {
      const n = node as any
      children.push(...(n.find ?? []), ...(n.hook ?? []))
      break
    }
    case 'meet': {
      const n = node as any
      children.push(...(n.list ?? []))
      break
    }
    case 'beam': {
      const n = node as any
      children.push(...(n.flow ?? []))
      break
    }
    case 'back':
    case 'show':
    case 'dive':
    case 'hint-log':
    case 'tell':
    case 'kink-log':
    case 'bust': {
      const n = node as any
      if (n.sift) children.push(n.sift)
      break
    }
  }

  return children
}
