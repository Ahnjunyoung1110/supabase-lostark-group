-- Allow already-authenticated users to create their missing profile row.
-- This covers users who signed up before the auth.users -> public.profiles trigger existed
-- or whose profile row was otherwise missing.

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);
