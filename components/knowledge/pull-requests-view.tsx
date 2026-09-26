"use client";

import { EnvironmentBadge, EmptyState, Field, Skeleton } from "@/components/knowledge/ui";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { ENVIRONMENTS, ENVIRONMENT_LABELS } from "@/lib/knowledge/constants";
import type { Environment, PullRequest, PullRequestStatus } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { useKnowledge } from "@/providers/knowledge-provider";
import { ExternalLink, GitPullRequest, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

const ALL = "__all__";

const STATUS_LABELS: Record<PullRequestStatus, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
};

const STATUS_STYLES: Record<PullRequestStatus, string> = {
  PENDING: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  APPROVED: "bg-green-500/15 text-green-600 dark:text-green-400",
  REJECTED: "bg-danger/15 text-danger",
};

export function PullRequestsView() {
  const { pullRequests, loading, canEdit, createPullRequest, updatePullRequest, deletePullRequest } =
    useKnowledge();
  const confirm = useConfirm();
  const { toast } = useToast();

  const [environment, setEnvironment] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pullRequests.filter((pr) => {
      if (environment !== ALL && pr.environment !== environment) return false;
      if (status !== ALL && pr.status !== status) return false;
      if (!q) return true;
      return (
        (pr.title ?? "").toLowerCase().includes(q) ||
        (pr.pr_number ?? "").toLowerCase().includes(q) ||
        (pr.url ?? "").toLowerCase().includes(q) ||
        (pr.notes ?? "").toLowerCase().includes(q)
      );
    });
  }, [pullRequests, environment, status, query]);

  const remove = async (pr: PullRequest) => {
    const ok = await confirm({
      title: "Eliminar Pull Request",
      message: `¿Eliminar el PR ${pr.pr_number ?? ""}?`,
      danger: true,
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    try {
      await deletePullRequest(pr.id);
      toast("Pull Request eliminado");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Error", "error");
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border bg-card px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Pull Requests</h1>
            <p className="text-sm text-muted-foreground">
              Registro de PRs por ambiente y su estado de aprobación.
            </p>
          </div>
          {canEdit && (
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Nuevo Pull Request
            </Button>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por número, título, link o nota…"
            className="min-w-[220px] flex-1"
          />
          <div className="w-40">
            <Select
              value={environment}
              onChange={setEnvironment}
              options={[
                { value: ALL, label: "Todos los ambientes" },
                ...ENVIRONMENTS.map((e) => ({ value: e, label: ENVIRONMENT_LABELS[e] })),
              ]}
            />
          </div>
          <div className="w-40">
            <Select
              value={status}
              onChange={setStatus}
              options={[
                { value: ALL, label: "Todos los estados" },
                ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
              ]}
            />
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-4 md:p-6">
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<GitPullRequest className="h-6 w-6" />}
            title="Sin Pull Requests"
            description="Registra tus PRs con ambiente, número, link y estado."
            action={
              canEdit ? (
                <Button size="sm" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Nuevo Pull Request
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Ambiente</th>
                  <th className="px-3 py-2 font-medium">PR</th>
                  <th className="px-3 py-2 font-medium">Título / Link</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="hidden px-3 py-2 font-medium lg:table-cell">Fecha</th>
                  <th className="w-16 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((pr) => (
                  <tr key={pr.id} className="border-t border-border hover:bg-muted/40">
                    <td className="px-3 py-2.5">
                      <EnvironmentBadge environment={pr.environment} />
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs font-semibold">
                      {pr.pr_number ? `#${pr.pr_number}` : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="max-w-[280px] truncate">{pr.title || "—"}</span>
                        {pr.url && (
                          <a
                            href={pr.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                            title={pr.url}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                      {pr.notes && (
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                          {pr.notes}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-1">
                        {(Object.keys(STATUS_LABELS) as PullRequestStatus[]).map((s) => (
                          <button
                            key={s}
                            disabled={!canEdit}
                            onClick={() =>
                              updatePullRequest(pr.id, { status: s }).catch((err) =>
                                toast(err instanceof Error ? err.message : "Error", "error"),
                              )
                            }
                            className={cn(
                              "rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors",
                              pr.status === s
                                ? STATUS_STYLES[s]
                                : "text-muted-foreground hover:bg-muted",
                            )}
                          >
                            {STATUS_LABELS[s]}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="hidden px-3 py-2.5 text-xs text-muted-foreground lg:table-cell">
                      {formatDate(pr.created_at)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {canEdit && (
                        <button
                          onClick={() => remove(pr)}
                          className="rounded p-1 text-muted-foreground hover:text-danger"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PullRequestDialog
        key={dialogOpen ? "open" : "closed"}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={async (input) => {
          await createPullRequest(input);
          toast("Pull Request creado");
        }}
      />
    </div>
  );
}

function PullRequestDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    environment: Environment;
    pr_number: string | null;
    title: string | null;
    url: string | null;
    status: PullRequestStatus;
    notes: string | null;
  }) => Promise<void>;
}) {
  const [environment, setEnvironment] = useState<Environment>("DEV");
  const [prNumber, setPrNumber] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<PullRequestStatus>("PENDING");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!prNumber.trim() && !title.trim()) {
      return setError("Ingresa al menos el número o el título del PR");
    }
    setSaving(true);
    try {
      await onSubmit({
        environment,
        pr_number: prNumber.trim() || null,
        title: title.trim() || null,
        url: url.trim() || null,
        status,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo Pull Request" size="md">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ambiente *">
            <Select
              value={environment}
              onChange={(v) => setEnvironment(v as Environment)}
              options={ENVIRONMENTS.map((e) => ({
                value: e,
                label: `${e} · ${ENVIRONMENT_LABELS[e]}`,
              }))}
            />
          </Field>
          <Field label="Número del PR">
            <Input
              value={prNumber}
              onChange={(e) => setPrNumber(e.target.value)}
              placeholder="1542"
            />
          </Field>
        </div>
        <Field label="Título">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ajuste en reporte de agencias"
          />
        </Field>
        <Field label="Link del PR">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://dev.azure.com/…/pullrequest/1542"
          />
        </Field>
        <Field label="Estado">
          <Select
            value={status}
            onChange={(v) => setStatus(v as PullRequestStatus)}
            options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
          />
        </Field>
        <Field label="Notas">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Guardando…" : "Crear PR"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
