"use client";

import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

const ICONS = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

const STYLES: Record<ToastType, string> = {
  success: "text-green-600 dark:text-green-400",
  error: "text-danger",
  info: "text-primary",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = "success") => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
      setTimeout(() => remove(id), 4500);
    },
    [remove],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end">
        {toasts.map((t) => {
          const Icon = ICONS[t.type];
          return (
            <div
              key={t.id}
              role="status"
              className="animate-toast pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-border bg-card p-3.5 shadow-xl ring-1 ring-black/5 dark:ring-white/5"
            >
              <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", STYLES[t.type])} />
              <p className="flex-1 text-sm text-foreground">{t.message}</p>
              <button
                onClick={() => remove(t.id)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Cerrar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
