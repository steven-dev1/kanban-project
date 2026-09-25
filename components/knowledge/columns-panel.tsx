"use client";

import { Field, Skeleton } from "@/components/knowledge/ui";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { OracleColumnWithValues, OracleColumnValue } from "@/lib/types";
import { useKnowledge } from "@/providers/knowledge-provider";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function ColumnsPanel({
  objectId,
  columns,
  canEdit,
}: {
  objectId: string;
  columns: OracleColumnWithValues[];
  canEdit: boolean;
}) {
  const { addColumn, updateColumn, deleteColumn, isAdmin } = useKnowledge();
  const confirm = useConfirm();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OracleColumnWithValues | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (column: OracleColumnWithValues) => {
    setEditing(column);
    setDialogOpen(true);
  };

  const remove = async (column: OracleColumnWithValues) => {
    const ok = await confirm({
      title: "Eliminar columna",
      message: `¿Eliminar la columna ${column.column_name}? Se eliminarán sus valores documentados.`,
      danger: true,
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    try {
      await deleteColumn(column.id);
      toast("Columna eliminada");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Error", "error");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {columns.length} {columns.length === 1 ? "columna" : "columnas"}
        </p>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" /> Agregar columna
          </Button>
        )}
      </div>

      {columns.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
          Aún no hay columnas documentadas.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="w-8 px-2 py-2" />
                <th className="px-3 py-2 font-medium">Columna</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Nullable</th>
                <th className="hidden px-3 py-2 font-medium md:table-cell">Descripción</th>
                <th className="w-24 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {columns.map((column) => (
                <ColumnRows
                  key={column.id}
                  column={column}
                  canEdit={canEdit}
                  canDelete={isAdmin}
                  expanded={expanded === column.id}
                  onToggle={() => setExpanded(expanded === column.id ? null : column.id)}
                  onEdit={() => openEdit(column)}
                  onDelete={() => remove(column)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ColumnFormDialog
        key={dialogOpen ? (editing?.id ?? "new") : "closed"}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        objectId={objectId}
        column={editing}
        nextOrder={columns.length ? Math.max(...columns.map((c) => c.column_order ?? 0)) + 1 : 1}
        onSubmit={async (values) => {
          if (editing) await updateColumn(editing.id, values);
          else await addColumn(objectId, values);
          toast(editing ? "Columna actualizada" : "Columna agregada");
        }}
      />
    </div>
  );
}

function ColumnRows({
  column,
  canEdit,
  canDelete,
  expanded,
  onToggle,
  onEdit,
  onDelete,
}: {
  column: OracleColumnWithValues;
  canEdit: boolean;
  canDelete: boolean;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const typeLabel = [column.data_type, column.data_length ? `(${column.data_length})` : ""]
    .filter(Boolean)
    .join("");

  return (
    <>
      <tr className="border-t border-border align-top hover:bg-muted/40">
        <td className="px-2 py-2">
          <button onClick={onToggle} className="rounded p-0.5 hover:bg-muted" aria-label="Expandir">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </td>
        <td className="px-3 py-2 font-mono text-xs font-medium">{column.column_name}</td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{typeLabel || "—"}</td>
        <td className="px-3 py-2 text-xs text-muted-foreground">
          {column.nullable ? "Sí" : "No"}
        </td>
        <td className="hidden max-w-[320px] px-3 py-2 text-xs text-muted-foreground md:table-cell">
          <span className="line-clamp-2">{column.description || column.business_meaning || "—"}</span>
        </td>
        <td className="px-3 py-2">
          {canEdit && (
            <div className="flex items-center justify-end gap-1">
              <button
                onClick={onEdit}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Editar"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              {canDelete && (
                <button
                  onClick={onDelete}
                  className="rounded p-1 text-muted-foreground hover:bg-danger/10 hover:text-danger"
                  aria-label="Eliminar"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-border bg-muted/20">
          <td />
          <td colSpan={5} className="px-3 py-3">
            <div className="space-y-3">
              <div className="grid gap-3 text-xs sm:grid-cols-2">
                <div>
                  <span className="font-medium text-muted-foreground">Significado funcional: </span>
                  {column.business_meaning || "—"}
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Notas: </span>
                  {column.notes || "—"}
                </div>
              </div>
              <ValuesList
                columnId={column.id}
                values={column.values}
                canEdit={canEdit}
                canDelete={canDelete}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function ValuesList({
  columnId,
  values,
  canEdit,
  canDelete,
}: {
  columnId: string;
  values: OracleColumnValue[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const { addColumnValue, updateColumnValue, deleteColumnValue } = useKnowledge();
  const { toast } = useToast();
  const [value, setValue] = useState("");
  const [meaning, setMeaning] = useState("");

  const submit = async () => {
    if (!value.trim()) return;
    try {
      await addColumnValue(columnId, { value: value.trim(), meaning: meaning.trim() || null });
      setValue("");
      setMeaning("");
      toast("Valor agregado");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Error", "error");
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase text-muted-foreground">
        Valores documentados
      </p>
      {values.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin valores documentados.</p>
      ) : (
        <ul className="mb-3 space-y-1">
          {values.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-xs"
            >
              <span className="flex min-w-0 items-center gap-2">
                <code className="rounded bg-background px-1.5 py-0.5 font-mono font-semibold">
                  {item.value}
                </code>
                <span className="truncate text-muted-foreground">{item.meaning || "—"}</span>
                {!item.is_active && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    inactivo
                  </span>
                )}
              </span>
              {canEdit && (
                <span className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => updateColumnValue(item.id, { is_active: !item.is_active })}
                    className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {item.is_active ? "Desactivar" : "Activar"}
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => deleteColumnValue(item.id)}
                      className="rounded p-1 text-muted-foreground hover:text-danger"
                      aria-label="Eliminar valor"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="flex flex-wrap items-end gap-2">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Valor (ej. A)"
            className="h-8 w-28"
          />
          <Input
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            placeholder="Significado (ej. Activo)"
            className="h-8 flex-1"
          />
          <Button size="sm" variant="outline" onClick={submit}>
            <Plus className="h-3.5 w-3.5" /> Agregar
          </Button>
        </div>
      )}
    </div>
  );
}

interface ColumnFormValues {
  column_name: string;
  data_type: string | null;
  data_length: number | null;
  data_precision: number | null;
  data_scale: number | null;
  nullable: boolean;
  column_order: number | null;
  description: string | null;
  business_meaning: string | null;
  notes: string | null;
}

function ColumnFormDialog({
  open,
  onClose,
  column,
  nextOrder,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  objectId: string;
  column: OracleColumnWithValues | null;
  nextOrder: number;
  onSubmit: (values: ColumnFormValues) => Promise<void>;
}) {
  const [columnName, setColumnName] = useState(column?.column_name ?? "");
  const [dataType, setDataType] = useState(column?.data_type ?? "");
  const [dataLength, setDataLength] = useState(
    column?.data_length != null ? String(column.data_length) : "",
  );
  const [precision, setPrecision] = useState(
    column?.data_precision != null ? String(column.data_precision) : "",
  );
  const [scale, setScale] = useState(
    column?.data_scale != null ? String(column.data_scale) : "",
  );
  const [nullable, setNullable] = useState(column?.nullable ?? true);
  const [order, setOrder] = useState(
    column?.column_order != null ? String(column.column_order) : String(nextOrder),
  );
  const [description, setDescription] = useState(column?.description ?? "");
  const [businessMeaning, setBusinessMeaning] = useState(column?.business_meaning ?? "");
  const [notes, setNotes] = useState(column?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!columnName.trim()) return setError("El nombre de la columna es obligatorio");
    setSaving(true);
    try {
      await onSubmit({
        column_name: columnName.trim().toUpperCase(),
        data_type: dataType.trim() || null,
        data_length: toNumberOrNull(dataLength),
        data_precision: toNumberOrNull(precision),
        data_scale: toNumberOrNull(scale),
        nullable,
        column_order: toNumberOrNull(order),
        description: description.trim() || null,
        business_meaning: businessMeaning.trim() || null,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error";
      setError(
        message.includes("duplicate") || message.includes("unique")
          ? "Ya existe una columna con ese nombre."
          : message,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={column ? `Editar columna ${column.column_name}` : "Nueva columna"}
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre *">
            <Input
              value={columnName}
              onChange={(e) => setColumnName(e.target.value.toUpperCase())}
              placeholder="NUMERO_TIQUETE"
            />
          </Field>
          <Field label="Tipo de dato">
            <Input
              value={dataType}
              onChange={(e) => setDataType(e.target.value.toUpperCase())}
              placeholder="VARCHAR2"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Longitud">
            <Input value={dataLength} onChange={(e) => setDataLength(e.target.value)} placeholder="50" />
          </Field>
          <Field label="Precisión">
            <Input value={precision} onChange={(e) => setPrecision(e.target.value)} placeholder="10" />
          </Field>
          <Field label="Escala">
            <Input value={scale} onChange={(e) => setScale(e.target.value)} placeholder="2" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Posición">
            <Input value={order} onChange={(e) => setOrder(e.target.value)} placeholder="1" />
          </Field>
          <Field label="Nullable">
            <label className="flex h-9 items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm">
              <input
                type="checkbox"
                checked={nullable}
                onChange={(e) => setNullable(e.target.checked)}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              Permite nulos
            </label>
          </Field>
        </div>

        <Field label="Descripción técnica">
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Significado funcional">
          <Textarea
            rows={2}
            value={businessMeaning}
            onChange={(e) => setBusinessMeaning(e.target.value)}
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
            {saving ? "Guardando…" : column ? "Guardar" : "Agregar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function ColumnsSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
