"use client";

import { EnvironmentBadge, ObjectTypeBadge, Skeleton } from "@/components/knowledge/ui";
import { ENVIRONMENTS, ENVIRONMENT_LABELS } from "@/lib/knowledge/constants";
import type { Environment, OracleObjectWithRelations } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { useKnowledge } from "@/providers/knowledge-provider";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

interface EnvSummary {
  environment: Environment;
  objectsDocumented: number;
  versions: number;
  lastUpdate: string | null;
  lastVerified: string | null;
}

interface Difference {
  object: OracleObjectWithRelations;
  envs: { environment: Environment; version: string; code: string }[];
}

export function EnvironmentsOverview() {
  const { objects, loading } = useKnowledge();

  const summaries = useMemo<EnvSummary[]>(() => {
    return ENVIRONMENTS.map((environment) => {
      const envRecords = objects.flatMap((o) =>
        o.environments.filter((e) => e.environment === environment),
      );
      const versions = objects.flatMap((o) =>
        o.code_versions.filter((v) => v.environment === environment),
      );
      const lastUpdate = envRecords
        .map((e) => e.updated_at)
        .sort((a, b) => b.localeCompare(a))[0] ?? null;
      const lastVerified =
        envRecords
          .map((e) => e.last_verified_at)
          .filter(Boolean)
          .sort((a, b) => (b as string).localeCompare(a as string))[0] ?? null;
      return {
        environment,
        objectsDocumented: envRecords.length,
        versions: versions.length,
        lastUpdate,
        lastVerified,
      };
    });
  }, [objects]);

  const differences = useMemo<Difference[]>(() => {
    const result: Difference[] = [];
    for (const object of objects) {
      if (!["PROCEDURE", "FUNCTION", "PACKAGE"].includes(object.object_type)) continue;
      const byEnv = new Map<Environment, { version: string; code: string }>();
      const latestByEnv = new Map<string, { version: string; code: string; at: string }>();
      for (const version of object.code_versions) {
        const key = `${version.source_type}:${version.environment}`;
        const existing = latestByEnv.get(key);
        if (!existing || existing.at < version.created_at) {
          latestByEnv.set(key, {
            version: String(version.version_number),
            code: version.source_code,
            at: version.created_at,
          });
        }
      }
      for (const [key, value] of latestByEnv) {
        const environment = key.split(":")[1] as Environment;
        if (!byEnv.has(environment)) {
          byEnv.set(environment, { version: value.version, code: value.code });
        }
      }
      const entries = Array.from(byEnv.entries());
      if (entries.length < 2) continue;
      const distinctCodes = new Set(entries.map(([, value]) => value.code));
      if (distinctCodes.size < 2) continue;
      result.push({
        object,
        envs: entries.map(([environment, value]) => ({
          environment,
          version: value.version,
          code: value.code,
        })),
      });
    }
    return result;
  }, [objects]);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {summaries.map((summary) => (
          <div key={summary.environment} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <EnvironmentBadge environment={summary.environment} />
              <span className="text-sm font-medium">{ENVIRONMENT_LABELS[summary.environment]}</span>
            </div>
            <dl className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Objetos documentados</dt>
                <dd className="font-semibold">{summary.objectsDocumented}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Versiones de código</dt>
                <dd className="font-semibold">{summary.versions}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3 w-3" /> Última actualización
                </dt>
                <dd>{formatDate(summary.lastUpdate) || "—"}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1 text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3" /> Última verificación
                </dt>
                <dd>{formatDate(summary.lastVerified) || "—"}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-semibold">
            Objetos con diferencias entre ambientes ({differences.length})
          </h2>
        </div>
        {differences.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
            No se detectaron diferencias de código entre ambientes.
          </p>
        ) : (
          <ul className="space-y-2">
            {differences.map(({ object, envs }) => (
              <li key={object.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <ObjectTypeBadge type={object.object_type} />
                  <Link
                    href={`/knowledge/objects/${object.id}`}
                    className="font-mono text-sm font-medium hover:text-primary"
                  >
                    {object.schema_name}.{object.object_name}
                  </Link>
                </div>
                <div className="mt-2 flex flex-wrap gap-3">
                  {envs.map((env) => (
                    <span key={env.environment} className="flex items-center gap-1.5 text-xs">
                      <EnvironmentBadge environment={env.environment} />
                      <span className="font-mono text-muted-foreground">v{env.version}</span>
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
