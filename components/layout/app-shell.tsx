"use client";

import { Avatar, Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { useAuth } from "@/providers/auth-provider";
import { KanbanSquare, LogOut, Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Notifications } from "./notifications";
import { Sidebar } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, profile, signOut, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading && !user) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        Cargando...
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card md:block">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <KanbanSquare className="h-4 w-4" />
          </span>
          <span className="font-semibold">Kanban</span>
        </div>
        <div className="h-[calc(100%-3.5rem)]">
          <Sidebar />
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative h-full w-72 border-r border-border bg-card">
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <KanbanSquare className="h-4 w-4" />
                </span>
                <span className="font-semibold">Kanban</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="p-1">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="h-[calc(100%-3.5rem)]">
              <Sidebar onNavigate={() => setMobileOpen(false)} />
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 md:px-5">
          <button
            className="rounded-lg p-2 hover:bg-muted md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden md:block" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user && <Notifications userId={user.id} />}
            <Dropdown
              trigger={
                <button className="flex items-center gap-2 rounded-lg p-0.5 hover:bg-muted">
                  <Avatar name={profile?.full_name} email={user?.email} size={32} />
                </button>
              }
            >
              {(close) => (
                <div>
                  <div className="border-b border-border px-3 py-2">
                    <p className="truncate text-sm font-medium">
                      {profile?.full_name || "Usuario"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                  <DropdownItem
                    onClick={() => {
                      close();
                      signOut();
                    }}
                    danger
                  >
                    <LogOut className="h-4 w-4" /> Cerrar sesión
                  </DropdownItem>
                </div>
              )}
            </Dropdown>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
