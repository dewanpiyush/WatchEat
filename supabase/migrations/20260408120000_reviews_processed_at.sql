alter table public.reviews
  add column if not exists processed_at timestamptz;
