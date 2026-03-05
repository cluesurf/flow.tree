/**
 * Diagnostics handler: convert Kinks to LSP Diagnostics.
 *
 * This module is used by the pipeline. The actual publishDiagnostics
 * notification is sent from pipeline.ts.
 */

import type { Diagnostic } from '@/link/protocol'
import { DIAGNOSTIC_SEVERITY } from '@/link/protocol'
import type { Kink, CardSite } from '@/mesh/form'

export function kinksToDignostics(input: { kinks: Kink[] }): Diagnostic[] {
  const result: Diagnostic[] = []

  for (const kink of input.kinks) {
    const diag = kinkToDiagnostic({ kink })
    if (diag) result.push(diag)
  }

  return result
}

function kinkToDiagnostic(input: { kink: Kink }): Diagnostic | null {
  const { kink } = input
  if (kink.site.form !== 'card-site') return null

  const site = kink.site as CardSite

  return {
    range: {
      start: { line: site.base.line - 1, character: site.base.mark - 1 },
      end: { line: site.head.line - 1, character: site.head.mark - 1 },
    },
    severity: kink.rank === 'halt'
      ? DIAGNOSTIC_SEVERITY.Error
      : kink.rank === 'tell'
        ? DIAGNOSTIC_SEVERITY.Warning
        : DIAGNOSTIC_SEVERITY.Information,
    source: 'seed',
    message: kink.text,
    code: kink.form,
  }
}
