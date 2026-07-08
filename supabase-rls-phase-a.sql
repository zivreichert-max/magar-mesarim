-- Phase A: enable RLS without breaking anything the app does today.
-- Blocks deletes/updates the app never uses; adds length caps against spam.
-- Safe to re-run (drop policy if exists before each create).
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.

-- comments: select + insert only
alter table comments enable row level security;
drop policy if exists comments_select on comments;
drop policy if exists comments_insert on comments;
create policy comments_select on comments for select using (true);
create policy comments_insert on comments for insert
  with check (char_length(body) <= 2000 and char_length(author_name) <= 100);

-- suggestions: insert + select + status update only
alter table suggestions enable row level security;
drop policy if exists suggestions_select on suggestions;
drop policy if exists suggestions_insert on suggestions;
drop policy if exists suggestions_update on suggestions;
create policy suggestions_select on suggestions for select using (true);
create policy suggestions_insert on suggestions for insert
  with check (char_length(description) <= 4000 and char_length(subtopic) <= 300 and char_length(author_name) <= 100);
create policy suggestions_update on suggestions for update
  using (true) with check (status in ('pending', 'approved', 'rejected'));

-- client_requests
alter table client_requests enable row level security;
drop policy if exists client_requests_all on client_requests;
create policy client_requests_all on client_requests for all
  using (true) with check (char_length(description) <= 4000 and char_length(subtopic) <= 300);

-- shares
alter table message_shares enable row level security;
alter table paper_shares enable row level security;
alter table workplan_shares enable row level security;
drop policy if exists message_shares_all on message_shares;
drop policy if exists paper_shares_all on paper_shares;
drop policy if exists workplan_shares_all on workplan_shares;
create policy message_shares_all on message_shares for all using (true) with check (true);
create policy paper_shares_all on paper_shares for all using (true) with check (true);
create policy workplan_shares_all on workplan_shares for all using (true) with check (true);

-- site_sessions
alter table site_sessions enable row level security;
drop policy if exists site_sessions_select on site_sessions;
drop policy if exists site_sessions_insert on site_sessions;
drop policy if exists site_sessions_update on site_sessions;
create policy site_sessions_select on site_sessions for select using (true);
create policy site_sessions_insert on site_sessions for insert with check (char_length(user_label) <= 100);
create policy site_sessions_update on site_sessions for update using (true) with check (true);

-- manual_schedule_events
alter table manual_schedule_events enable row level security;
drop policy if exists manual_events_select on manual_schedule_events;
drop policy if exists manual_events_insert on manual_schedule_events;
drop policy if exists manual_events_update on manual_schedule_events;
create policy manual_events_select on manual_schedule_events for select using (true);
create policy manual_events_insert on manual_schedule_events for insert
  with check (char_length(title) <= 300 and char_length(detail) <= 8000);
create policy manual_events_update on manual_schedule_events for update using (true) with check (true);

-- knesset_sessions / knesset_updates (sync route writes with anon key)
alter table knesset_sessions enable row level security;
alter table knesset_updates enable row level security;
drop policy if exists knesset_sessions_rw on knesset_sessions;
drop policy if exists knesset_updates_rw on knesset_updates;
create policy knesset_sessions_rw on knesset_sessions for all using (true) with check (true);
create policy knesset_updates_rw on knesset_updates for all using (true) with check (true);

-- cbs_price_data: select + upsert (cbs sync scripts use anon key), no delete
alter table cbs_price_data enable row level security;
drop policy if exists cbs_select on cbs_price_data;
drop policy if exists cbs_insert on cbs_price_data;
drop policy if exists cbs_update on cbs_price_data;
create policy cbs_select on cbs_price_data for select using (true);
create policy cbs_insert on cbs_price_data for insert with check (true);
create policy cbs_update on cbs_price_data for update using (true) with check (true);
