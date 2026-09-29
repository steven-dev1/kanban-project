"use client";

import { cn, initials } from "@/lib/utils";
import { UserRound } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface Position {
  top: number;
  left: number;
  minWidth: number;
}

export function Dropdown({
  trigger,
  children,
  align = "end",
  className,
  panelClassName,
}: {
  trigger: ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "start" | "end";
  className?: string;
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);

  // El panel se dibuja en un portal para escapar de cualquier `overflow`
  // (tablas, tarjetas) que recortaba el menú. Se posiciona con el rect del
  // trigger, alineado a la derecha o izquierda según `align`.
  useLayoutEffect(() => {
    if (!open) return;
    const el = ref.current;
    const rect = el?.getBoundingClientRect();
    const margin = 8;
    const minWidth = rect ? Math.min(Math.max(rect.width, 200), 320) : 200;

    const update = () => {
      const anchor = ref.current;
      const panel = panelRef.current;
      if (!anchor || !panel) return;
      const a = anchor.getBoundingClientRect();
      const panelWidth = panel.offsetWidth || minWidth;
      const panelHeight = panel.offsetHeight || 0;

      let left = align === "end" ? a.right - panelWidth : a.left;
      left = Math.max(margin, Math.min(left, window.innerWidth - panelWidth - margin));

      let top = a.bottom + 8;
      if (panelHeight && top + panelHeight > window.innerHeight - margin) {
        top = Math.max(margin, a.top - panelHeight - 8);
      }
      setPosition((prev) =>
        prev && prev.top === top && prev.left === left && prev.minWidth === minWidth
          ? prev
          : { top, left, minWidth },
      );
    };

    // Se recalcula cuando el panel cambia de tamaño (contenido asíncrono) y en
    // scroll/resize. Sin esto, el primer render medía mal y el menú aparecía
    // desplazado hasta reabrirlo.
    const observer = new ResizeObserver(update);
    if (panelRef.current) observer.observe(panelRef.current);
    update();

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              minWidth: position?.minWidth ?? 200,
              maxWidth: "min(360px, calc(100vw - 16px))",
              opacity: position ? 1 : 0,
            }}
            className={cn(
              "animate-menu z-[100] rounded-xl border border-border bg-card p-1.5 shadow-xl",
              panelClassName,
            )}
          >
            {children(close)}
          </div>,
          document.body,
        )}
    </div>
  );
}

export function DropdownItem({
  children,
  onClick,
  className,
  danger,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
        danger && "text-danger hover:bg-danger/10",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Avatar({
  name,
  email,
  size = 32,
  className,
}: {
  name?: string | null;
  email?: string | null;
  size?: number;
  className?: string;
}) {
  const text = initials(name, email);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      title={name || email || "Usuario"}
    >
      {text || <UserRound style={{ width: size * 0.55, height: size * 0.55 }} />}
    </span>
  );
}
