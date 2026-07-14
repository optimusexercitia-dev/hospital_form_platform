"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CornerDownRight, MessageCircleQuestion, MessageSquareText, Send } from "lucide-react";

import {
  postReferralMessage,
  provideReferralInformation,
  requestReferralInformation,
} from "@/lib/referrals/actions";
import { REFERRAL_MESSAGES } from "@/lib/referrals/messages";
import {
  RESOLVED_REFERRAL_STATUSES,
  type ReferralActionState,
  type ReferralStatus,
} from "@/lib/referrals/types";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/auth/form-banner";

const FIELD_CLASS =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

type ComposerModeKey = "respond" | "request" | "comment";

interface ComposerMode {
  key: ComposerModeKey;
  label: string;
  icon: typeof Send;
  placeholder: string;
  submit: (referralId: string, body: string) => Promise<ReferralActionState>;
}

/**
 * The dialogue composer (RV2 R1 — ADR 0037 Amendment 1). The write affordance for
 * the two-way clarification thread, gated by the viewer's COMPOSE AUTHORITY (the
 * `ReferralDetail.canComposeAs*` booleans, computed by the door with byte-for-gate
 * parity with the R1 RPCs — so a target ANALYST, not just a coordinator, may
 * compose) AND the referral status — mirroring the server RPCs, which re-check and
 * raise HC0A0/HC0A1:
 *  - **Responder** (`provide_referral_information`): SOURCE authority, only while
 *    `awaiting_information`.
 *  - **Solicitar informação** (`request_referral_information`): TARGET authority,
 *    only while `in_review`.
 *  - **Comentar** (`post_referral_message`, `general`): either side, while the
 *    referral is non-terminal.
 *
 * A `"use client"` island fed plain props; renders nothing when no action is
 * available for this viewer/status. The RPC is the authority — this gating is a
 * convenience so unusable controls never dangle.
 */
export function ReferralComposer({
  referralId,
  status,
  canComposeAsTarget,
  canComposeAsSource,
}: {
  referralId: string;
  status: ReferralStatus;
  /** Viewer may compose as the TARGET (target coordinator OR assigned analyst). */
  canComposeAsTarget: boolean;
  /** Viewer may compose as the SOURCE (source coordinator). */
  canComposeAsSource: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const isResolved = RESOLVED_REFERRAL_STATUSES.has(status);
  const canComment = (canComposeAsTarget || canComposeAsSource) && !isResolved;
  const canRequest = canComposeAsTarget && status === "in_review";
  const canRespond = canComposeAsSource && status === "awaiting_information";

  // Priority order: the status-specific act first, then the general comment.
  const modes: ComposerMode[] = [];
  if (canRespond) {
    modes.push({
      key: "respond",
      label: "Responder",
      icon: CornerDownRight,
      placeholder:
        "Escreva a resposta à solicitação de informação da comissão de destino…",
      submit: (id, b) => provideReferralInformation({ referralId: id, body: b }),
    });
  }
  if (canRequest) {
    modes.push({
      key: "request",
      label: "Solicitar informação",
      icon: MessageCircleQuestion,
      placeholder:
        "Descreva a informação que você precisa da comissão de origem para concluir a análise…",
      submit: (id, b) => requestReferralInformation({ referralId: id, body: b }),
    });
  }
  if (canComment) {
    modes.push({
      key: "comment",
      label: "Comentar",
      icon: MessageSquareText,
      placeholder: "Escreva um comentário para a outra comissão…",
      submit: (id, b) =>
        postReferralMessage({ referralId: id, messageType: "general", body: b }),
    });
  }

  const [modeKey, setModeKey] = useState<ComposerModeKey | null>(
    modes[0]?.key ?? null,
  );

  if (modes.length === 0) return null;

  // The active mode falls back to the first available (a status change between
  // renders can retire the previously-selected mode).
  const mode = modes.find((m) => m.key === modeKey) ?? modes[0];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldError(null);
    if (!body.trim()) {
      setFieldError(REFERRAL_MESSAGES.messageBodyRequired);
      return;
    }
    startTransition(async () => {
      const result = await mode.submit(referralId, body.trim());
      if (!result.ok) {
        if (result.fieldErrors?.body) setFieldError(result.fieldErrors.body);
        else setError(result.error ?? REFERRAL_MESSAGES.generic);
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  const Icon = mode.icon;

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4"
      noValidate
    >
      <h3 className="text-sm font-semibold">Nova mensagem</h3>

      {error && <FormBanner tone="error">{error}</FormBanner>}

      {modes.length > 1 && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="sr-only">Tipo de mensagem</legend>
          <div className="flex flex-wrap gap-1.5">
            {modes.map((m) => {
              const selected = m.key === mode.key;
              const MIcon = m.icon;
              return (
                <button
                  key={m.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setModeKey(m.key)}
                  className={
                    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none " +
                    (selected
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border text-muted-foreground hover:text-foreground")
                  }
                >
                  <MIcon aria-hidden="true" className="size-4" />
                  {m.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Mensagem</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          className={FIELD_CLASS}
          placeholder={mode.placeholder}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? "referral-composer-error" : undefined}
        />
        {fieldError && (
          <span
            id="referral-composer-error"
            role="alert"
            className="text-sm font-medium text-destructive"
          >
            {fieldError}
          </span>
        )}
      </label>

      <p className="text-xs text-muted-foreground text-pretty">
        Nunca inclua dados de paciente que não sejam estritamente necessários.
      </p>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={isPending}>
          <Icon aria-hidden="true" />
          {isPending ? "Enviando…" : mode.label}
        </Button>
      </div>
    </form>
  );
}
