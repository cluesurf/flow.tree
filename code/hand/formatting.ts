/**
 * textDocument/formatting handler.
 *
 * Formats .tree files by normalizing indentation and spacing.
 * Works on the raw text since the Surface AST may lose comments.
 */

import type { TextEdit, Range } from '@/link/protocol'
import type { DocumentStore } from '@/hold/document'

export function handleFormatting(input: {
  docs: DocumentStore
  uri: string
  options: { tabSize: number; insertSpaces: boolean }
}): TextEdit[] {
  const { docs, uri, options } = input

  const doc = docs.get(uri)
  if (!doc) return []

  const original = doc.text
  const formatted = formatText({ text: original, tabSize: options.tabSize })

  if (formatted === original) return []

  const lines = original.split('\n')
  return [{
    range: {
      start: { line: 0, character: 0 },
      end: { line: lines.length - 1, character: lines[lines.length - 1]?.length ?? 0 },
    },
    newText: formatted,
  }]
}

function formatText(input: { text: string; tabSize: number }): string {
  const { text, tabSize } = input
  const lines = text.split('\n')
  const result: string[] = []
  const indent = ' '.repeat(tabSize)

  let prevBlank = false

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!
    const trimmed = raw.trim()

    // Preserve blank lines but collapse multiples to one
    if (trimmed === '') {
      if (!prevBlank && result.length > 0) {
        result.push('')
      }
      prevBlank = true
      continue
    }
    prevBlank = false

    // Normalize indentation: count current indent level, re-emit with spaces
    const currentIndent = raw.length - raw.trimStart().length
    const level = Math.round(currentIndent / tabSize)
    const normalized = indent.repeat(level) + trimmed

    // Ensure single space after keywords on same line
    result.push(normalizeSpacing(normalized))
  }

  // Remove trailing blank line
  while (result.length > 0 && result[result.length - 1] === '') {
    result.pop()
  }

  return result.join('\n') + '\n'
}

function normalizeSpacing(line: string): string {
  // Collapse multiple spaces to single (except leading indentation)
  const indent = line.length - line.trimStart().length
  const prefix = line.slice(0, indent)
  const content = line.slice(indent)

  // Collapse internal multiple spaces to one
  const normalized = content.replace(/  +/g, ' ')

  return prefix + normalized
}
