/**
 * textDocument/hover handler.
 */

import type { Hover, Position } from '@/link/protocol'
import type { DocumentStore } from '@/hold/document'
import type { SymbolIndex } from '@/seek/index'
import { findNodeAt, getNodeName } from '@/seek/query'
import { findDefinitions } from '@/seek/query'

export function handleHover(input: {
  docs: DocumentStore
  index: SymbolIndex
  uri: string
  position: Position
}): Hover | null {
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

  // Build hover content
  const lines: string[] = []

  // Show the node kind and name
  lines.push('```seed')
  lines.push(`${node.form} ${name}`)

  // If it's a reference, show definition info
  if (node.form === 'call' || node.form === 'make' || node.form === 'sift-link' || node.form === 'sift-read') {
    const defs = findDefinitions({ index, name })
    if (defs.length > 0) {
      const def = defs[0]!
      lines[lines.length - 1] = `${def.kind} ${def.shortName}`
    }
  }

  // If it's a definition node, show its kind
  if (node.form === 'task') {
    const task = node as any
    const params = (task.base ?? []).map((b: any) => `  take ${b.name}${b.like ? ` like ${formatType(b.like)}` : ''}`).join('\n')
    const ret = task.like ? `  like ${formatType(task.like)}` : ''
    if (params) lines.push(params)
    if (ret) lines.push(ret)
  } else if (node.form === 'form') {
    const form = node as any
    for (const link of form.link ?? []) {
      lines.push(`  link ${link.name}${link.like ? ` like ${formatType(link.like)}` : ''}`)
    }
  }

  lines.push('```')

  return {
    contents: {
      kind: 'markdown',
      value: lines.join('\n'),
    },
  }
}

function formatType(type: any): string {
  if (!type) return '?'
  if (type.form === 'type-name') {
    const args = type.args?.map((a: any) => formatType(a)).join(', ') ?? ''
    return args ? `${type.name}(${args})` : type.name
  }
  if (type.form === 'type-or') {
    return type.list.map((t: any) => formatType(t)).join(' | ')
  }
  if (type.form === 'type-and') {
    return type.list.map((t: any) => formatType(t)).join(' & ')
  }
  if (type.form === 'type-fn') {
    const params = type.params?.map((p: any) => formatType(p)).join(', ') ?? ''
    const ret = type.ret ? formatType(type.ret) : '?'
    return `task(${params}) like ${ret}`
  }
  return '?'
}
