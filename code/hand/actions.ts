/**
 * textDocument/codeAction handler.
 *
 * Provides quick fixes and refactorings:
 * - Add missing load (auto-import)
 * - Organize loads (sort + group)
 * - Remove unused load
 */

import type { Range, TextEdit, WorkspaceEdit, Diagnostic } from '@/link/protocol'
import type { DocumentStore } from '@/hold/document'
import type { SymbolIndex } from '@/seek/index'
import type { Surf, SurfLoad, CardSite } from '@/mesh/form'

export type CodeAction = {
  title: string
  kind?: string
  diagnostics?: Diagnostic[]
  edit?: WorkspaceEdit
}

export function handleCodeActions(input: {
  docs: DocumentStore
  index: SymbolIndex
  uri: string
  range: Range
  diagnostics: Diagnostic[]
}): CodeAction[] {
  const { docs, index, uri, range, diagnostics } = input

  const doc = docs.get(uri)
  if (!doc || !doc.card) return []

  const actions: CodeAction[] = []

  // Organize loads
  const loads = doc.card.list.filter(n => n.form === 'load') as SurfLoad[]
  if (loads.length > 1) {
    const organizeEdit = buildOrganizeLoads({ loads, uri })
    if (organizeEdit) {
      actions.push({
        title: 'Organize loads',
        kind: 'source.organizeImports',
        edit: organizeEdit,
      })
    }
  }

  // Remove unused loads
  for (const load of loads) {
    if (!isLoadUsed({ load, card: doc.card, index })) {
      const removeEdit = buildRemoveLoad({ load, uri })
      if (removeEdit) {
        actions.push({
          title: `Remove unused load '${load.path.join('/')}'`,
          kind: 'quickfix',
          edit: removeEdit,
        })
      }
    }
  }

  // Auto-import for unresolved names from diagnostics
  for (const diag of diagnostics) {
    if (diag.code === 'name-miss' || diag.message.includes('not found')) {
      const name = extractNameFromDiagnostic(diag)
      if (name) {
        const defs = index.definitions.get(name)
        if (defs && defs.length > 0) {
          for (const def of defs) {
            if (def.file === doc.file) continue
            const importEdit = buildAutoImport({ name: def.shortName, file: def.file, uri, text: doc.text })
            if (importEdit) {
              actions.push({
                title: `Add load for '${def.shortName}' from ${def.file.split('/').pop()}`,
                kind: 'quickfix',
                diagnostics: [diag],
                edit: importEdit,
              })
            }
          }
        }
      }
    }
  }

  return actions
}

function isLoadUsed(input: { load: SurfLoad; card: { list: Surf[] }; index: SymbolIndex }): boolean {
  const { load, index } = input

  // If the load has specific find items, check if any are referenced
  if (load.find.length > 0) {
    for (const f of load.find) {
      const name = f.alias ?? f.name
      const refs = index.references.get(name)
      if (refs && refs.length > 0) return true
    }
    return false
  }

  // Glob import, assume used
  return true
}

function buildOrganizeLoads(input: { loads: SurfLoad[]; uri: string }): WorkspaceEdit | null {
  const { loads, uri } = input

  if (loads.length < 2) return null

  // Sort loads by path
  const sorted = [...loads].sort((a, b) => {
    const aPath = a.path.join('/')
    const bPath = b.path.join('/')
    return aPath.localeCompare(bPath)
  })

  // Check if already sorted
  const alreadySorted = loads.every((l, i) => {
    const s = sorted[i]!
    return l.path.join('/') === s.path.join('/')
  })
  if (alreadySorted) return null

  // Get the range covering all load directives
  const first = loads[0]!
  const last = loads[loads.length - 1]!
  if (first.site.form !== 'card-site' || last.site.form !== 'card-site') return null

  const firstSite = first.site as CardSite
  const lastSite = last.site as CardSite

  // Build new load text
  const lines: string[] = []
  for (const load of sorted) {
    const path = load.path.join('/')
    if (load.find.length > 0) {
      lines.push(`load ${path}`)
      for (const f of load.find) {
        const alias = f.alias ? ` as ${f.alias}` : ''
        lines.push(`  find ${f.name}${alias}`)
      }
    } else {
      lines.push(`load ${path}`)
    }
  }

  return {
    changes: {
      [uri]: [{
        range: {
          start: { line: firstSite.base.line - 1, character: 0 },
          end: { line: lastSite.head.line - 1, character: 0 },
        },
        newText: lines.join('\n') + '\n',
      }],
    },
  }
}

function buildRemoveLoad(input: { load: SurfLoad; uri: string }): WorkspaceEdit | null {
  const { load, uri } = input
  if (load.site.form !== 'card-site') return null

  const site = load.site as CardSite
  return {
    changes: {
      [uri]: [{
        range: {
          start: { line: site.base.line - 1, character: 0 },
          end: { line: site.head.line, character: 0 },
        },
        newText: '',
      }],
    },
  }
}

function buildAutoImport(input: { name: string; file: string; uri: string; text: string }): WorkspaceEdit | null {
  const { name, file, uri, text } = input
  const lines = text.split('\n')

  // Find the last load line to insert after
  let insertLine = 0
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.trimStart().startsWith('load ')) {
      insertLine = i + 1
    }
  }

  // Build a relative path (simplified)
  const shortFile = file.split('/').pop()?.replace('.tree', '') ?? file

  return {
    changes: {
      [uri]: [{
        range: {
          start: { line: insertLine, character: 0 },
          end: { line: insertLine, character: 0 },
        },
        newText: `load ${shortFile}\n  find ${name}\n`,
      }],
    },
  }
}

function extractNameFromDiagnostic(diag: Diagnostic): string | null {
  // Try to extract name from messages like "name 'foo' not found" or "unknown symbol: foo"
  const match = diag.message.match(/['`]([a-z][a-z0-9-]*)['`]/)
  return match?.[1] ?? null
}
