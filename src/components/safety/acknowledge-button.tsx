"use client";

import { CircleCheck } from "lucide-react";

import { acknowledgeEvent } from "@/lib/safety/actions";
import { Button } from "@/components/ui/button";
import { useSafetyAction } from "./use-safety-action";

/**
 * The NSP "Reconhecer evento" action (F3): takes receipt of a reported event
 * (`reported → acknowledged`, recording who/when). Offered only while the event
 * is `reported` (the parent decides; the RPC re-checks the state → HC043). On
 * success the route refreshes so the recorded acknowledgement surfaces.
 */
export function AcknowledgeButton({ eventId }: { eventId: string }) {
  const { run, isPending, error } = useSafetyAction();

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button
        type="button"
        size="lg"
        onClick={() => run(() => acknowledgeEvent(eventId))}
        disabled={isPending}
      >
        <CircleCheck aria-hidden="true" />
        {isPending ? "Reconhecendo…" : "Reconhecer evento"}
      </Button>
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
