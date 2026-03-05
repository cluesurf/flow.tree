/**
 * Analysis pipeline: parse -> index -> desugar -> type check -> diagnostics.
 */

import type { DocumentStore } from '@/hold/document'
import { pathToUri } from '@/hold/document'
import type { SymbolIndex } from '@/seek/index'
import { indexCard } from '@/seek/build'
import type { Dispatcher } from '@/link/dispatch'
import type { Diagnostic } from '@/link/protocol'
import { DIAGNOSTIC_SEVERITY } from '@/link/protocol'
import type { Kink, CardSite, SurfCard, Book, DesugarResult } from '@/mesh/form'

export type ParseFn = (input: { file: string; text: string }) => { tree: any } | null
export type ReadCardFn = (input: { tree: any; file: string }) => any
export type ExpandFuseFn = (input: { card: any }) => any
export type DesugarFn = (input: { card: SurfCard }) => DesugarResult
export type CheckFn = (input: { term: any; book: Book }) => { state: any; value: any } | null

export type Pipeline = {
  parseFile(input: { uri: string }): void
  fullAnalysis(): void
}

export function createPipeline(input: {
  docs: DocumentStore
  index: SymbolIndex
  dispatcher: Dispatcher
  parse: ParseFn
  readCard: ReadCardFn
  expandFuse: ExpandFuseFn
  desugar?: DesugarFn
  check?: CheckFn
}): Pipeline {
  const { docs, index, dispatcher, parse, readCard, expandFuse } = input
  const desugar = input.desugar ?? null
  const check = input.check ?? null

  function publishDiagnostics(input: { uri: string; diagnostics: Diagnostic[] }): void {
    dispatcher.sendNotification('textDocument/publishDiagnostics', {
      uri: input.uri,
      diagnostics: input.diagnostics,
    })
  }

  function kinkToDiagnostic(kink: Kink): Diagnostic | null {
    const site = kink.site
    if (site.form !== 'card-site') return null

    const cardSite = site as CardSite
    return {
      range: {
        start: { line: cardSite.base.line - 1, character: cardSite.base.mark - 1 },
        end: { line: cardSite.head.line - 1, character: cardSite.head.mark - 1 },
      },
      severity: kink.rank === 'halt'
        ? DIAGNOSTIC_SEVERITY.Error
        : kink.rank === 'tell'
          ? DIAGNOSTIC_SEVERITY.Warning
          : DIAGNOSTIC_SEVERITY.Information,
      source: 'seed',
      message: kink.text,
    }
  }

  function collectDiagnostics(errors: Kink[]): Diagnostic[] {
    return errors
      .map(k => kinkToDiagnostic(k))
      .filter((d): d is Diagnostic => d !== null)
  }

  return {
    parseFile(input) {
      const doc = docs.get(input.uri)
      if (!doc) return

      const parseErrors: Kink[] = []

      try {
        const result = parse({ file: doc.file, text: doc.text })
        if (!result || !result.tree) {
          docs.setCard({ uri: input.uri, card: { file: doc.file, list: [] }, parseErrors: [] })
          publishDiagnostics({ uri: input.uri, diagnostics: [] })
          return
        }

        const rawCard = readCard({ tree: result.tree, file: doc.file })
        const card = expandFuse({ card: rawCard })

        docs.setCard({ uri: input.uri, card, parseErrors })

        indexCard({ index, card })

        const diagnostics = collectDiagnostics(parseErrors)
        publishDiagnostics({ uri: input.uri, diagnostics })
      } catch {
        docs.setCard({ uri: input.uri, card: { file: doc.file, list: [] }, parseErrors: [] })
        publishDiagnostics({ uri: input.uri, diagnostics: [] })
      }
    },

    fullAnalysis() {
      // Phase 1: re-parse dirty files
      for (const doc of docs.allFiles()) {
        if (doc.dirty && doc.open) {
          const uri = pathToUri(doc.file)
          this.parseFile({ uri })
        }
      }

      // Phase 2: desugar + type check if available
      if (!desugar) {
        for (const doc of docs.allFiles()) {
          if (doc.dirty && doc.open) {
            docs.markClean({ uri: pathToUri(doc.file) })
          }
        }
        return
      }

      // Build merged book from all open files
      const mergedBook: Book = new Map()
      const allErrors: Map<string, Kink[]> = new Map()

      for (const doc of docs.allFiles()) {
        if (!doc.card || !doc.open) continue

        try {
          const result = desugar({ card: doc.card })

          for (const [name, term] of result.book) {
            mergedBook.set(name, term)
          }

          if (result.errors.length > 0) {
            const existing = allErrors.get(doc.file) ?? []
            existing.push(...result.errors)
            allErrors.set(doc.file, existing)
          }
        } catch {
          // Desugar crashed for this file, skip
        }
      }

      // Type check each definition
      if (check) {
        for (const [name, term] of mergedBook) {
          try {
            check({ term, book: mergedBook })
          } catch {
            // Type check crashed for this definition, skip
          }
        }
      }

      // Publish combined diagnostics (parse + desugar)
      for (const doc of docs.allFiles()) {
        if (!doc.open) continue
        const uri = pathToUri(doc.file)

        const parseD = collectDiagnostics(doc.parseErrors)
        const desugarD = collectDiagnostics(allErrors.get(doc.file) ?? [])

        docs.setCheckErrors({ uri, errors: allErrors.get(doc.file) ?? [] })
        publishDiagnostics({ uri, diagnostics: [...parseD, ...desugarD] })
        docs.markClean({ uri })
      }
    },
  }
}
