/**
 * textDocument/signatureHelp handler.
 */

import type { SignatureHelp, ParameterInformation } from '@/link/protocol'
import type { DocumentStore } from '@/hold/document'
import type { SymbolIndex, SymbolInfo } from '@/seek/index'
import { findDefinitions } from '@/seek/query'
import { findNodeAt, getNodeName } from '@/seek/query'
import type { SurfTask, SurfBase, SurfType } from '@/mesh/form'

export function handleSignatureHelp(input: {
  docs: DocumentStore
  index: SymbolIndex
  uri: string
  position: { line: number; character: number }
}): SignatureHelp | null {
  const { docs, index, uri, position } = input

  const doc = docs.get(uri)
  if (!doc || !doc.card) return null

  // Find the call node at position
  const node = findNodeAt({
    card: doc.card,
    line: position.line + 1,
    col: position.character + 1,
  })
  if (!node) return null

  // Only provide signature help inside call expressions
  if (node.form !== 'call' && node.form !== 'bind') return null

  // Get the call name (walk up if we're on a bind)
  let callName: string | null = null
  if (node.form === 'call') {
    callName = (node as any).name ?? null
  } else {
    // We're inside a bind, try to find the parent call
    for (const topNode of doc.card.list) {
      const found = findCallParent({ node: topNode, target: node })
      if (found) {
        callName = (found as any).name ?? null
        break
      }
    }
  }

  if (!callName) return null

  // Look up the task definition
  const defs = findDefinitions({ index, name: callName })
  const taskDef = defs.find(d => d.kind === 'task')
  if (!taskDef) return null

  // Find the task's SurfCard definition to get parameter info
  const taskNode = findTaskNode({ docs, def: taskDef })
  if (!taskNode) return null

  const params: ParameterInformation[] = (taskNode.base ?? []).map((b: SurfBase) => ({
    label: b.name,
    documentation: b.like ? `like ${formatType(b.like)}` : undefined,
  }))

  // Determine active parameter from cursor position
  let activeParam = 0
  if (node.form === 'bind') {
    const bindName = (node as any).name
    const idx = (taskNode.base ?? []).findIndex((b: SurfBase) => b.name === bindName)
    if (idx >= 0) activeParam = idx
  } else {
    const callNode = node as any
    activeParam = Math.min((callNode.bind ?? []).length, params.length - 1)
  }

  const label = buildSignatureLabel({ name: callName, task: taskNode })

  return {
    signatures: [{
      label,
      parameters: params,
    }],
    activeSignature: 0,
    activeParameter: Math.max(0, activeParam),
  }
}

function buildSignatureLabel(input: { name: string; task: SurfTask }): string {
  const parts = [`task ${input.name}`]
  for (const b of input.task.base ?? []) {
    const type = b.like ? ` like ${formatType(b.like)}` : ''
    parts.push(`  take ${b.name}${type}`)
  }
  if (input.task.like) {
    parts.push(`  like ${formatType(input.task.like)}`)
  }
  return parts.join('\n')
}

function formatType(type: SurfType): string {
  if (type.form === 'type-name') {
    const args = type.args?.map(a => formatType(a)).join(', ') ?? ''
    return args ? `${type.name}(${args})` : type.name
  }
  if (type.form === 'type-or') {
    return type.list.map(t => formatType(t)).join(' | ')
  }
  if (type.form === 'type-and') {
    return type.list.map(t => formatType(t)).join(' & ')
  }
  if (type.form === 'type-fn') {
    const params = type.params?.map(p => formatType(p)).join(', ') ?? ''
    const ret = type.ret ? formatType(type.ret) : '?'
    return `task(${params}) like ${ret}`
  }
  return '?'
}

function findTaskNode(input: { docs: DocumentStore; def: SymbolInfo }): SurfTask | null {
  for (const doc of input.docs.allFiles()) {
    if (doc.file !== input.def.file || !doc.card) continue
    for (const node of doc.card.list) {
      if (node.form === 'task' && (node as SurfTask).name === input.def.shortName) {
        return node as SurfTask
      }
    }
  }
  return null
}

function findCallParent(input: { node: any; target: any }): any | null {
  if (input.node === input.target) return null
  if (input.node.form === 'call') {
    for (const b of input.node.bind ?? []) {
      if (b === input.target) return input.node
    }
  }
  for (const key of Object.keys(input.node)) {
    const val = input.node[key]
    if (Array.isArray(val)) {
      for (const child of val) {
        if (child && typeof child === 'object' && child.form) {
          const found = findCallParent({ node: child, target: input.target })
          if (found) return found
        }
      }
    } else if (val && typeof val === 'object' && val.form) {
      const found = findCallParent({ node: val, target: input.target })
      if (found) return found
    }
  }
  return null
}
