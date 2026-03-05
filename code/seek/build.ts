/**
 * Symbol index builder: extracts definitions and references from SurfCards.
 */

import type { Surf, SurfCard, SurfTask, SurfForm, SurfMask, SurfSuit, SurfWear, SurfTest, SurfBook, SurfCall, SurfMake, SurfSave, SurfHost, SurfLoad, SurfFind, SurfFork, SurfWalk, SurfHook, SurfBase, CardSite } from '@/mesh/form'
import type { SymbolIndex, SymbolInfo, SymbolRef, SymbolKindTag, RefKindTag } from '@/seek/index'
import { clearFile, addDefinition, addReference } from '@/seek/index'

/**
 * Re-index a single file. Clears old entries and extracts new ones.
 */
export function indexCard(input: { index: SymbolIndex; card: SurfCard }): void {
  const { index, card } = input
  const file = card.file

  clearFile({ index, file })
  walkNodes({ index, file, nodes: card.list, parent: null })
}

function walkNodes(input: {
  index: SymbolIndex
  file: string
  nodes: Surf[]
  parent: string | null
}): void {
  const { index, file, nodes, parent } = input

  for (const node of nodes) {
    walkNode({ index, file, node, parent })
  }
}

function walkNode(input: {
  index: SymbolIndex
  file: string
  node: Surf
  parent: string | null
}): void {
  const { index, file, node, parent } = input

  switch (node.form) {
    case 'task':
      indexTask({ index, file, node: node as SurfTask, parent })
      break
    case 'form':
      indexForm({ index, file, node: node as SurfForm, parent })
      break
    case 'mask':
      indexMask({ index, file, node: node as SurfMask, parent })
      break
    case 'suit':
      indexSuit({ index, file, node: node as SurfSuit, parent })
      break
    case 'wear':
      indexWear({ index, file, node: node as SurfWear, parent })
      break
    case 'test':
      indexTest({ index, file, node: node as SurfTest, parent })
      break
    case 'book':
      indexBook({ index, file, node: node as SurfBook, parent })
      break
    case 'call':
      indexCall({ index, file, node: node as SurfCall })
      break
    case 'make':
      indexMake({ index, file, node: node as SurfMake })
      break
    case 'save':
      indexSave({ index, file, node: node as SurfSave, parent })
      break
    case 'host':
      indexHost({ index, file, node: node as SurfHost, parent })
      break
    case 'load':
      indexLoad({ index, file, node: node as SurfLoad })
      break
    case 'fork':
      indexFork({ index, file, node: node as SurfFork })
      break
    case 'walk':
      indexWalkNode({ index, file, node: node as SurfWalk })
      break
  }
}

function addDef(input: {
  index: SymbolIndex
  file: string
  name: string
  kind: SymbolKindTag
  site: CardSite
  parent: string | null
}): void {
  addDefinition({
    index: input.index,
    symbol: {
      name: input.parent ? `${input.parent}/${input.name}` : input.name,
      shortName: input.name,
      kind: input.kind,
      site: input.site,
      file: input.file,
      parent: input.parent,
      exported: input.parent === null,
      doc: null,
    },
  })
}

function addRef(input: {
  index: SymbolIndex
  file: string
  name: string
  site: CardSite
  kind: RefKindTag
}): void {
  if (input.site.form !== 'card-site') return
  addReference({
    index: input.index,
    ref: {
      name: input.name,
      site: input.site,
      file: input.file,
      kind: input.kind,
    },
  })
}

function asCardSite(site: { form: string }): CardSite | null {
  return site.form === 'card-site' ? (site as CardSite) : null
}

function indexTask(input: { index: SymbolIndex; file: string; node: SurfTask; parent: string | null }): void {
  const { index, file, node, parent } = input
  const site = asCardSite(node.site)
  if (!site) return

  addDef({ index, file, name: node.name, kind: 'task', site, parent })

  // Index parameter types as references
  for (const base of node.base) {
    indexTypeRef({ index, file, type: base.like })
    const baseSite = asCardSite(base.site)
    if (baseSite) {
      addDef({ index, file, name: base.name, kind: 'base', site: baseSite, parent: node.name })
    }
  }

  // Index return type
  indexTypeRef({ index, file, type: node.like })

  // Walk body
  walkNodes({ index, file, nodes: node.flow, parent: node.name })
  walkNodes({ index, file, nodes: node.task, parent: node.name })
}

function indexForm(input: { index: SymbolIndex; file: string; node: SurfForm; parent: string | null }): void {
  const { index, file, node, parent } = input
  const site = asCardSite(node.site)
  if (!site) return

  addDef({ index, file, name: node.name, kind: 'form', site, parent })

  for (const head of node.head) {
    const hSite = asCardSite(head.site)
    if (hSite) {
      addDef({ index, file, name: head.name, kind: 'head', site: hSite, parent: node.name })
    }
  }

  for (const link of node.link) {
    const lSite = asCardSite(link.site)
    if (lSite) {
      addDef({ index, file, name: link.name, kind: 'link', site: lSite, parent: node.name })
    }
    indexTypeRef({ index, file, type: link.like })
  }

  for (const arm of node.case) {
    const cSite = asCardSite(arm.site)
    if (cSite) {
      addDef({ index, file, name: arm.name, kind: 'case', site: cSite, parent: node.name })
    }
    for (const link of arm.link) {
      indexTypeRef({ index, file, type: link.like })
    }
  }

  walkNodes({ index, file, nodes: node.task, parent: node.name })
  walkNodes({ index, file, nodes: node.wear, parent: node.name })
}

function indexMask(input: { index: SymbolIndex; file: string; node: SurfMask; parent: string | null }): void {
  const { index, file, node, parent } = input
  const site = asCardSite(node.site)
  if (!site) return

  addDef({ index, file, name: node.name, kind: 'mask', site, parent })
  walkNodes({ index, file, nodes: node.task, parent: node.name })
}

function indexSuit(input: { index: SymbolIndex; file: string; node: SurfSuit; parent: string | null }): void {
  const { index, file, node, parent } = input
  const site = asCardSite(node.site)
  if (!site) return

  addDef({ index, file, name: node.name, kind: 'suit', site, parent })
  walkNodes({ index, file, nodes: node.wear, parent: node.name })
}

function indexWear(input: { index: SymbolIndex; file: string; node: SurfWear; parent: string | null }): void {
  const { index, file, node, parent } = input
  const site = asCardSite(node.site)
  if (!site) return

  addRef({ index, file, name: node.name, site, kind: 'type' })
  walkNodes({ index, file, nodes: node.task, parent: parent ?? node.name })
}

function indexTest(input: { index: SymbolIndex; file: string; node: SurfTest; parent: string | null }): void {
  const { index, file, node, parent } = input
  const site = asCardSite(node.site)
  if (!site) return

  addDef({ index, file, name: node.name, kind: 'test', site, parent })
  walkNodes({ index, file, nodes: node.flow, parent: node.name })
}

function indexBook(input: { index: SymbolIndex; file: string; node: SurfBook; parent: string | null }): void {
  const { index, file, node, parent } = input
  const site = asCardSite(node.site)
  if (!site) return

  addDef({ index, file, name: node.name, kind: 'book', site, parent })
  walkNodes({ index, file, nodes: node.list, parent: node.name })
}

function indexCall(input: { index: SymbolIndex; file: string; node: SurfCall }): void {
  const { index, file, node } = input
  const site = asCardSite(node.site)
  if (!site) return

  addRef({ index, file, name: node.name, site, kind: 'call' })

  // Walk call arguments for nested expressions
  for (const bind of node.bind) {
    if (bind.sift) walkNode({ index, file, node: bind.sift, parent: null })
  }

  for (const hook of Object.values(node.hook)) {
    indexHook({ index, file, hook })
  }
}

function indexMake(input: { index: SymbolIndex; file: string; node: SurfMake }): void {
  const { index, file, node } = input
  const site = asCardSite(node.site)
  if (!site) return

  addRef({ index, file, name: node.name, site, kind: 'make' })

  for (const bind of node.bind) {
    if (bind.sift) walkNode({ index, file, node: bind.sift, parent: null })
  }
}

function indexSave(input: { index: SymbolIndex; file: string; node: SurfSave; parent: string | null }): void {
  const { index, file, node, parent } = input
  const site = asCardSite(node.site)
  if (!site) return

  if (node.path.length > 0) {
    addDef({ index, file, name: node.path[0]!, kind: 'save', site, parent })
  }

  if (node.sift) walkNode({ index, file, node: node.sift, parent: null })
}

function indexHost(input: { index: SymbolIndex; file: string; node: SurfHost; parent: string | null }): void {
  const { index, file, node, parent } = input
  const site = asCardSite(node.site)
  if (!site) return

  addDef({ index, file, name: node.name, kind: 'host', site, parent })

  if (node.sift) walkNode({ index, file, node: node.sift, parent: null })
}

function indexLoad(input: { index: SymbolIndex; file: string; node: SurfLoad }): void {
  const { index, file, node } = input

  for (const find of node.find) {
    const fSite = asCardSite(find.site)
    if (fSite) {
      addRef({ index, file, name: find.name, site: fSite, kind: 'load' })
    }
  }
}

function indexFork(input: { index: SymbolIndex; file: string; node: SurfFork }): void {
  const { index, file, node } = input
  if (node.sift) walkNode({ index, file, node: node.sift, parent: null })
  for (const hook of node.hook) {
    indexHook({ index, file, hook })
  }
}

function indexWalkNode(input: { index: SymbolIndex; file: string; node: SurfWalk }): void {
  const { index, file, node } = input
  if (node.sift) walkNode({ index, file, node: node.sift, parent: null })
  for (const hook of node.hook) {
    indexHook({ index, file, hook })
  }
}

function indexHook(input: { index: SymbolIndex; file: string; hook: SurfHook }): void {
  const { index, file, hook } = input
  walkNodes({ index, file, nodes: hook.flow, parent: null })
}

function indexTypeRef(input: { index: SymbolIndex; file: string; type: any }): void {
  const { index, file } = input
  const type = input.type
  if (!type) return

  if (type.form === 'type-name' && type.name) {
    // We don't have a precise site for the type reference from SurfType,
    // so we skip adding a ref here. This will be improved when we add
    // sub-site tracking to type annotations.
  }
}
