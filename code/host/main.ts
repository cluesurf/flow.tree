/**
 * CLI entry point for the Seed language server.
 *
 * Usage: node host/main.js
 *
 * Dynamically imports the parser and compiler from mesh.tree
 * and @cluesurf/tree, then starts the LSP server.
 */

import { startServer } from '@/host/index'
import type { SurfCard, DesugarResult, Book } from '@/mesh/form'

async function main(): Promise<void> {
  // Dynamic imports to avoid rootDir conflicts at compile time.
  // These modules are resolved at runtime from sibling packages.
  let readCard: (input: { tree: any; file: string }) => SurfCard
  let expandFuse: (input: { card: SurfCard }) => SurfCard
  let parse: (input: { file: string; text: string }) => { tree: any } | null
  let desugarCardTolerant: ((input: { card: SurfCard }) => DesugarResult) | undefined
  let check: ((input: { term: any; book: Book }) => { state: any; value: any } | null) | undefined

  try {
    // mesh.tree's readCard and expandFuse (sibling package, resolved at runtime)
    // @ts-expect-error: runtime-resolved dynamic import
    const readModule = await import('../../mesh.tree/host/read/index.js')
    readCard = readModule.readCard ?? readModule.readCardTolerant
    // @ts-expect-error: runtime-resolved dynamic import
    const fuseModule = await import('../../mesh.tree/host/fuse/index.js')
    expandFuse = fuseModule.expandFuse
  } catch (e) {
    readCard = (input) => ({ file: input.file, list: [] })
    expandFuse = (input) => input.card
    process.stderr.write(`Warning: mesh.tree not available, using stubs: ${e}\n`)
  }

  try {
    // @ts-expect-error: runtime-resolved dynamic import
    const desugarModule = await import('../../mesh.tree/host/term/desugar.js')
    if (desugarModule.desugarCardTolerant) {
      desugarCardTolerant = desugarModule.desugarCardTolerant
    }
  } catch {
    // Desugar not available
  }

  try {
    // @ts-expect-error: runtime-resolved dynamic import
    const checkModule = await import('../../mesh.tree/host/term/check.js')
    if (checkModule.check) {
      check = checkModule.check
    }
  } catch {
    // Type checker not available
  }

  try {
    // @ts-expect-error: runtime-resolved dynamic import (local at ../../../../tree/host/)
    const treeModule = await import('../../../../tree/host/index.js')
    const treeParse = treeModule.default ?? treeModule.parse ?? treeModule
    parse = (input) => {
      try {
        const tree = typeof treeParse === 'function' ? treeParse(input.text) : null
        return tree ? { tree } : null
      } catch {
        return null
      }
    }
  } catch {
    parse = () => null
    process.stderr.write('Warning: @cluesurf/tree not available, parsing disabled\n')
  }

  startServer({ parse, readCard, expandFuse, desugarCardTolerant, check })
}

main()
