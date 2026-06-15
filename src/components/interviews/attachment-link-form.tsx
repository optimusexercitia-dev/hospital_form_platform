"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LinkIcon } from "lucide-react";

import {
  addInterviewLink,
  type AddAttachmentState,
} from "@/lib/interviews/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormBanner } from "@/components/auth/form-banner";

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/** A lightweight https-only check (the server is the authority; this is a hint). */
function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Add a LINK attachment to an interview (F3): an external https URL — typically an
 * audio-recording URL (audio BYTES are never stored in the bucket). Calls
 * `addInterviewLink(interviewId, title, externalUrl)`; client-side `https`-only
 * validation mirrors the server check. The parent owns the dialog open state.
 */
export function AttachmentLinkForm({
  interviewId,
}: {
  interviewId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
      >
        <LinkIcon aria-hidden="true" />
        Adicionar gravação
      </Button>
      <LinkDialog
        interviewId={interviewId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

function LinkDialog({
  interviewId,
  open,
  onOpenChange,
}: {
  interviewId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<AddAttachmentState | null>(null);

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setState(null);
      setTitle("");
      setUrl("");
    }
  }

  useEffect(() => {
    if (state?.ok) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedUrl = url.trim();
    if (!isHttpsUrl(trimmedUrl)) {
      setState({
        ok: false,
        fieldErrors: { externalUrl: "Informe uma URL https válida." },
      });
      return;
    }
    startTransition(async () => {
      const result = await addInterviewLink(
        interviewId,
        title.trim(),
        trimmedUrl,
      );
      setState(result);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar gravação</DialogTitle>
          <DialogDescription>
            Vincule a URL de uma gravação de áudio ou outro recurso externo (apenas
            https). Nunca inclua dados de paciente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {state && !state.ok && !state.fieldErrors && (
            <FormBanner tone="error">{state.error}</FormBanner>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Título</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={FIELD_CLASS}
              placeholder="Ex.: Gravação da entrevista"
              aria-invalid={state?.fieldErrors?.title ? true : undefined}
            />
            {state?.fieldErrors?.title && (
              <span
                role="alert"
                className="text-sm font-medium text-destructive"
              >
                {state.fieldErrors.title}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">URL (https)</span>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              className={FIELD_CLASS}
              placeholder="https://…"
              aria-invalid={state?.fieldErrors?.externalUrl ? true : undefined}
            />
            {state?.fieldErrors?.externalUrl && (
              <span
                role="alert"
                className="text-sm font-medium text-destructive"
              >
                {state.fieldErrors.externalUrl}
              </span>
            )}
          </label>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending ? "Adicionando…" : "Adicionar gravação"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
