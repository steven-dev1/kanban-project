"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface ShortcutHandlers {
  /** Abre la ayuda de atajos (por defecto: `?`). */
  onHelp?: () => void;
  onNew?: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable ||
    target.getAttribute("role") === "textbox"
  );
}

/**
 * Atajos globales de navegación:
 *  - Ctrl+K (o Cmd+K): foco en la búsqueda del topbar
 *  - g + t/s/c/d: ir a Tablas, SQL, Columnas, Dashboard
 *  - ?: ayuda de atajos   ·   Esc se maneja en cada componente
 */
export function useKeyboardShortcuts({ onHelp, onNew }: ShortcutHandlers = {}) {
  const router = useRouter();

  useEffect(() => {
    let pendingG = false;

    const focusSearch = () => {
      const input = document.querySelector<HTMLInputElement>(
        'input[placeholder*="Buscar"], input[data-shortcut-search]',
      );
      if (input) {
        input.focus();
        input.select();
      } else {
        router.push("/knowledge/search");
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const typing = isTypingTarget(e.target);

      // Ctrl/Cmd + K → buscar
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        focusSearch();
        return;
      }

      // Ctrl/Cmd + N → nuevo (delegado o botón con data-shortcut-new)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        if (onNew) {
          e.preventDefault();
          onNew();
          return;
        }
        const newButton = document.querySelector<HTMLButtonElement>("[data-shortcut-new]");
        if (newButton) {
          e.preventDefault();
          newButton.click();
          return;
        }
      }

      if (typing || e.ctrlKey || e.metaKey || e.altKey) {
        pendingG = false;
        return;
      }

      if (e.key === "?") {
        e.preventDefault();
        onHelp?.();
        return;
      }

      if (e.key.toLowerCase() === "g") {
        pendingG = true;
        window.setTimeout(() => {
          pendingG = false;
        }, 1200);
        return;
      }

      if (pendingG) {
        const map: Record<string, string> = {
          t: "/knowledge/tables",
          s: "/knowledge/sql",
          c: "/knowledge/columns",
          d: "/knowledge",
          r: "/knowledge/recent",
          f: "/knowledge/favorites",
        };
        const target = map[e.key.toLowerCase()];
        if (target) {
          e.preventDefault();
          router.push(target);
        }
        pendingG = false;
        return;
      }

      if (e.key === "/") {
        e.preventDefault();
        focusSearch();
        return;
      }

      // Atajos de lista: n = nuevo, x = seleccionar, c = copiar primero visible.
      if (e.key.toLowerCase() === "n") {
        const newButton = document.querySelector<HTMLButtonElement>("[data-shortcut-new]");
        if (newButton) {
          e.preventDefault();
          newButton.click();
        }
        return;
      }
      if (e.key.toLowerCase() === "x") {
        const checkbox = document.querySelector<HTMLInputElement>(
          "[data-shortcut-row] input[type=checkbox]",
        );
        if (checkbox) {
          e.preventDefault();
          checkbox.click();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, onHelp, onNew]);
}
