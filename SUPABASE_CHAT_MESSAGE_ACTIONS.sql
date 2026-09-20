-- EduGuide PH - per-message feedback, regeneration support, and prompt deletion
-- The live EduGuide PH Supabase project has already received this upgrade.

begin;

alter table public.chat_messages
  add column if not exists feedback text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chat_messages_feedback_check'
      and conrelid = 'public.chat_messages'::regclass
  ) then
    alter table public.chat_messages
      add constraint chat_messages_feedback_check
      check (feedback is null or feedback in ('like', 'dislike'));
  end if;
end
$$;

drop policy if exists "Users can update own chat messages" on public.chat_messages;
create policy "Users can update own chat messages"
on public.chat_messages
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own chat messages" on public.chat_messages;
create policy "Users can delete own chat messages"
on public.chat_messages
for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke update on table public.chat_messages from authenticated;
grant update (content, feedback) on table public.chat_messages to authenticated;
grant delete on table public.chat_messages to authenticated;

commit;
