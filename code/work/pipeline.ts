/**
 * Analysis pipeline: parse -> index -> publish diagnostics.
 *
 * Phase 1 implementation: fast parse only.
 * Full analysis (desugar + type check) will be added in Phase 2.
 */

import type { DocumentStore } from '@/hold/document'
import { pathToUri } from '@/hold/document'
import type { SymbolIndex } from '@/seek/index'
import { indexCard } from '@/seek/build'
import type { Dispatcher } from '@/link/dispatch'
import type { Diagnostic } from '@/link/protocol'
import { DIAGNOSTIC_SEVERITY } from '@/link/protocol'
import type { Kink, CardSite } from '@/mesh/form'

export type ParseFn = (input: { file: string; text: string }) => { tree: any } | null
export type ReadCardFn = (input: { tree: any; file: string }) => any
export type ExpandFuseFn = (input: { card: any }) => any

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
}): Pipeline {
  const { docs, index, dispatcher, parse, readCard, expandFuse } = input

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

  return {
    /**
     * Fast parse: parse a single file and publish parse diagnostics.
     */
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

        // Index the file
        indexCard({ index, card })

        // Publish diagnostics
        const diagnostics = parseErrors
          .map(k => kinkToDiagnostic(k))
          .filter((d): d is Diagnostic => d !== null)

        publishDiagnostics({ uri: input.uri, diagnostics })
      } catch {
        // Parse crashed, publish empty diagnostics
        docs.setCard({ uri: input.uri, card: { file: doc.file, list: [] }, parseErrors: [] })
        publishDiagnostics({ uri: input.uri, diagnostics: [] })
      }
    },

    /**
     * Full analysis: desugar + type check all dirty files.
     * Phase 2 implementation. For now, just re-parse dirty files.
     */
    fullAnalysis() {
      for (const doc of docs.allFiles()) {
        if (doc.dirty && doc.open) {
          const uri = pathToUri(doc.file)
          this.parseFile({ uri })
          docs.markClean({ uri })
        }
      }
    },
  }
}
