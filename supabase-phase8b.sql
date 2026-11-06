-- Trainingsplaner Oedheim – Phase 8b: freiwilliges Feedback (mit Namen oder anonym)
-- Baut auf supabase-einrichtung.sql und supabase-phase8a.sql auf. In Supabase → SQL Editor einfügen und „Run“.
--
-- Anonym heißt: Es wird KEINE Kennung gespeichert – nur Thema, Nachricht und Datum (ohne Uhrzeit).
-- Spielerinnen schreiben nie direkt in die Tabelle, sondern nur über feedback_senden(). Die Funktion prüft,
-- ob ein aktiver Zugang besteht, und lässt bei „anonym“ Name, Kennung und Uhrzeit weg.

create table if not exists public.feedback (
  id           uuid primary key default gen_random_uuid(),
  team         text not null,
  thema        text not null check (thema in ('training','spiele','mannschaft','trainerteam','sonstiges')),
  nachricht    text not null check (length(btrim(nachricht)) between 1 and 4000),
  anonym       boolean not null,
  spielerin_id text,                         -- nur bei Feedback mit Namen
  name         text,                         -- nur bei Feedback mit Namen
  datum        date not null default current_date,
  gesendet_am  timestamptz,                  -- nur bei Feedback mit Namen
  status       text not null default 'neu' check (status in ('neu','gelesen','erledigt')),
  notiz        text not null default '',     -- nur für Trainer sichtbar
  constraint anonym_ohne_kennung check (not anonym or (spielerin_id is null and name is null and gesendet_am is null)),
  constraint name_mit_kennung    check (anonym or spielerin_id is not null)
);
create index if not exists feedback_team on public.feedback (team, datum desc);

alter table public.feedback enable row level security;

-- Trainer: lesen, Status/Notiz ändern, löschen – nur im eigenen Team. Niemand legt direkt Zeilen an.
drop policy if exists "feedback trainer lesen" on public.feedback;
create policy "feedback trainer lesen" on public.feedback for select to authenticated using (public.ist_mitglied(team));
drop policy if exists "feedback trainer aendern" on public.feedback;
create policy "feedback trainer aendern" on public.feedback for update to authenticated using (public.ist_mitglied(team)) with check (public.ist_mitglied(team));
drop policy if exists "feedback trainer loeschen" on public.feedback;
create policy "feedback trainer loeschen" on public.feedback for delete to authenticated using (public.ist_mitglied(team));

-- Spalten-Rechte: Trainer dürfen nur Status und Notiz ändern, nie Nachricht, Name oder „anonym“.
revoke all on public.feedback from anon;
revoke insert, update on public.feedback from authenticated;
grant select, delete on public.feedback to authenticated;
grant update (status, notiz) on public.feedback to authenticated;

-- Senden (nur Spielerinnen mit aktivem Zugang)
create or replace function public.feedback_senden(p_thema text, p_nachricht text, p_anonym boolean) returns void
language plpgsql security definer set search_path = public as $$
declare z record;
begin
  select team, spielerin_id, name into z from public.zugaenge
  where aktiv and lower(email) = public.meine_email() and public.meine_email() <> '' limit 1;
  if not found then raise exception 'Kein aktiver Zugang'; end if;
  if p_anonym then
    insert into public.feedback (team, thema, nachricht, anonym) values (z.team, p_thema, btrim(p_nachricht), true);
  else
    insert into public.feedback (team, thema, nachricht, anonym, spielerin_id, name, gesendet_am)
    values (z.team, p_thema, btrim(p_nachricht), false, z.spielerin_id, z.name, now());
  end if;
end $$;
revoke all on function public.feedback_senden(text, text, boolean) from public, anon;
grant execute on function public.feedback_senden(text, text, boolean) to authenticated;

-- Eigenes Feedback mit Namen ansehen (ohne die Trainer-Notiz)
create or replace function public.meine_feedbacks() returns table (id uuid, thema text, nachricht text, datum date, gesendet_am timestamptz, status text)
language sql stable security definer set search_path = public as $$
  select f.id, f.thema, f.nachricht, f.datum, f.gesendet_am, f.status
  from public.feedback f join public.zugaenge z on z.team = f.team and z.spielerin_id = f.spielerin_id
  where not f.anonym and z.aktiv and lower(z.email) = public.meine_email() and public.meine_email() <> ''
  order by f.gesendet_am desc;
$$;
revoke all on function public.meine_feedbacks() from public, anon;
grant execute on function public.meine_feedbacks() to authenticated;
