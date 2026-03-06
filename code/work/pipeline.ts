/**
 * Analysis pipeline: parse -> index -> desugar -> type check -> diagnostics.
 *
 * Supports package-aware resolution: when workspace folders are scanned,
 * all .tree files are parsed for skeletons. Template resolution runs
 * across the full package so cross-file fuse expansions work correctly.
 */

import * as fs from 'fs'
import * as path from 'path'
import type { DocumentStore } from '@/hold/document'
import { pathToUri } from '@/hold/document'
import type { SymbolIndex } from '@/seek/index'
import { indexCard } from '@/seek/build'
import type { Dispatcher } from '@/link/dispatch'
import type { Diagnostic } from '@/link/protocol'
import { DIAGNOSTIC_SEVERITY } from '@/link/protocol'
import type { Kink, CardSite, SurfCard, SurfTree, Book, DesugarResult, FileSkele, ResolverState } from '@/mesh/form'

export type ParseFn = (input: { file: string; text: string }) => { tree: any } | null
export type ReadCardFn = (input: { tree: any; file: string }) => any
export type ExpandFuseFn = (input: { card: any; externalTrees?: Map<string, SurfTree> }) => any
export type DesugarFn = (input: { card: SurfCard }) => DesugarResult
export type CheckFn = (input: { term: any; book: Book }) => { state: any; value: any } | null
export type ExtractSkeleFn = (input: { card: SurfCard }) => FileSkele
export type InitResolverFn = (input: { skeletons: Map<string, FileSkele> }) => ResolverState
export type ResolveTemplatesFn = (input: { state: ResolverState }) => ResolverState
export type ResolveStdlibFn = (input: { loadPath: string; parse: ParseFn }) => SurfCard | null

export type Pipeline = {
  parseFile(input: { uri: string }): void
  fullAnalysis(): void
  scanWorkspace(input: { folders: string[] }): void
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
  extractSkele?: ExtractSkeleFn
  initResolver?: InitResolverFn
  resolveTemplates?: ResolveTemplatesFn
  resolveStdlib?: ResolveStdlibFn
}): Pipeline {
  const { docs, index, dispatcher, parse, readCard, expandFuse } = input
  const desugar = input.desugar ?? null
  const check = input.check ?? null
  const extractSkele = input.extractSkele ?? null
  const initResolverFn = input.initResolver ?? null
  const resolveTemplatesFn = input.resolveTemplates ?? null
  const resolveStdlibFn = input.resolveStdlib ?? null

  // Package-wide state for skeleton-first resolution
  const skeletons = new Map<string, FileSkele>()
  const rawCards = new Map<string, SurfCard>()
  const packageTrees = new Map<string, SurfTree>()

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

  /**
   * Re-resolve package-wide templates from all known skeletons.
   * Updates packageTrees with all tree definitions across the package.
   */
  function resolvePackageTemplates(): void {
    if (!initResolverFn || !resolveTemplatesFn) return
    if (skeletons.size === 0) return

    try {
      const state = initResolverFn({ skeletons })
      resolveTemplatesFn({ state })
    } catch {
      // Resolution failed, continue with what we have
    }

    // Collect all tree definitions from raw cards
    packageTrees.clear()
    for (const [, rawCard] of rawCards) {
      for (const node of rawCard.list) {
        if (node.form === 'tree') {
          packageTrees.set((node as SurfTree).name, node as SurfTree)
        }
      }
    }
  }

  /**
   * Parse and index a single workspace file (not open in editor).
   * Only extracts skeleton and raw card for cross-file resolution.
   */
  function indexWorkspaceFile(filePath: string): void {
    if (!extractSkele) return

    let text: string
    try {
      text = fs.readFileSync(filePath, 'utf8')
    } catch {
      return
    }

    const result = parse({ file: filePath, text })
    if (!result || !result.tree) return

    try {
      const rawCard = readCard({ tree: result.tree, file: filePath })
      rawCards.set(filePath, rawCard)
      skeletons.set(filePath, extractSkele({ card: rawCard }))
    } catch {
      // Parse or skeleton extraction failed for this file
    }
  }

  return {
    scanWorkspace(input) {
      const { folders } = input

      for (const folder of folders) {
        try {
          scanDir(folder)
        } catch {
          // Folder not accessible
        }
      }

      resolvePackageTemplates()

      function scanDir(dir: string): void {
        let entries: fs.Dirent[]
        try {
          entries = fs.readdirSync(dir, { withFileTypes: true })
        } catch {
          return
        }

        for (const entry of entries) {
          const full = path.join(dir, entry.name)
          if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
            scanDir(full)
          } else if (entry.isFile() && entry.name.endsWith('.tree')) {
            indexWorkspaceFile(full)
          }
        }
      }
    },

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

        // Update skeleton for this file (for cross-file resolution)
        if (extractSkele) {
          try {
            rawCards.set(doc.file, rawCard)
            skeletons.set(doc.file, extractSkele({ card: rawCard }))
            resolvePackageTemplates()
          } catch {
            // Skeleton extraction failed, continue without
          }
        }

        // Expand fuse with package-wide trees for cross-file template support
        const card = expandFuse({
          card: rawCard,
          externalTrees: packageTrees.size > 0 ? packageTrees : undefined,
        })

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

      // Build merged book from all open files + stdlib imports
      const mergedBook: Book = new Map()
      const allErrors: Map<string, Kink[]> = new Map()
      const processedStdlib = new Set<string>()

      for (const doc of docs.allFiles()) {
        if (!doc.card || !doc.open) continue

        // Resolve stdlib imports into the merged book
        if (resolveStdlibFn && desugar) {
          for (const node of doc.card.list) {
            if (node.form === 'load') {
              const loadPath = (node as any).path?.join('/')
              if (loadPath?.startsWith('@') && !processedStdlib.has(loadPath)) {
                processedStdlib.add(loadPath)
                try {
                  const stdCard = resolveStdlibFn({ loadPath, parse })
                  if (stdCard) {
                    const stdResult = desugar({ card: stdCard })
                    for (const [name, term] of stdResult.book) {
                      mergedBook.set(name, term)
                    }
                  }
                } catch {
                  // Stdlib resolution failed for this import
                }
              }
            }
          }
        }

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

      // Also desugar workspace files (not open) into the book for type checking
      for (const [filePath, rawCard] of rawCards) {
        const isOpen = docs.allFiles().some(d => d.file === filePath && d.open)
        if (isOpen) continue

        try {
          const card = expandFuse({
            card: rawCard,
            externalTrees: packageTrees.size > 0 ? packageTrees : undefined,
          })
          const result = desugar({ card })
          for (const [name, term] of result.book) {
            if (!mergedBook.has(name)) {
              mergedBook.set(name, term)
            }
          }
        } catch {
          // Desugar failed for workspace file, skip
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
