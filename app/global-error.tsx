"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#0b0b0f",
          color: "#f4f4f5",
          fontFamily: "system-ui, sans-serif",
          padding: "32px",
        }}
      >
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>
          La aplicación falló al cargar
        </h1>
        <p style={{ color: "#a1a1aa", fontSize: 14, marginBottom: 16 }}>
          Copia este mensaje y compártelo para diagnosticar:
        </p>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            background: "#17171d",
            border: "1px solid #2a2a32",
            borderRadius: 12,
            padding: 16,
            fontSize: 13,
            color: "#fca5a5",
            maxHeight: "50vh",
            overflow: "auto",
          }}
        >
          {error?.name}: {error?.message}
          {"\n\n"}
          {error?.stack}
        </pre>
        <button
          onClick={() => reset()}
          style={{
            marginTop: 16,
            background: "#6366f1",
            color: "white",
            border: 0,
            borderRadius: 8,
            padding: "10px 16px",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
