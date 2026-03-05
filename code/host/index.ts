/**
 * Seed Language Server entry point.
 *
 * Starts an LSP server over stdio, wiring together:
 * - Transport (Content-Length framed JSON-RPC)
 * - Document management
 * - Analysis pipeline (parse -> index -> desugar -> type check -> diagnostics)
 * - LSP request handlers
 */

import { createReader, writeMessage } from '@/link/transport'
import { createDispatcher } from '@/link/dispatch'
import { createDocumentStore, uriToPath } from '@/hold/document'
import { createIndex } from '@/seek/index'
import { createPipeline } from '@/work/pipeline'
import { createScheduler } from '@/work/schedule'
import { handleHover } from '@/hand/hover'
import { handleDefinition } from '@/hand/definition'
import { handleCompletion } from '@/hand/completion'
import { handleDocumentSymbols } from '@/hand/symbols'
import { handleReferences } from '@/hand/references'
import { handleFoldingRanges } from '@/hand/folding'
import { handleRename, handlePrepareRename } from '@/hand/rename'
import { handleSignatureHelp } from '@/hand/signature'
import { handleWorkspaceSymbols } from '@/hand/workspace'
import { handleSemanticTokensFull, TOKEN_TYPES, TOKEN_MODIFIERS } from '@/hand/semantic'
import { handleFormatting } from '@/hand/formatting'
import { handleInlayHints, updateBenchmarkCache } from '@/hand/hints'
import { handleCodeActions } from '@/hand/actions'
import { handleCodeLens } from '@/hand/lens'
import {
  TEXT_DOCUMENT_SYNC_KIND,
  type InitializeResult,
} from '@/link/protocol'
import type { SurfCard, DesugarResult, Book } from '@/mesh/form'

export function startServer(input: {
  parse: (input: { file: string; text: string }) => { tree: any } | null
  readCard: (input: { tree: any; file: string }) => any
  expandFuse: (input: { card: any }) => any
  desugarCardTolerant?: (input: { card: SurfCard }) => DesugarResult
  check?: (input: { term: any; book: Book }) => { state: any; value: any } | null
}): void {
  const docs = createDocumentStore()
  const index = createIndex()
  const dispatcher = createDispatcher({ output: process.stdout })
  const scheduler = createScheduler({ debounceMs: 150 })

  const pipeline = createPipeline({
    docs,
    index,
    dispatcher,
    parse: input.parse,
    readCard: input.readCard,
    expandFuse: input.expandFuse,
    desugar: input.desugarCardTolerant,
    check: input.check,
  })

  // -- Lifecycle --

  dispatcher.onRequest('initialize', (_params): InitializeResult => {
    return {
      capabilities: {
        textDocumentSync: TEXT_DOCUMENT_SYNC_KIND.Incremental,
        completionProvider: {
          triggerCharacters: [' ', '.', '/'],
          resolveProvider: false,
        },
        signatureHelpProvider: {
          triggerCharacters: [' ', '\n'],
        },
        hoverProvider: true,
        definitionProvider: true,
        referencesProvider: true,
        documentSymbolProvider: true,
        workspaceSymbolProvider: true,
        renameProvider: { prepareProvider: true },
        foldingRangeProvider: true,
        documentFormattingProvider: true,
        semanticTokensProvider: {
          legend: { tokenTypes: TOKEN_TYPES, tokenModifiers: TOKEN_MODIFIERS },
          full: true,
        },
        inlayHintProvider: true,
        codeActionProvider: true,
        codeLensProvider: { resolveProvider: false },
      },
    }
  })

  dispatcher.onNotification('initialized', () => {
    // Server is ready.
  })

  dispatcher.onRequest('shutdown', () => {
    scheduler.dispose()
    return null
  })

  dispatcher.onNotification('exit', () => {
    process.exit(0)
  })

  // -- Document Sync --

  dispatcher.onNotification('textDocument/didOpen', (params: any) => {
    const { textDocument } = params
    docs.open({
      uri: textDocument.uri,
      version: textDocument.version,
      text: textDocument.text,
    })

    scheduler.scheduleImmediate(() => {
      pipeline.parseFile({ uri: textDocument.uri })
    })
  })

  dispatcher.onNotification('textDocument/didChange', (params: any) => {
    const { textDocument, contentChanges } = params
    docs.change({
      uri: textDocument.uri,
      version: textDocument.version,
      changes: contentChanges,
    })

    scheduler.scheduleImmediate(() => {
      pipeline.parseFile({ uri: textDocument.uri })
    })

    scheduler.scheduleDebounced(() => {
      pipeline.fullAnalysis()
    })
  })

  dispatcher.onNotification('textDocument/didClose', (params: any) => {
    docs.close({ uri: params.textDocument.uri })
  })

  dispatcher.onNotification('textDocument/didSave', (params: any) => {
    pipeline.parseFile({ uri: params.textDocument.uri })
    pipeline.fullAnalysis()
  })

  // -- Language Features --

  dispatcher.onRequest('textDocument/hover', (params: any) => {
    return handleHover({
      docs,
      index,
      uri: params.textDocument.uri,
      position: params.position,
    })
  })

  dispatcher.onRequest('textDocument/definition', (params: any) => {
    return handleDefinition({
      docs,
      index,
      uri: params.textDocument.uri,
      position: params.position,
    })
  })

  dispatcher.onRequest('textDocument/completion', (params: any) => {
    return handleCompletion({
      docs,
      index,
      uri: params.textDocument.uri,
      position: params.position,
    })
  })

  dispatcher.onRequest('textDocument/signatureHelp', (params: any) => {
    return handleSignatureHelp({
      docs,
      index,
      uri: params.textDocument.uri,
      position: params.position,
    })
  })

  dispatcher.onRequest('textDocument/documentSymbol', (params: any) => {
    return handleDocumentSymbols({
      docs,
      uri: params.textDocument.uri,
    })
  })

  dispatcher.onRequest('textDocument/references', (params: any) => {
    return handleReferences({
      docs,
      index,
      uri: params.textDocument.uri,
      position: params.position,
      includeDeclaration: params.context?.includeDeclaration ?? true,
    })
  })

  dispatcher.onRequest('textDocument/foldingRange', (params: any) => {
    return handleFoldingRanges({
      docs,
      uri: params.textDocument.uri,
    })
  })

  dispatcher.onRequest('textDocument/prepareRename', (params: any) => {
    return handlePrepareRename({
      docs,
      index,
      uri: params.textDocument.uri,
      position: params.position,
    })
  })

  dispatcher.onRequest('textDocument/rename', (params: any) => {
    return handleRename({
      docs,
      index,
      uri: params.textDocument.uri,
      position: params.position,
      newName: params.newName,
    })
  })

  dispatcher.onRequest('workspace/symbol', (params: any) => {
    return handleWorkspaceSymbols({
      index,
      query: params.query ?? '',
    })
  })

  dispatcher.onRequest('textDocument/semanticTokens/full', (params: any) => {
    return handleSemanticTokensFull({
      docs,
      uri: params.textDocument.uri,
    })
  })

  dispatcher.onRequest('textDocument/formatting', (params: any) => {
    return handleFormatting({
      docs,
      uri: params.textDocument.uri,
      options: params.options ?? { tabSize: 2, insertSpaces: true },
    })
  })

  dispatcher.onRequest('textDocument/inlayHint', (params: any) => {
    return handleInlayHints({
      docs,
      index,
      uri: params.textDocument.uri,
      range: params.range,
    })
  })

  dispatcher.onRequest('textDocument/codeAction', (params: any) => {
    return handleCodeActions({
      docs,
      index,
      uri: params.textDocument.uri,
      range: params.range,
      diagnostics: params.context?.diagnostics ?? [],
    })
  })

  dispatcher.onRequest('textDocument/codeLens', (params: any) => {
    return handleCodeLens({
      docs,
      index,
      uri: params.textDocument.uri,
    })
  })

  // -- Custom notifications --

  dispatcher.onNotification('seed/timeResults', (params: any) => {
    if (params.results && Array.isArray(params.results)) {
      updateBenchmarkCache({ results: params.results })
    }
  })

  // -- Start reading from stdin --

  createReader({
    stream: process.stdin,
    handler: (msg) => dispatcher.handle(msg),
  })
}
