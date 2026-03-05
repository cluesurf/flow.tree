/**
 * Minimal LSP type definitions.
 *
 * Only the subset we actually use. No external dependency.
 */

export type Position = {
  line: number
  character: number
}

export type Range = {
  start: Position
  end: Position
}

export type Location = {
  uri: string
  range: Range
}

export type TextDocumentIdentifier = {
  uri: string
}

export type VersionedTextDocumentIdentifier = TextDocumentIdentifier & {
  version: number
}

export type TextDocumentItem = {
  uri: string
  languageId: string
  version: number
  text: string
}

export type TextDocumentContentChangeEvent = {
  range?: Range
  text: string
}

export type DiagnosticSeverity = 1 | 2 | 3 | 4

export const DIAGNOSTIC_SEVERITY = {
  Error: 1 as DiagnosticSeverity,
  Warning: 2 as DiagnosticSeverity,
  Information: 3 as DiagnosticSeverity,
  Hint: 4 as DiagnosticSeverity,
}

export type DiagnosticRelatedInformation = {
  location: Location
  message: string
}

export type Diagnostic = {
  range: Range
  severity?: DiagnosticSeverity
  code?: string | number
  source?: string
  message: string
  relatedInformation?: DiagnosticRelatedInformation[]
}

export type CompletionItemKind = number

export const COMPLETION_ITEM_KIND = {
  Text: 1,
  Method: 2,
  Function: 3,
  Constructor: 4,
  Field: 5,
  Variable: 6,
  Class: 7,
  Interface: 8,
  Module: 9,
  Property: 10,
  Unit: 11,
  Value: 12,
  Enum: 13,
  Keyword: 14,
  Snippet: 15,
  Color: 16,
  File: 17,
  Reference: 18,
  Folder: 19,
  EnumMember: 20,
  Constant: 21,
  Struct: 22,
  Event: 23,
  Operator: 24,
  TypeParameter: 25,
}

export type CompletionItem = {
  label: string
  kind?: CompletionItemKind
  detail?: string
  documentation?: string | MarkupContent
  sortText?: string
  filterText?: string
  insertText?: string
  insertTextFormat?: 1 | 2
}

export type CompletionList = {
  isIncomplete: boolean
  items: CompletionItem[]
}

export type MarkupContent = {
  kind: 'plaintext' | 'markdown'
  value: string
}

export type Hover = {
  contents: MarkupContent
  range?: Range
}

export type SymbolKind = number

export const SYMBOL_KIND = {
  File: 1,
  Module: 2,
  Namespace: 3,
  Package: 4,
  Class: 5,
  Method: 6,
  Property: 7,
  Field: 8,
  Constructor: 9,
  Enum: 10,
  Interface: 11,
  Function: 12,
  Variable: 13,
  Constant: 14,
  String: 15,
  Number: 16,
  Boolean: 17,
  Array: 18,
  Object: 19,
  Key: 20,
  Null: 21,
  EnumMember: 22,
  Struct: 23,
  Event: 24,
  Operator: 25,
  TypeParameter: 26,
}

export type DocumentSymbol = {
  name: string
  detail?: string
  kind: SymbolKind
  range: Range
  selectionRange: Range
  children?: DocumentSymbol[]
}

export type TextDocumentSyncKind = 0 | 1 | 2

export const TEXT_DOCUMENT_SYNC_KIND = {
  None: 0 as TextDocumentSyncKind,
  Full: 1 as TextDocumentSyncKind,
  Incremental: 2 as TextDocumentSyncKind,
}

export type ServerCapabilities = {
  textDocumentSync?: TextDocumentSyncKind
  completionProvider?: {
    triggerCharacters?: string[]
    resolveProvider?: boolean
  }
  hoverProvider?: boolean
  definitionProvider?: boolean
  referencesProvider?: boolean
  documentSymbolProvider?: boolean
  workspaceSymbolProvider?: boolean
  renameProvider?: boolean | { prepareProvider?: boolean }
  codeActionProvider?: boolean
  foldingRangeProvider?: boolean
}

export type InitializeResult = {
  capabilities: ServerCapabilities
}

export type FoldingRange = {
  startLine: number
  startCharacter?: number
  endLine: number
  endCharacter?: number
  kind?: 'comment' | 'imports' | 'region'
}

export type SignatureHelp = {
  signatures: SignatureInformation[]
  activeSignature?: number
  activeParameter?: number
}

export type SignatureInformation = {
  label: string
  documentation?: string | MarkupContent
  parameters?: ParameterInformation[]
}

export type ParameterInformation = {
  label: string | [number, number]
  documentation?: string | MarkupContent
}

export type WorkspaceEdit = {
  changes?: Record<string, TextEdit[]>
}

export type TextEdit = {
  range: Range
  newText: string
}
