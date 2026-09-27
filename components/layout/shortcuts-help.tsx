"use client";

import { Modal } from "@/components/ui/modal";

interface ShortcutGroup {
  title: string;
  items: { keys: string; description: string }[];
}

const GROUPS: ShortcutGroup[] = [
  {
    title: "Navegación",
    items: [
      { keys: "Ctrl + K", description: "Buscar (foco en el buscador)" },
      { keys: "/", description: "Buscar" },
      { keys: "g luego t", description: "Ir a Tablas y vistas" },
      { keys: "g luego s", description: "Ir a Consultas SQL" },
      { keys: "g luego c", description: "Ir a Columnas" },
      { keys: "g luego d", description: "Ir al inicio del diccionario" },
      { keys: "g luego r", description: "Ir a Recientes" },
      { keys: "g luego f", description: "Ir a Favoritos" },
    ],
  },
  {
    title: "Acciones",
    items: [
      { keys: "Ctrl + N", description: "Nuevo (objeto o consulta según la sección)" },
      { keys: "?", description: "Mostrar esta ayuda" },
      { keys: "Esc", description: "Cerrar diálogos y menús" },
    ],
  },
  {
    title: "Editor de código",
    items: [
      { keys: "Ctrl + S", description: "Guardar" },
      { keys: "Ctrl + Enter", description: "Guardar y salir de edición" },
      { keys: "Shift + Alt + F", description: "Formatear SQL" },
      { keys: "Tab / Shift + Tab", description: "Indentar / desindentar" },
      { keys: "Enter", description: "Auto-indenta bloques (BEGIN, THEN, LOOP, IS…)" },
    ],
  },
];

export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Atajos de teclado" size="lg">
      <div className="space-y-5">
        {GROUPS.map((group) => (
          <section key={group.title} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.title}
            </h3>
            <ul className="space-y-1">
              {group.items.map((item) => (
                <li
                  key={item.keys}
                  className="flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 text-sm odd:bg-muted/40"
                >
                  <span className="text-muted-foreground">{item.description}</span>
                  <kbd className="shrink-0 rounded border border-border bg-muted px-2 py-0.5 font-mono text-[11px] font-semibold">
                    {item.keys}
                  </kbd>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  );
}
