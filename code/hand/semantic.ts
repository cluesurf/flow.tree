/**
 * textDocument/semanticTokens/full handler.
 *
 * Provides semantic token classifications for .tree files.
 * Token types and modifiers follow the LSP semantic token legend.
 */

import type { DocumentStore } from '@/hold/document'
import type { Surf, SurfCard, CardSite } from '@/mesh/form'

/** Token types in legend order. */
export const TOKEN_TYPES = [
  'namespace',    // 0  book, suit
  'type',         // 1  form, mask
  'class',        // 2  form
  'function',     // 3  task
  'variable',     // 4  save, host
  'parameter',    // 5  base (take), head
  'property',     // 6  link
  'enumMember',   // 7  case
  'keyword',      // 8  built-in keywords
  'string',       // 9  sift-text
  'number',       // 10 sift-mark
  'comment',      // 11
  'decorator',    // 12 wear
  'macro',        // 13 fuse, tree
]

/** Token modifiers in legend order. */
export const TOKEN_MODIFIERS = [
  'declaration',  // 0
  'definition',   // 1
  'readonly',     // 2
  'async',        // 3
]

export type SemanticTokensResult = {
  data: number[]
}

export function handleSemanticTokensFull(input: {
  docs: DocumentStore
  uri: string
}): SemanticTokensResult {
  const { docs, uri } = input
  const doc = docs.get(uri)
  if (!doc || !doc.card) return { data: [] }

  const tokens: RawToken[] = []
  for (const node of doc.card.list) {
    collectTokens({ node, tokens })
  }

  // Sort by line then character
  tokens.sort((a, b) => a.line - b.line || a.char - b.char)

  // Encode as delta array
  return { data: encodeDelta(tokens) }
}

type RawToken = {
  line: number
  char: number
  length: number
  type: number
  modifiers: number
}

function collectTokens(input: { node: Surf; tokens: RawToken[] }): void {
  const { node, tokens } = input
  if (node.site.form !== 'card-site') return

  const site = node.site as CardSite

  switch (node.form) {
    case 'task': {
      const n = node as any
      addNameToken({ tokens, site, type: 3, modifiers: 0b0011, name: n.name })
      if (n.wait) addNameToken({ tokens, site, type: 3, modifiers: 0b1011, name: n.name })
      for (const b of n.base ?? []) collectTokens({ node: b, tokens })
      for (const h of n.head ?? []) collectTokens({ node: h, tokens })
      for (const f of n.flow ?? []) collectTokens({ node: f, tokens })
      for (const t of n.task ?? []) collectTokens({ node: t, tokens })
      break
    }
    case 'form': {
      const n = node as any
      addNameToken({ tokens, site, type: 2, modifiers: 0b0011, name: n.name })
      for (const l of n.link ?? []) collectTokens({ node: l, tokens })
      for (const c of n.case ?? []) collectTokens({ node: c, tokens })
      for (const t of n.task ?? []) collectTokens({ node: t, tokens })
      for (const w of n.wear ?? []) collectTokens({ node: w, tokens })
      break
    }
    case 'mask': {
      const n = node as any
      addNameToken({ tokens, site, type: 1, modifiers: 0b0011, name: n.name })
      for (const t of n.task ?? []) collectTokens({ node: t, tokens })
      break
    }
    case 'suit': {
      const n = node as any
      addNameToken({ tokens, site, type: 0, modifiers: 0b0011, name: n.name })
      for (const w of n.wear ?? []) collectTokens({ node: w, tokens })
      break
    }
    case 'wear': {
      const n = node as any
      addNameToken({ tokens, site, type: 12, modifiers: 0b0001, name: n.name })
      for (const t of n.task ?? []) collectTokens({ node: t, tokens })
      break
    }
    case 'test': {
      const n = node as any
      addNameToken({ tokens, site, type: 3, modifiers: 0b0001, name: n.name })
      for (const f of n.flow ?? []) collectTokens({ node: f, tokens })
      break
    }
    case 'book': {
      const n = node as any
      addNameToken({ tokens, site, type: 0, modifiers: 0b0001, name: n.name })
      for (const item of n.list ?? []) collectTokens({ node: item, tokens })
      break
    }
    case 'base': {
      const n = node as any
      addNameToken({ tokens, site, type: 5, modifiers: 0b0001, name: n.name })
      break
    }
    case 'head': {
      const n = node as any
      addNameToken({ tokens, site, type: 5, modifiers: 0b0001, name: n.name })
      break
    }
    case 'link': {
      const n = node as any
      addNameToken({ tokens, site, type: 6, modifiers: 0b0001, name: n.name })
      break
    }
    case 'case-arm': {
      const n = node as any
      addNameToken({ tokens, site, type: 7, modifiers: 0b0001, name: n.name })
      for (const l of n.link ?? []) collectTokens({ node: l, tokens })
      break
    }
    case 'call': {
      const n = node as any
      addNameToken({ tokens, site, type: 3, modifiers: 0, name: n.name })
      for (const b of n.bind ?? []) collectTokens({ node: b, tokens })
      break
    }
    case 'make': {
      const n = node as any
      addNameToken({ tokens, site, type: 2, modifiers: 0, name: n.name })
      for (const b of n.bind ?? []) collectTokens({ node: b, tokens })
      break
    }
    case 'save': {
      const n = node as any
      const name = n.path?.[0]
      if (name) addNameToken({ tokens, site, type: 4, modifiers: 0b0001, name })
      if (n.sift) collectTokens({ node: n.sift, tokens })
      break
    }
    case 'host': {
      const n = node as any
      addNameToken({ tokens, site, type: 4, modifiers: 0b0101, name: n.name })
      if (n.sift) collectTokens({ node: n.sift, tokens })
      break
    }
    case 'sift-text': {
      tokens.push({
        line: site.base.line - 1,
        char: site.base.mark - 1,
        length: Math.max(1, site.head.mark - site.base.mark),
        type: 9,
        modifiers: 0,
      })
      break
    }
    case 'sift-mark': {
      tokens.push({
        line: site.base.line - 1,
        char: site.base.mark - 1,
        length: Math.max(1, site.head.mark - site.base.mark),
        type: 10,
        modifiers: 0,
      })
      break
    }
    case 'load': {
      const n = node as any
      for (const f of n.find ?? []) collectTokens({ node: f, tokens })
      break
    }
    case 'fuse':
    case 'tree': {
      const n = node as any
      addNameToken({ tokens, site, type: 13, modifiers: 0b0001, name: n.name })
      break
    }
    case 'fork':
    case 'walk': {
      const n = node as any
      if (n.sift) collectTokens({ node: n.sift, tokens })
      for (const h of n.hook ?? []) collectTokens({ node: h, tokens })
      break
    }
    case 'hook': {
      const n = node as any
      for (const b of n.base ?? []) collectTokens({ node: b, tokens })
      for (const f of n.flow ?? []) collectTokens({ node: f, tokens })
      break
    }
    case 'bind': {
      const n = node as any
      if (n.sift) collectTokens({ node: n.sift, tokens })
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
      if (n.sift) collectTokens({ node: n.sift, tokens })
      break
    }
    case 'meet': {
      const n = node as any
      for (const item of n.list ?? []) collectTokens({ node: item, tokens })
      break
    }
    case 'beam': {
      const n = node as any
      for (const f of n.flow ?? []) collectTokens({ node: f, tokens })
      break
    }
  }
}

function addNameToken(input: {
  tokens: RawToken[]
  site: CardSite
  type: number
  modifiers: number
  name: string
}): void {
  if (!input.name) return
  input.tokens.push({
    line: input.site.base.line - 1,
    char: input.site.base.mark - 1,
    length: input.name.length,
    type: input.type,
    modifiers: input.modifiers,
  })
}

function encodeDelta(tokens: RawToken[]): number[] {
  const data: number[] = []
  let prevLine = 0
  let prevChar = 0

  for (const tok of tokens) {
    const deltaLine = tok.line - prevLine
    const deltaChar = deltaLine === 0 ? tok.char - prevChar : tok.char

    data.push(deltaLine, deltaChar, tok.length, tok.type, tok.modifiers)

    prevLine = tok.line
    prevChar = tok.char
  }

  return data
}
