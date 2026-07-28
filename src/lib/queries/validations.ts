import { createClient } from '@/lib/supabase/server'
import type {
  ValidationErrorRow,
  ValidationRuleType,
  ValidationSeverity,
} from '@/lib/forms/validation-rules'

/**
 * FF-3 (ADR 0090 §3) — the SERVER half of the validation contract: the one RPC
 * read, plus a re-export of the whole pure surface so existing server callers
 * (and `src/lib/queries/` convention, Rule 9) keep importing from one module.
 *
 * The pure half lives in `@/lib/forms/validation-rules` because the builder and
 * the wizard value-import it in the BROWSER, and this module imports
 * `@/lib/supabase/server` (which is `import 'server-only'`). Keeping them in one
 * file made every client import of `evalValidation` a `next build` abort —
 * BUG-FBE-005, which tsc/lint/Vitest cannot see. Same split, same reason, as
 * `src/lib/forms/matrix.ts` beside its query module.
 */

// Everything pure — types, vocabulary, evaluator — re-exported unchanged.
export * from '@/lib/forms/validation-rules'

/** The raw RPC row shape (snake_case), before {@link toValidationErrorRow}. */
interface ValidationErrorRpcRow {
  item_id: string
  group_instance_id: string | null
  rule_id: string | null
  rule_type: string
  severity: string
  message: string
}

function toValidationErrorRow(row: ValidationErrorRpcRow): ValidationErrorRow {
  return {
    itemId: row.item_id,
    groupInstanceId: row.group_instance_id,
    ruleId: row.rule_id,
    // The DB pins both vocabularies with CHECKs; the cast records that the
    // widening from `string` is the DB's guarantee, not an assumption here.
    ruleType: row.rule_type as ValidationRuleType,
    severity: row.severity as ValidationSeverity,
    message: row.message,
  }
}

/**
 * Every violation on a response, `error` and `warn` alike, in document order.
 *
 * This is the SAME `app` predicate `submit_response` gates on, which is what
 * makes "the list the user sees" and "the gate that blocks them" one thing.
 * Returns `[]` when the flag is off or the caller cannot read the response.
 */
export async function getResponseValidationErrors(
  responseId: string,
): Promise<ValidationErrorRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc(
    'get_response_validation_errors',
    { p_response_id: responseId },
  )
  if (error || !data) return []
  return (data as unknown as ValidationErrorRpcRow[]).map(toValidationErrorRow)
}
