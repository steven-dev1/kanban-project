"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-lg font-semibold">Algo salió mal</h1>
      <pre className="max-w-2xl overflow-auto rounded-xl border border-border bg-card p-4 text-left text-xs text-danger">
        {error.message}
        {"\n\n"}
        {error.stack}
      </pre>
      <button
        onClick={() => reset()}
        className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
      >
        Reintentar
      </button>
    </div>
  );
}
