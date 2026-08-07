import Link from "next/link";
import { ShieldOff } from "lucide-react";

/**
 * In-shell 404 for the quality console.
 *
 * ⚠ Reached for BOTH "this organization does not exist" and "you review no
 * hospital here" — indistinguishable by design, so the copy must not
 * distinguish them either. Naming which one it was would turn this page into an
 * org-existence oracle for anyone who can sign in.
 */
export default function QualityConsoleNotFound() {
  return (
    <section className="animate-rise-in mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <ShieldOff aria-hidden="true" className="size-6" />
      </span>
      <h1 className="text-2xl text-balance">Página não encontrada</h1>
      <p className="text-muted-foreground text-pretty">
        Este endereço não existe ou você não tem acesso ao Escritório da
        Qualidade desta organização.
      </p>
      <Link
        href="/"
        className="rounded-lg px-4 py-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        Voltar ao início
      </Link>
    </section>
  );
}
