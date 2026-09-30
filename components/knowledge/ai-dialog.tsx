"use client";

import { CodeBlock } from "@/components/knowledge/code-block";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { AlertTriangle, Check, Copy, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

export interface AiTextRequest {
  title: string;
  description?: string;
  renderAs?: "text" | "code";
  applyLabel?: string;
  onApply?: (text: string) => Promise<boolean | void> | boolean | void;
  run: () => Promise<string>;
}

export interface AiDocumentRequest {
  title: string;
  run: () => Promise<{ description: string; functional_description: string }>;
  onApply?: (values: {
    description: string;
    functional_description: string;
  }) => Promise<void> | void;
}

function AiHeader() {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Sparkles className="h-4 w-4" />
      </span>
      Asistente IA
    </span>
  );
}

/** Diálogo para resultados de texto/código (explicar, resumir, diagnóstico, diff). */
export function AiTextDialog({
  request,
  onClose,
}: {
  request: AiTextRequest | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!request) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setLoading(true);
      setError(null);
      setText("");
      request
        .run()
        .then((value) => {
          if (active) setText(value);
        })
        .catch((err: unknown) => {
          if (active) setError(err instanceof Error ? err.message : "Error de IA");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    });
    return () => {
      active = false;
    };
  }, [request]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast("No se pudo copiar", "error");
    }
  }

  return (
    <Modal open={!!request} onClose={onClose} title={<AiHeader />} size="lg">
      {loading && (
        <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Generando con IA…
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {!loading && !error && request && (
        <div className="flex flex-col gap-3">
          {request.description && (
            <p className="text-xs text-muted-foreground">{request.description}</p>
          )}
          {request.renderAs === "code" ? (
            <CodeBlock value={text} title="SQL sugerido" maxHeight={380} />
          ) : (
            <div className="max-h-[55vh] overflow-auto rounded-xl border border-border bg-muted/20 p-4 text-sm leading-relaxed whitespace-pre-wrap">
              {text}
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-green-500" /> Copiado
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" /> Copiar
                </>
              )}
            </Button>
            {request.onApply && request.applyLabel && (
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    const applied = await request.onApply?.(text);
                    if (applied === false) return;
                    toast("Aplicado", "success");
                    onClose();
                  } catch (err) {
                    toast(err instanceof Error ? err.message : "No se pudo aplicar", "error");
                  }
                }}
              >
                {request.applyLabel}
              </Button>
            )}
          </div>
          <p className="text-right text-[11px] text-muted-foreground">
            La IA puede cometer errores. Revísalo antes de usarlo.
          </p>
        </div>
      )}
    </Modal>
  );
}

/** Diálogo para "Generar documentación" (dos campos editables). */
export function AiDocumentDialog({
  request,
  onClose,
}: {
  request: AiDocumentRequest | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [functional, setFunctional] = useState("");

  useEffect(() => {
    if (!request) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setLoading(true);
      setError(null);
      setDescription("");
      setFunctional("");
      request
        .run()
        .then((result) => {
          if (!active) return;
          setDescription(result.description);
          setFunctional(result.functional_description);
        })
        .catch((err: unknown) => {
          if (active) setError(err instanceof Error ? err.message : "Error de IA");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    });
    return () => {
      active = false;
    };
  }, [request]);

  return (
    <Modal open={!!request} onClose={onClose} title={<AiHeader />} size="lg">
      {loading && (
        <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Redactando documentación…
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {!loading && !error && request && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Descripción técnica</label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Descripción funcional</label>
            <Textarea
              rows={4}
              value={functional}
              onChange={(e) => setFunctional(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            {request.onApply && (
              <Button
                onClick={async () => {
                  await request.onApply?.({
                    description,
                    functional_description: functional,
                  });
                  toast("Documentación aplicada", "success");
                  onClose();
                }}
              >
                Aplicar al objeto
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Botón de disparo reutilizable para las acciones de IA. */
export function AiMenuItem({
  label,
  icon,
  disabled,
  onClick,
  className,
}: {
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50",
        className,
      )}
    >
      {icon ?? <Sparkles className="h-4 w-4 text-primary" />}
      {label}
    </button>
  );
}
