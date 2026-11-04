-- Trainingsplaner Oedheim – Datenbank für gemeinsame Daten
-- Einmal komplett in Supabase → SQL Editor einfügen und „Run“ drücken.
-- Danach ganz unten die E-Mail-Adressen der Trainer eintragen (eigene Zeile pro Person) und erneut „Run“.

-- 1) Tabellen ---------------------------------------------------------------
-- Ein Eintrag pro Dokument der App (Kader, Einstellungen, jede Übung, jedes Training, jeder Spielbericht).
create table if not exists public.docs (
  team        text    not null,
  coll        text    not null check (coll in ('meta','uebungen','trainings','spiele')),
  id          text    not null,
  data        jsonb,
  deleted     boolean not null default false,
  updated_at  bigint  not null,                 -- Zeitpunkt der Änderung auf dem Gerät (ms) – neuere gewinnt
  updated_by  uuid    default auth.uid(),
  server_ts   timestamptz not null default now(), -- wann der Server es bekommen hat (für „was ist neu?“)
  primary key (team, coll, id)
);
create index if not exists docs_team_ts on public.docs (team, server_ts);

-- Wer gehört zu welchem Team (nur diese E-Mails sehen und ändern die Daten).
create table if not exists public.mitglieder (
  team  text not null,
  email text not null,
  primary key (team, email)
);

-- 2) Zugriffsschutz (Row Level Security) -------------------------------------
alter table public.docs enable row level security;
alter table public.mitglieder enable row level security;

create or replace function public.ist_mitglied(p_team text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mitglieder m
                 where m.team = p_team and lower(m.email) = lower(auth.jwt() ->> 'email'));
$$;

drop policy if exists "eigene Teams sehen" on public.mitglieder;
create policy "eigene Teams sehen" on public.mitglieder for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "team lesen" on public.docs;
create policy "team lesen" on public.docs for select to authenticated using (public.ist_mitglied(team));
drop policy if exists "team anlegen" on public.docs;
create policy "team anlegen" on public.docs for insert to authenticated with check (public.ist_mitglied(team));
drop policy if exists "team aendern" on public.docs;
create policy "team aendern" on public.docs for update to authenticated using (public.ist_mitglied(team)) with check (public.ist_mitglied(team));
-- Löschen gibt es bewusst nicht: gelöschte Einträge werden nur als „deleted“ markiert, damit alle Geräte es mitbekommen.

-- 3) Hochladen: nur übernehmen, wenn die Änderung neuer ist als die gespeicherte ---------------
create or replace function public.push_docs(p_team text, p_docs jsonb) returns void
language sql security invoker set search_path = public as $$
  insert into public.docs as d (team, coll, id, data, deleted, updated_at, server_ts, updated_by)
  select p_team, x->>'coll', x->>'id', x->'data', coalesce((x->>'deleted')::boolean, false), (x->>'updated_at')::bigint, now(), auth.uid()
  from jsonb_array_elements(p_docs) x
  on conflict (team, coll, id) do update
    set data = excluded.data, deleted = excluded.deleted, updated_at = excluded.updated_at,
        server_ts = now(), updated_by = auth.uid()
    where d.updated_at < excluded.updated_at;
$$;
grant execute on function public.push_docs(text, jsonb) to authenticated;

-- 4) Trainer freischalten – hier die E-Mail-Adressen eintragen ---------------
-- Teamname frei wählbar, aber für alle gleich. Weitere Trainer: weitere Zeile.
insert into public.mitglieder (team, email) values
  ('oedheim-damen', 'DEINE-EMAIL@beispiel.de')
-- , ('oedheim-damen', 'co-trainer@beispiel.de')
on conflict do nothing;
