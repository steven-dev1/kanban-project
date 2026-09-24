"use client";

import { useBoard } from "@/providers/board-provider";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const STATUS_COLORS = ["#ef4444", "#f59e0b", "#22c55e"];

export function ChartsView() {
  const { lists, labels } = useBoard();

  const cards = useMemo(() => lists.flatMap((l) => l.cards), [lists]);

  const byList = useMemo(
    () =>
      lists.map((l) => ({
        name: l.title,
        cards: l.cards.length,
        color: l.color ?? "#6366f1",
      })),
    [lists],
  );

  const byLabel = useMemo(
    () =>
      labels
        .map((label) => ({
          name: label.name,
          value: cards.filter((c) => c.card_labels?.some((cl) => cl.label_id === label.id))
            .length,
          color: label.color,
        }))
        .filter((c) => c.value > 0),
    [labels, cards],
  );

  const byDeadline = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity -- comparing against the current clock is time-dependent
    const now = Date.now();
    let overdue = 0;
    let upcoming = 0;
    let none = 0;
    for (const card of cards) {
      if (!card.due_date) {
        none++;
        continue;
      }
      const due = new Date(card.due_date).setHours(23, 59, 59, 999);
      if (due < now) overdue++;
      else upcoming++;
    }
    return [
      { name: "Vencidas", value: overdue },
      { name: "Próximas", value: upcoming },
      { name: "Sin fecha", value: none },
    ].filter((d) => d.value > 0);
  }, [cards]);

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Cards por lista">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byList} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="cards" radius={[6, 6, 0, 0]}>
                {byList.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Cards por etiqueta">
          {byLabel.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={byLabel} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {byLabel.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Estado de fechas límite">
          {byDeadline.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={byDeadline}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  label
                >
                  {byDeadline.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={STATUS_COLORS[index % STATUS_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Resumen">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Total de cards" value={cards.length} />
            <Stat label="Listas" value={lists.length} />
            <Stat label="Etiquetas" value={labels.length} />
            <Stat label="Con fecha límite" value={cards.filter((c) => c.due_date).length} />
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
      No hay datos suficientes
    </div>
  );
}
