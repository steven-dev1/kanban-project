"use client";

import { useEffect } from "react";

export function RuntimeDiagnostics() {
  useEffect(() => {
    document.documentElement.setAttribute("data-boot", "on");

    const box = document.getElementById("runtime-errors");
    const push = (label: string, msg: string) => {
      if (!box) return;
      box.setAttribute("data-open", "1");
      const line = document.createElement("div");
      line.textContent = `[${label}] ${msg}`;
      box.appendChild(line);
    };

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      push(
        "env",
        `Faltan variables en el cliente (URL: ${url ?? "undefined"}, KEY: ${
          key ? "definida" : "undefined"
        })`,
      );
    }

    const onError = (e: ErrorEvent) =>
      push("error", `${e.message} ${e.filename ?? ""}:${e.lineno ?? ""}`);
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      push("promise", r && r.message ? r.message : String(r));
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
