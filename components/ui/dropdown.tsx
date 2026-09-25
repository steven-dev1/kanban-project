"use client";

import { cn, initials } from "@/lib/utils";
import { useEffect, useRef, useState, type ReactNode } from "react";

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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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
      {open && (
        <div
          className={cn(
            "animate-menu absolute z-40 mt-2 min-w-[200px] rounded-xl border border-border bg-card p-1.5 shadow-xl",
            align === "end" ? "right-0" : "left-0",
            panelClassName,
          )}
        >
          {children(() => setOpen(false))}
        </div>
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
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      title={name || email || ""}
    >
      {initials(name, email)}
    </span>
  );
}
