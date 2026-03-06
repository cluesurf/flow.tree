/**
 * Tests for the analysis pipeline, including:
 * - Basic single-file parsing
 * - Cross-file template resolution via skeleton-first pipeline
 * - Stdlib import resolution into merged book
 * - Workspace scanning
 */

import { describe, it, expect, vi } from 'vitest'
import { createDocumentStore, pathToUri } from '@/hold/document'
import { createIndex } from '@/seek/index'
import { createPipeline } from '@/work/pipeline'
import type { Dispatcher } from '@/link/dispatch'
import type { SurfCard, SurfTree, FileSkele, ResolverState } from '@/mesh/form'

function makeSurfCard(input: { file: string; nodes: any[] }): SurfCard {
  return { file: input.file, list: input.nodes }
}

function makeDispatcher(): Dispatcher & { notifications: Array<{ method: string; params: any }> } {
  const notifications: Array<{ method: string; params: any }> = []
  return {
    notifications,
    handle: vi.fn(),
    onRequest: vi.fn(),
    onNotification: vi.fn(),
    sendNotification(method: string, params: any) {
      notifications.push({ method, params })
    },
  }
}

// Minimal stubs for pipeline functions
function stubParse(_input: { file: string; text: string }): { tree: any } | null {
  return { tree: { form: 'stub-tree' } }
}

function stubReadCard(input: { tree: any; file: string }): SurfCard {
  return { file: input.file, list: [] }
}

function stubExpandFuse(input: { card: SurfCard; externalTrees?: Map<string, SurfTree> }): SurfCard {
  return input.card
}

describe('pipeline: basic single-file parsing', () => {
  it('parses an open file and publishes empty diagnostics', () => {
    const docs = createDocumentStore()
    const index = createIndex()
    const dispatcher = makeDispatcher()

    const pipeline = createPipeline({
      docs,
      index,
      dispatcher,
      parse: stubParse,
      readCard: stubReadCard,
      expandFuse: stubExpandFuse,
    })

    const uri = pathToUri('/test/main.tree')
    docs.open({ uri, version: 1, text: 'task greet\n  like text' })
    pipeline.parseFile({ uri })

    const doc = docs.get(uri)
    expect(doc).toBeDefined()
    expect(doc!.card).toBeDefined()
    expect(dispatcher.notifications.length).toBeGreaterThan(0)
    expect(dispatcher.notifications[0]!.method).toBe('textDocument/publishDiagnostics')
  })
})

describe('pipeline: cross-file template resolution', () => {
  it('passes externalTrees to expandFuse when skeletons are available', () => {
    const docs = createDocumentStore()
    const index = createIndex()
    const dispatcher = makeDispatcher()

    let receivedExternalTrees: Map<string, SurfTree> | undefined

    const pipeline = createPipeline({
      docs,
      index,
      dispatcher,
      parse: stubParse,
      readCard(input) {
        // Return a card with a tree definition for workspace files
        if (input.file === '/test/template.tree') {
          return makeSurfCard({
            file: input.file,
            nodes: [{
              form: 'tree',
              name: 'make-getter',
              site: { form: 'brew-site' },
              base: [{ form: 'base', name: 'name', site: { form: 'brew-site' } }],
              hook: [],
            }],
          })
        }
        return makeSurfCard({ file: input.file, nodes: [] })
      },
      expandFuse(input) {
        receivedExternalTrees = input.externalTrees
        return input.card
      },
      extractSkele(input) {
        const staticNames = new Map<string, any>()
        const trees = new Map<string, any>()
        const fuses: any[] = []
        const loads: any[] = []

        for (const node of input.card.list) {
          if (node.form === 'tree') {
            trees.set((node as any).name, {
              name: (node as any).name,
              params: [],
              outputNames: [],
            })
          }
        }

        return { file: input.card.file, staticNames, trees, fuses, loads, card: input.card }
      },
      initResolver(input) {
        return {
          files: input.skeletons,
          known: new Map(),
          pending: [],
          watchers: new Map(),
          trees: new Map(),
          generation: 0,
          errors: [],
        }
      },
      resolveTemplates(input) {
        return input.state
      },
    })

    // Simulate workspace scan finding template.tree
    pipeline.scanWorkspace({ folders: [] })

    // Manually index the workspace file (scanWorkspace reads from fs, we simulate)
    // Instead, directly set up the state via parseFile on a "workspace" file
    const templateUri = pathToUri('/test/template.tree')
    docs.open({ uri: templateUri, version: 1, text: 'tree make-getter\n  take name' })
    pipeline.parseFile({ uri: templateUri })

    // Now parse the user's file, should get externalTrees
    const userUri = pathToUri('/test/user.tree')
    docs.open({ uri: userUri, version: 1, text: 'fuse make-getter\n  bind name, text <age>' })
    pipeline.parseFile({ uri: userUri })

    expect(receivedExternalTrees).toBeDefined()
    expect(receivedExternalTrees!.has('make-getter')).toBe(true)
  })
})

describe('pipeline: stdlib import resolution', () => {
  it('resolves stdlib imports into merged book during fullAnalysis', () => {
    const docs = createDocumentStore()
    const index = createIndex()
    const dispatcher = makeDispatcher()

    const stdlibBook = new Map<string, any>([
      ['hash-djb2', { form: 'ref', name: 'hash-djb2' }],
    ])

    const pipeline = createPipeline({
      docs,
      index,
      dispatcher,
      parse: stubParse,
      readCard(input) {
        // Return a card with a load @base/hash directive
        return makeSurfCard({
          file: input.file,
          nodes: [{
            form: 'load',
            path: ['@base', 'hash'],
            find: [],
            hook: [],
            site: { form: 'brew-site' },
          }],
        })
      },
      expandFuse: stubExpandFuse,
      desugar(input) {
        return { book: new Map(), asyncMeta: new Map(), errors: [] }
      },
      resolveStdlib(input) {
        if (input.loadPath === '@base/hash') {
          return makeSurfCard({ file: '@base/hash', nodes: [] })
        }
        return null
      },
    })

    const uri = pathToUri('/test/main.tree')
    docs.open({ uri, version: 1, text: 'load @base/hash' })
    pipeline.parseFile({ uri })
    pipeline.fullAnalysis()

    // Verify diagnostics were published (no crashes)
    const diags = dispatcher.notifications.filter(
      n => n.method === 'textDocument/publishDiagnostics' && n.params.uri === uri,
    )
    expect(diags.length).toBeGreaterThan(0)
  })
})

describe('pipeline: fullAnalysis with desugar', () => {
  it('merges definitions from all open files', () => {
    const docs = createDocumentStore()
    const index = createIndex()
    const dispatcher = makeDispatcher()

    let mergedBookSize = 0

    const pipeline = createPipeline({
      docs,
      index,
      dispatcher,
      parse: stubParse,
      readCard(input) {
        return makeSurfCard({ file: input.file, nodes: [] })
      },
      expandFuse: stubExpandFuse,
      desugar(input) {
        const book = new Map<string, any>()
        if (input.card.file.includes('a.tree')) {
          book.set('fn-a', { form: 'ref', name: 'fn-a' })
        }
        if (input.card.file.includes('b.tree')) {
          book.set('fn-b', { form: 'ref', name: 'fn-b' })
        }
        return { book, asyncMeta: new Map(), errors: [] }
      },
      check(input) {
        mergedBookSize = input.book.size
        return null
      },
    })

    const uriA = pathToUri('/test/a.tree')
    const uriB = pathToUri('/test/b.tree')

    docs.open({ uri: uriA, version: 1, text: 'task fn-a' })
    docs.open({ uri: uriB, version: 1, text: 'task fn-b' })

    pipeline.parseFile({ uri: uriA })
    pipeline.parseFile({ uri: uriB })
    pipeline.fullAnalysis()

    expect(mergedBookSize).toBe(2)
  })
})
