"use client";

import { deleteCaseDocument } from "@/lib/cases/documents-actions";
import { ConfirmDeleteButton } from "./confirm-delete-button";

/**
 * Soft-delete a case document (R1). Thin client wrapper that binds
 * {@link deleteCaseDocument} to a document id so the server-component panel can
 * render the shared {@link ConfirmDeleteButton} without crossing a closure over
 * the boundary. The Storage object is retained (Rule 6); only the row is hidden.
 */
export function CaseDocumentDelete({
  documentId,
  title,
}: {
  documentId: string;
  title: string;
}) {
  return (
    <ConfirmDeleteButton
      action={() => deleteCaseDocument(documentId)}
      label={`Remover o documento ${title}`}
      title="Remover este documento?"
      description={`O documento “${title}” deixará de aparecer neste caso. O arquivo enviado é mantido.`}
    />
  );
}
