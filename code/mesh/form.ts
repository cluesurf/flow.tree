/**
 * Type definitions mirroring mesh.tree's types.
 *
 * These are defined locally so make.tree can compile independently
 * without importing mesh.tree source files (which causes rootDir conflicts).
 * The actual implementations are injected at runtime via host/main.ts.
 */

/** A position in a source file (1-indexed). */
export type Slot = {
  line: number
  mark: number
}

export type Site = BrewSite | CardSite

export type BrewSite = {
  form: 'brew-site'
}

export type CardSite = {
  form: 'card-site'
  link: string
  base: Slot
  head: Slot
}

/** Error severity levels. */
export type KinkRank = 'halt' | 'tell' | 'hint'

/** Base error shape. */
export type Kink = {
  form: string
  rank: KinkRank
  site: Site
  text: string
}

/** Surface AST node mixin. */
export type SurfMixin = {
  form: string
  site: Site
}

export type SurfType =
  | { form: 'type-name'; name: string; args?: SurfType[] }
  | { form: 'type-or'; list: SurfType[] }
  | { form: 'type-and'; list: SurfType[] }
  | { form: 'type-fn'; params: SurfType[]; ret?: SurfType }

export type SurfHead = SurfMixin & { form: 'head'; name: string; need?: string; fall?: Surf }
export type SurfBase = SurfMixin & { form: 'base'; name: string; like?: SurfType; fall?: Surf }
export type SurfLink = SurfMixin & { form: 'link'; name: string; like?: SurfType }
export type SurfCaseArm = SurfMixin & { form: 'case-arm'; name: string; link: SurfLink[] }
export type SurfBind = SurfMixin & { form: 'bind'; name: string; sift?: Surf }

export type SurfTask = SurfMixin & {
  form: 'task'
  name: string
  head: SurfHead[]
  base: SurfBase[]
  flow: Surf[]
  task: SurfTask[]
  like?: SurfType
  risk?: boolean
  wait?: boolean
  hide?: boolean
  firm?: boolean
}

export type SurfForm = SurfMixin & {
  form: 'form'
  name: string
  head: SurfHead[]
  link: SurfLink[]
  case: SurfCaseArm[]
  bond: Surf[]
  task: SurfTask[]
  wear: SurfWear[]
  like?: SurfType
  hide?: boolean
  firm?: boolean
  hold?: Surf[]
}

export type SurfMask = SurfMixin & { form: 'mask'; name: string; task: SurfTask[] }
export type SurfSuit = SurfMixin & { form: 'suit'; name: string; wear: SurfWear[] }
export type SurfWear = SurfMixin & { form: 'wear'; name: string; task: SurfTask[] }
export type SurfTest = SurfMixin & { form: 'test'; name: string; flow: Surf[] }
export type SurfBook = SurfMixin & { form: 'book'; name: string; list: Surf[] }

export type SurfCall = SurfMixin & {
  form: 'call'
  name: string
  bind: SurfBind[]
  hook: Record<string, SurfHook>
  halt?: boolean
  wait?: boolean
}

export type SurfBack = SurfMixin & { form: 'back'; sift?: Surf }
export type SurfHalt = SurfMixin & { form: 'halt'; term?: string; sift?: Surf }
export type SurfRest = SurfMixin & { form: 'rest' }
export type SurfNext = SurfMixin & { form: 'next' }
export type SurfSlot = SurfMixin & { form: 'slot'; name: string }
export type SurfBeam = SurfMixin & { form: 'beam'; name: string; flow: Surf[] }
export type SurfMeet = SurfMixin & { form: 'meet'; mode: 'and' | 'or'; list: Surf[] }

export type SurfFork = SurfMixin & { form: 'fork'; mode: string; sift?: Surf; hook: SurfHook[] }
export type SurfWalk = SurfMixin & { form: 'walk'; mode: string; sift?: Surf; hook: SurfHook[] }
export type SurfHook = SurfMixin & { form: 'hook'; name: string; base: SurfBase[]; flow: Surf[] }

export type SurfSave = SurfMixin & { form: 'save'; path: string[]; sift?: Surf }
export type SurfHost = SurfMixin & { form: 'host'; name: string; sift?: Surf; list?: Surf[] }
export type SurfMake = SurfMixin & { form: 'make'; name: string; bind: SurfBind[] }

export type SurfLoad = SurfMixin & {
  form: 'load'
  path: string[]
  name?: string
  find: SurfFind[]
  hook: SurfLoadHook[]
  dock?: boolean
}

export type SurfFind = SurfMixin & { form: 'find'; name: string; kind?: string; alias?: string }
export type SurfLoadHook = SurfMixin & { form: 'load-hook'; kind: string; name: string }
export type SurfBear = SurfMixin & { form: 'bear'; path: string[] }

export type SurfTree = SurfMixin & { form: 'tree'; name: string; base: SurfBase[]; hook: SurfTreeHook[] }
export type SurfTreeHook = SurfMixin & { form: 'tree-hook'; name: string; list: Surf[] }
export type SurfFuse = SurfMixin & { form: 'fuse'; name: string; bind: SurfBind[] }

export type SurfSiftLink = SurfMixin & { form: 'sift-link'; path: string[]; safe?: boolean }
export type SurfSiftRead = SurfMixin & { form: 'sift-read'; path: string[]; safe?: boolean }
export type SurfSiftText = SurfMixin & { form: 'sift-text'; val: string }
export type SurfSiftMark = SurfMixin & { form: 'sift-mark'; val: number }
export type SurfSiftWave = SurfMixin & { form: 'sift-wave'; val: boolean }

export type SurfShow = SurfMixin & { form: 'show'; sift?: Surf }
export type SurfDive = SurfMixin & { form: 'dive'; sift?: Surf }
export type SurfHint = SurfMixin & { form: 'hint-log'; sift?: Surf }
export type SurfTell = SurfMixin & { form: 'tell'; sift?: Surf }
export type SurfKink = SurfMixin & { form: 'kink-log'; sift?: Surf }
export type SurfBust = SurfMixin & { form: 'bust'; sift?: Surf }
export type SurfBond = SurfMixin & { form: 'bond'; name: string; call: Surf[] }

export type Surf =
  | SurfTask | SurfForm | SurfMask | SurfSuit | SurfWear | SurfTest
  | SurfHead | SurfBase | SurfLink | SurfCaseArm | SurfBond
  | SurfBind | SurfSave | SurfHost | SurfMake
  | SurfCall | SurfBack | SurfHalt | SurfRest | SurfNext | SurfMeet
  | SurfFork | SurfWalk | SurfHook | SurfSlot | SurfBeam
  | SurfBear | SurfLoad | SurfFind | SurfLoadHook
  | SurfTree | SurfTreeHook | SurfFuse
  | SurfSiftLink | SurfSiftRead | SurfSiftText | SurfSiftMark | SurfSiftWave
  | SurfBook | SurfShow | SurfDive | SurfHint | SurfTell | SurfKink | SurfBust

export type SurfCard = {
  file: string
  list: Surf[]
}

/** Opaque type for core terms produced by desugar. */
export type Book = Map<string, any>

/** Result from tolerant desugar. */
export type DesugarResult = {
  book: Book
  asyncMeta: Map<string, boolean>
  errors: Kink[]
}

/** Skeleton types mirroring mesh.tree's resolve/skeleton. */
export type FileSkele = {
  file: string
  staticNames: Map<string, any>
  trees: Map<string, any>
  fuses: any[]
  loads: any[]
  card: SurfCard
}

export type ResolverState = {
  files: Map<string, FileSkele>
  known: Map<string, any>
  pending: any[]
  watchers: any
  trees: Map<string, any>
  generation: number
  errors: Array<{ form: string; file: string; name: string; detail: string }>
}

/** Functions injected from mesh.tree at runtime. */
export type MeshBindings = {
  parse: (input: { file: string; text: string }) => { tree: any } | null
  readCard: (input: { tree: any; file: string }) => SurfCard
  expandFuse: (input: { card: SurfCard; externalTrees?: Map<string, SurfTree> }) => SurfCard
  desugarCardTolerant?: (input: { card: SurfCard }) => DesugarResult
  check?: (input: { term: any; book: Book }) => { state: any; value: any } | null
  extractSkele?: (input: { card: SurfCard }) => FileSkele
  initResolver?: (input: { skeletons: Map<string, FileSkele> }) => ResolverState
  resolveTemplates?: (input: { state: ResolverState }) => ResolverState
  resolveStdlib?: (input: { loadPath: string; parse: (input: { file: string; text: string }) => { tree: any } | null }) => SurfCard | null
}
