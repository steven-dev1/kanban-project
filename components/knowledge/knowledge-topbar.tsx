"use client";

import { Input } from "@/components/ui/input";
import { BookOpen, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function KnowledgeTopbar() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(
      `/knowledge/search${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`,
    );
  };

  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-3 md:px-5">
      <Link href="/knowledge" className="flex shrink-0 items-center gap-2 text-sm font-semibold">
        <BookOpen className="h-4 w-4 text-primary" />
        <span className="hidden sm:inline">Diccionario de Datos</span>
      </Link>
      <form onSubmit={submit} className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar en todo el conocimiento técnico…"
          className="h-8 pl-8 text-xs"
        />
      </form>
    </div>
  );
}
