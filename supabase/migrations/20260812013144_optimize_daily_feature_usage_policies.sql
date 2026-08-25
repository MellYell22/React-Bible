drop policy if exists "Users can read own feature usage" on public.daily_feature_usage;
create policy "Users can read own feature usage"
  on public.daily_feature_usage
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own feature usage" on public.daily_feature_usage;
create policy "Users can insert own feature usage"
  on public.daily_feature_usage
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);
