-- Habilitar pgvector (no falla si ya existe)
create extension if not exists vector;

-- Agregar columna vector(512) para embeddings CLIP
alter table public.reports
  add column if not exists embedding vector(512);

-- (Opcional) mantener el jsonb histórico sin tocarlo:
--   image_embedding jsonb  (ya existe)

-- Índice IVF por cosine (para kNN rápido)
create index if not exists idx_reports_embedding_ivf
  on public.reports using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Seguridad básica: solo el servicio escribe el embedding
revoke update (embedding) on public.reports from anon, authenticated;
