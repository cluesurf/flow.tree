/**
 * Seed Language Server entry point.
 *
 * Starts an LSP server over stdio, wiring together:
 * - Transport (Content-Length framed JSON-RPC)
 * - Document management
 * - Analysis pipeline (parse -> index -> diagnostics)
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
import {
  TEXT_DOCUMENT_SYNC_KIND,
  type InitializeResult,
} from '@/link/protocol'

// These will be dynamically imported from mesh.tree.
// For now we use a lazy loader pattern so the server
// can start even if mesh.tree is not available.
let parseFn: ((input: { file: string; text: string }) => { tree: any } | null) | null = null
let readCardFn: ((input: { tree: any; file: string }) => any) | null = null
let expandFuseFn: ((input: { card: any }) => any) | null = null

export function startServer(input: {
  parse: (input: { file: string; text: string }) => { tree: any } | null
  readCard: (input: { tree: any; file: string }) => any
  expandFuse: (input: { card: any }) => any
}): void {
  parseFn = input.parse
  readCardFn = input.readCard
  expandFuseFn = input.expandFuse

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
        hoverProvider: true,
        definitionProvider: true,
        referencesProvider: true,
        documentSymbolProvider: true,
        foldingRangeProvider: true,
      },
    }
  })

  dispatcher.onNotification('initialized', () => {
    // Server is ready. Could trigger initial indexing here.
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

    // Fast parse immediately
    scheduler.scheduleImmediate(() => {
      pipeline.parseFile({ uri: textDocument.uri })
    })

    // Full analysis after debounce
    scheduler.scheduleDebounced(() => {
      pipeline.fullAnalysis()
    })
  })

  dispatcher.onNotification('textDocument/didClose', (params: any) => {
    docs.close({ uri: params.textDocument.uri })
  })

  dispatcher.onNotification('textDocument/didSave', (params: any) => {
    // Re-analyze on save without debounce
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

  // -- Start reading from stdin --

  createReader({
    stream: process.stdin,
    handler: (msg) => dispatcher.handle(msg),
  })
}
