-- ============================================================================
-- ORACLE KNOWLEDGE HUB — CARPETAS PARA CONSULTAS SQL
-- Ejecutar DESPUÉS de supabase/oracle-hub.sql y oracle-hub-private.sql.
-- Idempotente: se puede ejecutar varias veces.
--
-- Cada consulta puede pertenecer a una carpeta (ruta simple, por ejemplo
-- "Tiquetes" o "Tiquetes/Cierre"). null = sin carpeta.
-- ============================================================================

alter table public.sql_snippets
  add column if not exists folder text;

create index if not exists idx_snippets_folder
  on public.sql_snippets(user_id, folder);
