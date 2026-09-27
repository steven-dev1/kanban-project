"use client";

import { CodeEditor } from "@/components/knowledge/code-editor";
import { Field } from "@/components/knowledge/ui";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { ENVIRONMENTS, ENVIRONMENT_LABELS, OBJECT_TYPE_LABELS } from "@/lib/knowledge/constants";
import { parseArguments, parsePlsqlDdl, splitPlsqlStatements } from "@/lib/knowledge/parse-plsql";
import type { Environment, OracleObject, OracleObjectType } from "@/lib/types";
import { useKnowledge } from "@/providers/knowledge-provider";
import { useMemo, useState } from "react";

interface UnitPreview {
  key: string;
  schema_name: string;
  object_name: string;
  object_type: OracleObjectType;
  codeSource: "SOURCE" | "PACKAGE";
  source_code: string;
  specCode: string | null;
  bodyCode: string | null;
}

function toPreview(statement: string, index: number): UnitPreview | null {
  const parsed = parsePlsqlDdl(statement);
  if (!parsed.object_name || !parsed.object_type) return null;
  const isPackage = parsed.object_type === "PACKAGE";
  return {
    key: `${index}-${parsed.object_name}`,
    schema_name: parsed.schema_name ?? "SP6DF",
    object_name: parsed.object_name,
    object_type: parsed.object_type,
    codeSource: isPackage ? "PACKAGE" : "SOURCE",
    source_code: parsed.source,
    specCode: parsed.specification,
    bodyCode: parsed.body,
  };
}

export function ImportPlsqlDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported?: () => void;
}) {
  const { createObject, addCodeVersion, upsertEnvironment, syncArguments } = useKnowledge();
  const { toast } = useToast();

  const [code, setCode] = useState("");
  const [environment, setEnvironment] = useState<Environment>("DEV");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const preview = useMemo(
    () =>
      splitPlsqlStatements(code)
        .map((statement, index) => toPreview(statement, index))
        .filter((unit): unit is UnitPreview => unit !== null),
    [code],
  );

  const submit = async () => {
    setError(null);
    setSummary(null);
    if (preview.length === 0) {
      return setError("No se detectó ningún bloque CREATE PROCEDURE/FUNCTION/PACKAGE");
    }

    setSaving(true);
    let created = 0;
    const failures: string[] = [];
    try {
      for (const unit of preview) {
        try {
          const object = await createObject({
            schema_name: unit.schema_name,
            object_name: unit.object_name,
            object_type: unit.object_type,
          });
          if (!object) throw new Error("No se pudo crear el objeto");

          if (unit.codeSource === "PACKAGE") {
            if (unit.specCode) {
              await addCodeVersion(object.id, {
                version_number: "1",
                source_type: "SPECIFICATION",
                source_code: unit.specCode,
                environment,
                change_description: "Versión inicial (import)",
              });
            }
            if (unit.bodyCode) {
              await addCodeVersion(object.id, {
                version_number: "1",
                source_type: "BODY",
                source_code: unit.bodyCode,
                environment,
                change_description: "Versión inicial (import)",
              });
            }
          } else {
            await addCodeVersion(object.id, {
              version_number: "1",
              source_type: "SOURCE",
              source_code: unit.source_code,
              environment,
              change_description: "Versión inicial (import)",
            });
          }
          // Existencia del objeto en el ambiente + argumentos detectados.
          await upsertEnvironment(object.id, environment, {
            version: "1",
            status: "ACTIVE",
            notes: null,
            last_verified_at: new Date().toISOString(),
          });
          if (unit.object_type === "PROCEDURE" || unit.object_type === "FUNCTION") {
            const code =
              unit.codeSource === "PACKAGE"
                ? unit.specCode ?? unit.bodyCode ?? ""
                : unit.source_code;
            await syncArguments(object.id, parseArguments(code, unit.object_type)).catch(() => {});
          }
          created += 1;
        } catch (unitError) {
          failures.push(
            `${unit.object_name}: ${
              unitError instanceof Error ? unitError.message : "error desconocido"
            }`,
          );
        }
      }

      if (created > 0) toast(`${created} objeto(s) importados`);
      if (failures.length > 0) {
        setSummary(`No se pudieron importar ${failures.length}: ${failures.join("; ")}`);
      } else {
        onImported?.();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  const counts = useMemo(() => {
    const map = new Map<OracleObjectType, number>();
    for (const unit of preview) map.set(unit.object_type, (map.get(unit.object_type) ?? 0) + 1);
    return map;
  }, [preview]);

  return (
    <Modal open={open} onClose={onClose} title="Importar PL/SQL en lote" size="xl">
      <div className="space-y-4">
        <Field
          label="Código"
          hint="Pega uno o varios CREATE OR REPLACE (procedure, función, package spec/body). Se crean los objetos y su versión 1."
        >
          <CodeEditor
            value={code}
            onChange={setCode}
            minLines={12}
            maxHeight={360}
            placeholder={"CREATE OR REPLACE PACKAGE PKG_TIQUETES AS ... END;\n\nCREATE OR REPLACE PROCEDURE P_EMP ... END;"}
          />
        </Field>

        <Field label="Ambiente de las versiones">
          <Select
            value={environment}
            onChange={(value) => setEnvironment(value as Environment)}
            options={ENVIRONMENTS.map((env) => ({
              value: env,
              label: `${env} · ${ENVIRONMENT_LABELS[env]}`,
            }))}
          />
        </Field>

        {preview.length > 0 && (
          <div className="rounded-lg border border-border">
            <div className="border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium">
              {preview.length} objeto(s) detectado(s):{" "}
              {[...counts.entries()]
                .map(([type, count]) => `${count} ${OBJECT_TYPE_LABELS[type]}`)
                .join(", ")}
            </div>
            <ul className="max-h-56 divide-y divide-border overflow-auto">
              {preview.map((unit) => (
                <li key={unit.key} className="flex items-center gap-2 px-3 py-2 text-xs">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                    {unit.object_type === "PACKAGE"
                      ? unit.specCode && unit.bodyCode
                        ? "PACKAGE + BODY"
                        : unit.bodyCode
                          ? "BODY"
                          : "PACKAGE"
                      : unit.object_type}
                  </span>
                  <span className="font-mono">
                    {unit.schema_name}.{unit.object_name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {summary && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{summary}</p>
        )}
        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving || preview.length === 0}>
            {saving ? "Importando…" : `Importar ${preview.length} objeto(s)`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export type { OracleObject };
