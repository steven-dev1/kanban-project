"use client";

import { displayObjectName } from "@/lib/knowledge/format";
import type { OracleObjectWithRelations } from "@/lib/types";

const NODE_W = 190;
const NODE_H = 52;

interface GraphNode {
  id: string;
  label: string;
  type: OracleObjectWithRelations["object_type"];
  x: number;
  y: number;
}

export function RelationsGraph({ object }: { object: OracleObjectWithRelations }) {
  const incoming = object.relations_as_target;
  const outgoing = object.relations_as_source;

  if (incoming.length === 0 && outgoing.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">
        Este objeto no tiene relaciones para graficar.
      </p>
    );
  }

  const height = Math.max(incoming.length, outgoing.length, 1) * 78 + 80;
  const centerY = height / 2;
  const width = 820;

  const nodes: GraphNode[] = [];
  incoming.forEach((relation, index) => {
    nodes.push({
      id: relation.source_object.id,
      label: `${relation.source_object.schema_name}.${relation.source_object.object_name}`,
      type: relation.source_object.object_type,
      x: 20,
      y: 40 + index * 78,
    });
  });
  outgoing.forEach((relation, index) => {
    nodes.push({
      id: relation.target_object.id,
      label: displayObjectName(
        relation.target_object.schema_name,
        relation.target_object.object_name,
      ),
      type: relation.target_object.object_type,
      x: width - NODE_W - 20,
      y: 40 + index * 78,
    });
  });

  const center = {
    x: width / 2 - NODE_W / 2,
    y: centerY - NODE_H / 2,
    label: displayObjectName(object.schema_name, object.object_name),
  };

  return (
    <div className="overflow-auto rounded-xl border border-border bg-card p-2">
      <svg width={width} height={height} className="block">
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgb(148 163 184)" />
          </marker>
        </defs>

        {incoming.map((relation, index) => {
          const nodeY = 40 + index * 78 + NODE_H / 2;
          return (
            <line
              key={`in-${relation.id}`}
              x1={20 + NODE_W}
              y1={nodeY}
              x2={width / 2 - NODE_W / 2}
              y2={centerY}
              stroke="rgb(148 163 184)"
              strokeWidth={1.5}
              markerEnd="url(#arrow)"
            />
          );
        })}

        {outgoing.map((relation, index) => {
          const nodeY = 40 + index * 78 + NODE_H / 2;
          return (
            <line
              key={`out-${relation.id}`}
              x1={width / 2 + NODE_W / 2}
              y1={centerY}
              x2={width - NODE_W - 20}
              y2={nodeY}
              stroke="rgb(148 163 184)"
              strokeWidth={1.5}
              markerEnd="url(#arrow)"
            />
          );
        })}

        {nodes.map((node) => (
          <a key={node.id} href={`/knowledge/objects/${node.id}`}>
            <title>{node.label}</title>
            <rect
              x={node.x}
              y={node.y}
              width={NODE_W}
              height={NODE_H}
              rx={10}
              className="fill-background stroke-border"
              strokeWidth={1}
            />
            <text x={node.x + 12} y={node.y + 20} className="fill-foreground text-[11px] font-medium">
              {node.type}
            </text>
            <text x={node.x + 12} y={node.y + 38} className="fill-muted-foreground text-[11px]">
              {node.label.length > 26 ? `${node.label.slice(0, 26)}…` : node.label}
            </text>
          </a>
        ))}

        <rect
          x={center.x}
          y={center.y}
          width={NODE_W}
          height={NODE_H}
          rx={10}
          className="fill-primary/10 stroke-primary"
          strokeWidth={1.5}
        />
        <text x={center.x + 12} y={center.y + 20} className="fill-primary text-[11px] font-semibold">
          {object.object_type}
        </text>
        <text
          x={center.x + 12}
          y={center.y + 38}
          className="fill-foreground text-[11px] font-medium"
        >
          {center.label.length > 26 ? `${center.label.slice(0, 26)}…` : center.label}
        </text>
      </svg>

      <div className="flex flex-wrap items-center gap-4 px-2 py-1 text-[11px] text-muted-foreground">
        <span>← Utilizado por ({incoming.length})</span>
        <span className="ml-auto">Depende de / usa ({outgoing.length}) →</span>
      </div>
    </div>
  );
}
