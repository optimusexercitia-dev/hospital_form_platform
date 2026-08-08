import { evalVisibility, type AnswerMap } from '@/lib/queries/conditions'
import type { Item, Section } from '@/lib/queries/forms'
import {
  getResponseForFill,
  type GroupInstance,
  type ResponseForFill,
} from '@/lib/queries/responses'
import { getResponseSignoffs } from '@/lib/queries/signoffs'
import { getResponsePrintContext } from '@/lib/queries/printed-documents'
import { formatDate } from '@/lib/pdf/format'
import type {
  DocumentPayload,
  FormResponseDocumentItem,
  FormResponseDocumentSection,
  SignatureAttestation,
} from '@/lib/pdf/types'

/**
 * The form_response DATA PROVIDER (PDF·P1; ADR 0104 D15 layout — the domain
 * owns its payload mapper; plan §2.3). Reads run UNDER THE CALLER'S SESSION
 * via `src/lib/queries/` (Rule 9): a caller who cannot read the response gets
 * null legs and the mint fails closed — the provider grants nothing.
 *
 * Visibility mirrors the wizard/`submit_response` exactly (Rule 3, one
 * evaluator per side): hidden sections are OMITTED from the document, hidden
 * items are omitted from their section, instance items evaluate against the
 * instance-overlaid map.
 */

/** Everything the mint action supplies that is not the domain's to know. */
export interface MintRenderContext {
  qr: DocumentPayload['qr']
  emission: DocumentPayload['emission']
}

const SIGNOFF_ROLE_LABEL: Record<string, string> = {
  respondent: 'Responsável pelo preenchimento',
  staff_admin: 'Coordenação da comissão',
}

/** Choice code(s) → option label(s); falls back to the raw code so an answer is
 * never silently dropped (an unmapped code is a data question, not a blank). */
function optionLabels(item: Item, codes: string[]): string[] {
  const byCode = new Map(
    (item.options ?? []).map((o) => [o.code, o.label] as const),
  )
  return codes.map((code) => byCode.get(code) ?? code)
}

interface ScopeMaps {
  answersByItemId: Record<string, unknown>
  answersByKey: AnswerMap
  observationsByItemId: Record<string, string>
  otherTextByItemId: Record<string, string>
  matrixCellsByItemId: Record<string, Record<string, string>>
  riskMatrixByItemId: ResponseForFill['riskMatrixByItemId']
  referencesByItemId: ResponseForFill['referencesByItemId']
}

/** Pre-format one input item's answer as the printed pt-BR string, or null =
 * unanswered (the template renders "— não respondido —"). */
function formatItemValue(item: Item, scope: ScopeMaps): string | null {
  const raw = scope.answersByItemId[item.id]
  const lines: string[] = []

  switch (item.itemType) {
    case 'multiple_choice':
    case 'dropdown': {
      if (typeof raw === 'string' && raw !== '') {
        lines.push(optionLabels(item, [raw]).join(', '))
      }
      break
    }
    case 'checkbox': {
      if (Array.isArray(raw) && raw.length > 0) {
        lines.push(optionLabels(item, raw as string[]).join(', '))
      }
      break
    }
    case 'date': {
      if (typeof raw === 'string' && raw !== '') lines.push(formatDate(raw))
      break
    }
    case 'number': {
      if (typeof raw === 'number') lines.push(String(raw))
      else if (typeof raw === 'string' && raw !== '') lines.push(raw)
      break
    }
    case 'free_text':
    case 'short_text':
    case 'time': {
      if (typeof raw === 'string' && raw !== '') lines.push(raw)
      break
    }
    case 'matrix': {
      const grid = scope.matrixCellsByItemId[item.id] ?? {}
      const cols = new Map(
        (item.matrixColumns ?? []).map((c) => [c.code, c.label] as const),
      )
      for (const rowAxis of item.matrixRows ?? []) {
        const colCode = grid[rowAxis.code]
        if (colCode) {
          lines.push(`${rowAxis.label}: ${cols.get(colCode) ?? colCode}`)
        }
      }
      break
    }
    case 'risk_matrix': {
      const risk = scope.riskMatrixByItemId[item.id]
      if (risk) {
        const sev = optionAxisLabel(item.matrixRows ?? [], risk.severity)
        const lik = optionAxisLabel(item.matrixColumns ?? [], risk.likelihood)
        const score =
          risk.riskScore === null ? '' : ` · Pontuação: ${risk.riskScore}`
        lines.push(`Severidade: ${sev} · Probabilidade: ${lik}${score}`)
      }
      break
    }
    case 'reference': {
      const ref = scope.referencesByItemId[item.id]
      if (ref) {
        const label = [ref.label, ref.sublabel].filter(Boolean).join(' — ')
        lines.push(label || '—')
      }
      break
    }
    default:
      break
  }

  const other = scope.otherTextByItemId[item.id]
  if (other) lines.push(`Outro: ${other}`)
  const observation = scope.observationsByItemId[item.id]
  if (observation) lines.push(`Observação: ${observation}`)

  return lines.length > 0 ? lines.join('\n') : null
}

function optionAxisLabel(
  axis: NonNullable<Item['matrixRows']>,
  code: string,
): string {
  return axis.find((a) => a.code === code)?.label ?? code
}

/** Flatten one item (and container children / group instances) into printed
 * rows, honoring item visibility against the scope's answer map. */
function itemRows(
  item: Item,
  scope: ScopeMaps,
  instancesByGroup: Map<string, GroupInstance[]>,
): FormResponseDocumentItem[] {
  if (!evalVisibility(item.visibleWhen, scope.answersByKey)) return []

  switch (item.itemType) {
    case 'section_text': {
      const md =
        item.content && 'markdown' in item.content ? item.content.markdown : ''
      return md ? [{ kind: 'display_text', label: md, value: null }] : []
    }
    case 'image': {
      const caption =
        item.content && 'caption' in item.content
          ? (item.content.caption ?? item.content.alt ?? null)
          : null
      return [
        { kind: 'display_text', label: caption ?? '[imagem do formulário]', value: null },
      ]
    }
    case 'group': {
      // Plain container: children answer at top level and render inline.
      return item.children.flatMap((child) =>
        itemRows(child, scope, instancesByGroup),
      )
    }
    case 'repeating_group': {
      const instances = instancesByGroup.get(item.id) ?? []
      const rows: FormResponseDocumentItem[] = []
      instances.forEach((instance, idx) => {
        rows.push({
          kind: 'display_text',
          label: `${item.label ?? 'Grupo'} — ocorrência ${idx + 1}`,
          value: null,
        })
        const instanceScope: ScopeMaps = {
          answersByItemId: instance.answersByItemId,
          answersByKey: instance.answersByKey,
          observationsByItemId: instance.observationsByItemId,
          otherTextByItemId: instance.otherTextByItemId,
          matrixCellsByItemId: instance.matrixCellsByItemId,
          riskMatrixByItemId: instance.riskMatrixByItemId,
          referencesByItemId: instance.referencesByItemId,
        }
        for (const child of item.children) {
          rows.push(...itemRows(child, instanceScope, instancesByGroup))
        }
      })
      return rows
    }
    default: {
      // Input item (scalar / choice / matrix / risk_matrix / reference).
      return [
        {
          kind: 'question',
          label: item.label ?? item.questionKey ?? '—',
          value: formatItemValue(item, scope),
        },
      ]
    }
  }
}

/**
 * Build the full {@link DocumentPayload} for a form response the caller can
 * read. Throws a pt-BR Error when the response is unreachable (the mint
 * surfaces it as the not-found/unauthorized failure — indistinguishable,
 * deliberately).
 */
export async function buildFormResponsePayload(
  responseId: string,
  ctx: MintRenderContext,
): Promise<DocumentPayload> {
  const [fill, context, signoffRecords] = await Promise.all([
    getResponseForFill(responseId),
    getResponsePrintContext(responseId),
    getResponseSignoffs(responseId),
  ])
  if (!fill || !context) {
    throw new Error('Registro não encontrado ou sem autorização de leitura.')
  }

  const topScope: ScopeMaps = {
    answersByItemId: fill.answersByItemId,
    answersByKey: fill.answersByKey,
    observationsByItemId: fill.observationsByItemId,
    otherTextByItemId: fill.otherTextByItemId,
    matrixCellsByItemId: fill.matrixCellsByItemId,
    riskMatrixByItemId: fill.riskMatrixByItemId,
    referencesByItemId: fill.referencesByItemId,
  }
  const instancesByGroup = new Map<string, GroupInstance[]>()
  for (const instance of fill.instances) {
    const list = instancesByGroup.get(instance.groupItemId) ?? []
    list.push(instance)
    instancesByGroup.set(instance.groupItemId, list)
  }

  const signoffBySection = new Map(
    signoffRecords.map((s) => [s.sectionId, s] as const),
  )

  const signatures: SignatureAttestation[] = []
  const sections: FormResponseDocumentSection[] = []
  for (const section of fill.tree.sections as Section[]) {
    // Section visibility — the same evaluator + map submit_response uses.
    if (!evalVisibility(section.visibleWhen, fill.answersByKey)) continue

    let signature: SignatureAttestation | null = null
    if (section.requiresSignoff) {
      const record = signoffBySection.get(section.id)
      if (record) {
        signature = {
          name: record.signedByName ?? 'Membro da comissão',
          title: section.signoffRole
            ? (SIGNOFF_ROLE_LABEL[section.signoffRole] ?? null)
            : null,
          scope: section.title,
          timestamp: record.signedAt,
          method: 'platform_signoff',
        }
        signatures.push(signature)
      }
    }

    sections.push({
      title: section.isDefault ? null : section.title,
      description: section.description,
      requiresSignoff: section.requiresSignoff,
      signature,
      items: section.items.flatMap((item) =>
        itemRows(item, topScope, instancesByGroup),
      ),
    })
  }

  return {
    letterhead: {
      hospitalName: context.hospitalName,
      hospitalAddress: null, // hospitals carry no address column (B0 finding)
      logoDataUri: null, // no per-hospital logo store yet — enters as data when one exists (D4)
      commissionName: context.commissionName,
    },
    watermarks: [fill.status === 'submitted' ? 'final' : 'draft'],
    signatures,
    qr: ctx.qr,
    emission: ctx.emission,
    containsPhi: false, // forms mint PHI-free only (D9 v1 scope)
    body: {
      kind: 'form_response',
      formTitle: fill.formTitle,
      versionNumber: fill.tree.versionNumber,
      respondentDisplay: context.respondentDisplay,
      responseStatus: fill.status === 'submitted' ? 'submitted' : 'in_progress',
      startedAt: fill.startedAt,
      submittedAt: context.submittedAt,
      sections,
    },
  }
}
