/**
 * textDocument/documentSymbol handler.
 */

import type { DocumentSymbol } from '@/link/protocol'
import { SYMBOL_KIND } from '@/link/protocol'
import type { DocumentStore } from '@/hold/document'
import type { Surf, SurfTask, SurfForm, SurfMask, SurfSuit, SurfWear, SurfTest, SurfBook, CardSite } from '@/mesh/form'

export function handleDocumentSymbols(input: {
  docs: DocumentStore
  uri: string
}): DocumentSymbol[] {
  const { docs, uri } = input
  const doc = docs.get(uri)
  if (!doc || !doc.card) return []

  const symbols: DocumentSymbol[] = []
  for (const node of doc.card.list) {
    const sym = surfToSymbol(node)
    if (sym) symbols.push(sym)
  }
  return symbols
}

function surfToSymbol(node: Surf): DocumentSymbol | null {
  switch (node.form) {
    case 'task':
      return taskToSymbol(node as SurfTask)
    case 'form':
      return formToSymbol(node as SurfForm)
    case 'mask':
      return maskToSymbol(node as SurfMask)
    case 'suit':
      return suitToSymbol(node as SurfSuit)
    case 'wear':
      return wearToSymbol(node as SurfWear)
    case 'test':
      return testToSymbol(node as SurfTest)
    case 'book':
      return bookToSymbol(node as SurfBook)
    default:
      return null
  }
}

function taskToSymbol(node: SurfTask): DocumentSymbol | null {
  const range = siteToRange(node.site)
  if (!range) return null

  const children: DocumentSymbol[] = []
  for (const t of node.task) {
    const s = surfToSymbol(t)
    if (s) children.push(s)
  }

  const params = node.base.map(b => b.name).join(', ')
  const detail = params ? `(${params})` : undefined

  return {
    name: node.name,
    detail,
    kind: SYMBOL_KIND.Function,
    range: range.full,
    selectionRange: range.name,
    children: children.length > 0 ? children : undefined,
  }
}

function formToSymbol(node: SurfForm): DocumentSymbol | null {
  const range = siteToRange(node.site)
  if (!range) return null

  const children: DocumentSymbol[] = []

  for (const link of node.link) {
    const r = siteToRange(link.site)
    if (r) {
      children.push({
        name: link.name,
        kind: SYMBOL_KIND.Field,
        range: r.full,
        selectionRange: r.name,
      })
    }
  }

  for (const arm of node.case) {
    const r = siteToRange(arm.site)
    if (r) {
      children.push({
        name: arm.name,
        kind: SYMBOL_KIND.EnumMember,
        range: r.full,
        selectionRange: r.name,
      })
    }
  }

  for (const t of node.task) {
    const s = surfToSymbol(t)
    if (s) children.push(s)
  }

  return {
    name: node.name,
    kind: node.case.length > 0 ? SYMBOL_KIND.Enum : SYMBOL_KIND.Class,
    range: range.full,
    selectionRange: range.name,
    children: children.length > 0 ? children : undefined,
  }
}

function maskToSymbol(node: SurfMask): DocumentSymbol | null {
  const range = siteToRange(node.site)
  if (!range) return null

  const children: DocumentSymbol[] = []
  for (const t of node.task) {
    const s = surfToSymbol(t)
    if (s) children.push(s)
  }

  return {
    name: node.name,
    kind: SYMBOL_KIND.Interface,
    range: range.full,
    selectionRange: range.name,
    children: children.length > 0 ? children : undefined,
  }
}

function suitToSymbol(node: SurfSuit): DocumentSymbol | null {
  const range = siteToRange(node.site)
  if (!range) return null

  return {
    name: node.name,
    kind: SYMBOL_KIND.Module,
    range: range.full,
    selectionRange: range.name,
  }
}

function wearToSymbol(node: SurfWear): DocumentSymbol | null {
  const range = siteToRange(node.site)
  if (!range) return null

  const children: DocumentSymbol[] = []
  for (const t of node.task) {
    const s = surfToSymbol(t)
    if (s) children.push(s)
  }

  return {
    name: node.name,
    kind: SYMBOL_KIND.Class,
    range: range.full,
    selectionRange: range.name,
    children: children.length > 0 ? children : undefined,
  }
}

function testToSymbol(node: SurfTest): DocumentSymbol | null {
  const range = siteToRange(node.site)
  if (!range) return null

  return {
    name: node.name,
    kind: SYMBOL_KIND.Function,
    detail: 'test',
    range: range.full,
    selectionRange: range.name,
  }
}

function bookToSymbol(node: SurfBook): DocumentSymbol | null {
  const range = siteToRange(node.site)
  if (!range) return null

  const children: DocumentSymbol[] = []
  for (const child of node.list) {
    const s = surfToSymbol(child)
    if (s) children.push(s)
  }

  return {
    name: node.name,
    kind: SYMBOL_KIND.Namespace,
    range: range.full,
    selectionRange: range.name,
    children: children.length > 0 ? children : undefined,
  }
}

function siteToRange(site: { form: string }): { full: DocumentSymbol['range']; name: DocumentSymbol['selectionRange'] } | null {
  if (site.form !== 'card-site') return null

  const s = site as CardSite
  const full = {
    start: { line: s.base.line - 1, character: s.base.mark - 1 },
    end: { line: s.head.line - 1, character: s.head.mark - 1 },
  }
  // Selection range is approximated as the first line
  const name = {
    start: { line: s.base.line - 1, character: s.base.mark - 1 },
    end: { line: s.base.line - 1, character: s.base.mark + 20 },
  }
  return { full, name }
}
