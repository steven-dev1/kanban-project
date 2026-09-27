"use client";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/knowledge/ui";
import { CodeEditor } from "@/components/knowledge/code-editor";
import { SyntaxReport, useValidation } from "@/components/knowledge/syntax-report";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  ENVIRONMENTS,
  ENVIRONMENT_LABELS,
  OBJECT_TYPE_LABELS,
  OBJECT_TYPES,
} from "@/lib/knowledge/constants";
import { guessObjectTypeFromName, parseArguments, parsePlsqlDdl } from "@/lib/knowledge/parse-plsql";
import type { Environment, OracleObject, OracleObjectType } from "@/lib/types";
import { useKnowledge } from "@/providers/knowledge-provider";
import { useState } from "react";

const NONE = "__none__";

export function ObjectDialog({
  open,
  onClose,
  object,
  defaultType,
  lockType,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  object?: OracleObject | null;
  defaultType?: OracleObjectType;
  lockType?: boolean;
  onCreated?: (object: OracleObject) => void;
}) {
  const { createObject, updateObject, addCodeVersion, upsertEnvironment, syncArguments, profiles } =
    useKnowledge();
  const { toast } = useToast();
  const editing = !!object;

  const [schemaName, setSchemaName] = useState(object?.schema_name ?? "SP6DF");
  const [objectName, setObjectName] = useState(object?.object_name ?? "");
  const [objectType, setObjectType] = useState<OracleObjectType>(
    object?.object_type ?? defaultType ?? "TABLE",
  );
  const [description, setDescription] = useState(
    object?.description ?? object?.functional_description ?? "",
  );
  const [module, setModule] = useState(object?.module ?? "");
  const [owner, setOwner] = useState(object?.owner ?? NONE);
  const [notes, setNotes] = useState(object?.notes ?? "");
  const [environment, setEnvironment] = useState<Environment>("PRODUCTIVO");
  const [code, setCode] = useState("");
  const [specCode, setSpecCode] = useState("");
  const [bodyCode, setBodyCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPackage = !editing && objectType === "PACKAGE";
  const isRoutine = !editing && (objectType === "PROCEDURE" || objectType === "FUNCTION");

  const codeValidation = useValidation(code);
  const specValidation = useValidation(specCode);
  const bodyValidation = useValidation(bodyCode);

  const hasCodeErrors =
    (isRoutine && code.trim() !== "" && codeValidation.errors.length > 0) ||
    (isPackage && specCode.trim() !== "" && specValidation.errors.length > 0) ||
    (isPackage && bodyCode.trim() !== "" && bodyValidation.errors.length > 0);

  const pasteSource = (raw: string) => {
    const parsed = parsePlsqlDdl(raw);
    if (!parsed.object_name) {
      toast("No se pudo detectar el nombre en el código", "error");
      return;
    }
    if (parsed.schema_name) setSchemaName(parsed.schema_name);
    setObjectName(parsed.object_name);
    if (parsed.object_type) setObjectType(parsed.object_type);
    if (parsed.object_type === "PACKAGE") {
      if (parsed.specification) setSpecCode(parsed.specification);
      if (parsed.body) setBodyCode(parsed.body);
    } else {
      setCode(raw);
    }
    setError(null);
  };

  const applyTemplate = (type: "PROCEDURE" | "FUNCTION" | "PACKAGE") => {
    if (type === "PROCEDURE") {
      const name = objectName || "P_MI_PROCEDIMIENTO";
      setCode(
        `CREATE OR REPLACE PROCEDURE ${name} (\n  P_EMPRESA IN NUMBER\n) IS\nBEGIN\n  NULL;\nEND ${name};\n`,
      );
    } else if (type === "FUNCTION") {
      const name = objectName || "F_MI_FUNCION";
      setCode(
        `CREATE OR REPLACE FUNCTION ${name} (\n  P_EMPRESA IN NUMBER\n) RETURN NUMBER IS\n  V_RESULTADO NUMBER;\nBEGIN\n  RETURN V_RESULTADO;\nEND ${name};\n`,
      );
    } else {
      const name = objectName || "PKG_MI_PAQUETE";
      setSpecCode(
        `CREATE OR REPLACE PACKAGE ${name} AS\n  PROCEDURE P_EJECUTAR(P_EMPRESA IN NUMBER);\nEND ${name};\n`,
      );
      setBodyCode(
        `CREATE OR REPLACE PACKAGE BODY ${name} IS\n  PROCEDURE P_EJECUTAR(P_EMPRESA IN NUMBER) IS\n  BEGIN\n    NULL;\n  END P_EJECUTAR;\nEND ${name};\n`,
      );
    }
  };

  const submit = async () => {
    setError(null);
    if (!schemaName.trim()) return setError("El schema es obligatorio");
    if (!objectName.trim()) return setError("El nombre del objeto es obligatorio");
    if (hasCodeErrors) {
      return setError("Hay errores de sintaxis en el código. Corrígelos antes de guardar.");
    }

    setSaving(true);
    try {
      const payload = {
        schema_name: schemaName.trim().toUpperCase(),
        object_name: objectName.trim().toUpperCase(),
        object_type: objectType,
        description: description.trim() || null,
        module: module.trim() || null,
        owner: owner === NONE ? null : owner,
        notes: notes.trim() || null,
      };
      if (editing && object) {
        await updateObject(object.id, payload);
        toast("Objeto actualizado");
        onClose();
        return;
      }

      const created = await createObject(payload);
      if (!created) throw new Error("No se pudo crear el objeto");

      const codes: { source_type: "SOURCE" | "SPECIFICATION" | "BODY"; value: string }[] = [];
      if (isRoutine && code.trim()) {
        codes.push({ source_type: "SOURCE", value: code });
      }
      if (isPackage) {
        if (specCode.trim()) codes.push({ source_type: "SPECIFICATION", value: specCode });
        if (bodyCode.trim()) codes.push({ source_type: "BODY", value: bodyCode });
      }

      // El objeto se crea en un único ambiente (el elegido): registramos su
      // existencia y, si hay código, la versión 1 solo en ese ambiente.
      try {
        await upsertEnvironment(created.id, environment, {
          version: codes.length > 0 ? "1" : null,
          status: "ACTIVE",
          notes: null,
          last_verified_at: new Date().toISOString(),
        });
      } catch (envError) {
        toast(
          `Objeto creado, pero no se registró en ${environment}: ${
            envError instanceof Error ? envError.message : "error"
          }`,
          "error",
        );
      }

      for (const entry of codes) {
        try {
          await addCodeVersion(created.id, {
            version_number: "1",
            source_type: entry.source_type,
            source_code: entry.value,
            environment,
            change_description: "Versión inicial",
          });
        } catch (versionError) {
          toast(
            `Objeto creado, pero no se guardó el código: ${
              versionError instanceof Error ? versionError.message : "error"
            }`,
            "error",
          );
        }
      }

      // Detección automática de argumentos para procedures/funciones.
      const routineSource = isRoutine ? code : isPackage ? (specCode || bodyCode) : "";
      if (routineSource.trim() && (objectType === "PROCEDURE" || objectType === "FUNCTION")) {
        try {
          await syncArguments(created.id, parseArguments(routineSource, objectType));
        } catch {
          // Silencioso: los argumentos se pueden completar a mano.
        }
      }

      toast(codes.length > 0 ? `Objeto y código creados en ${environment}` : `Objeto creado en ${environment}`);
      onCreated?.(created);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar";
      setError(
        message.includes("duplicate") || message.includes("unique")
          ? "Ya existe un objeto con ese schema, nombre y tipo."
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
      title={editing ? "Editar objeto" : "Nuevo objeto"}
      size={isRoutine || isPackage ? "xl" : "lg"}
    >
      <div className="space-y-4">
        {/* 1) Pegado + detección de sintaxis + plantilla */}
        {!editing && (
          <div className="space-y-2 rounded-lg border border-dashed border-border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Pega el código y detecto tipo, nombre y schema automáticamente
            </p>
            <Textarea
              rows={3}
              placeholder="CREATE OR REPLACE PROCEDURE SP6DF.P_TIQUETE (...) IS ... END;"
              onChange={(e) => {
                const value = e.target.value;
                if (!value.trim()) return;
                const parsed = parsePlsqlDdl(value);
                if (parsed.object_name) pasteSource(value);
                else {
                  const guess = guessObjectTypeFromName(value.split(/[\s(]/)[0]);
                  if (guess) setObjectType(guess);
                }
              }}
              className="font-mono text-xs"
            />
            <div className="flex flex-wrap items-center gap-2">
              {(objectType === "PROCEDURE" ||
                objectType === "FUNCTION" ||
                objectType === "PACKAGE") && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => applyTemplate(objectType as "PROCEDURE")}
                >
                  Usar plantilla de {OBJECT_TYPE_LABELS[objectType]}
                </Button>
              )}
              <span className="text-[11px] text-muted-foreground">
                También se detecta por prefijo: P_/SP_ (procedure), F_/FN_ (función), PKG_ (package).
              </span>
            </div>
          </div>
        )}

        {/* 2) El código en sí (protagonista) */}
        {isRoutine && (
          <>
            <Field
              label="Código"
              hint="Opcional. Si lo escribes se guarda como versión 1 (validado)."
            >
              <CodeEditor
                value={code}
                onChange={setCode}
                minLines={12}
                maxHeight={360}
                placeholder="CREATE OR REPLACE PROCEDURE P_EMP (P_EMPRESA IN NUMBER) IS ... BEGIN ... END P_EMP;"
              />
            </Field>
            {code.trim() && <SyntaxReport result={codeValidation} />}
          </>
        )}

        {isPackage && (
          <>
            <Field label="Specification (encabezado)" hint="Opcional. Se guarda como versión 1.">
              <CodeEditor
                value={specCode}
                onChange={setSpecCode}
                minLines={10}
                maxHeight={320}
                placeholder="CREATE OR REPLACE PACKAGE PKG_TIQUETES AS ... END PKG_TIQUETES;"
              />
            </Field>
            {specCode.trim() && <SyntaxReport result={specValidation} />}

            <Field label="Body" hint="Opcional. Se guarda como versión 1.">
              <CodeEditor
                value={bodyCode}
                onChange={setBodyCode}
                minLines={12}
                maxHeight={360}
                placeholder="CREATE OR REPLACE PACKAGE BODY PKG_TIQUETES IS ... BEGIN ... END PKG_TIQUETES;"
              />
            </Field>
            {bodyCode.trim() && <SyntaxReport result={bodyValidation} />}
          </>
        )}

        {/* 3) Datos de identificación y clasificación */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Schema *">
            <Input
              value={schemaName}
              onChange={(e) => setSchemaName(e.target.value.toUpperCase())}
              placeholder="SP6DF"
            />
          </Field>
          <Field label="Nombre *">
            <Input
              value={objectName}
              onChange={(e) => setObjectName(e.target.value.toUpperCase())}
              placeholder="VG_TIQUETES"
            />
          </Field>
        </div>

        {(editing || !lockType) && (
          <Field label="Tipo *">
            <Select
              value={objectType}
              onChange={(value) => setObjectType(value as OracleObjectType)}
              options={OBJECT_TYPES.map((type) => ({
                value: type,
                label: `${type} · ${OBJECT_TYPE_LABELS[type]}`,
              }))}
            />
          </Field>
        )}

        {(isRoutine || isPackage) && (
          <Field label="Ambiente del código" hint="Se guardará como versión 1.">
            <Select
              value={environment}
              onChange={(value) => setEnvironment(value as Environment)}
              options={ENVIRONMENTS.map((env) => ({
                value: env,
                label: `${env} · ${ENVIRONMENT_LABELS[env]}`,
              }))}
            />
          </Field>
        )}

        <Field label="Descripción">
          <Textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Qué es y para qué sirve este objeto"
          />
        </Field>

        {editing ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Módulo">
              <Input
                value={module}
                onChange={(e) => setModule(e.target.value)}
                placeholder="Tiquetes, SAP, Contabilidad…"
              />
            </Field>
            <Field label="Responsable">
              <Select
                value={owner}
                onChange={setOwner}
                placeholder="Sin asignar"
                options={[
                  { value: NONE, label: "Sin asignar" },
                  ...profiles.map((p) => ({
                    value: p.id,
                    label: p.full_name || p.email || p.id,
                  })),
                ]}
              />
            </Field>
          </div>
        ) : (
          <Field label="Módulo">
            <Input
              value={module}
              onChange={(e) => setModule(e.target.value)}
              placeholder="Tiquetes, SAP, Contabilidad…"
            />
          </Field>
        )}

        {editing && (
          <Field label="Notas">
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas libres"
            />
          </Field>
        )}

        {error && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving || hasCodeErrors}>
            {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear objeto"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
