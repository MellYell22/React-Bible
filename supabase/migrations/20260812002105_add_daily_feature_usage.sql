create table if not exists public.daily_feature_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  created_at timestamptz not null default now()
);

create index if not exists daily_feature_usage_user_feature_created_idx
  on public.daily_feature_usage (user_id, feature, created_at desc);

alter table public.daily_feature_usage enable row level security;

drop policy if exists "Users can read own feature usage" on public.daily_feature_usage;
create policy "Users can read own feature usage"
  on public.daily_feature_usage
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own feature usage" on public.daily_feature_usage;
create policy "Users can insert own feature usage"
  on public.daily_feature_usage
  for insert
  with check (auth.uid() = user_id);
