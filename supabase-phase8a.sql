-- Trainingsplaner Oedheim – Phase 8a: Spielerinnen-Zugang, Freigaben, Lesebestätigung, Reaktionen
-- Baut auf supabase-einrichtung.sql auf (Tabellen docs, mitglieder, Funktion ist_mitglied).
-- Einmal komplett in Supabase → SQL Editor einfügen und „Run“. Mehrfaches Ausführen schadet nicht.
--
-- Grundsatz: Trainer (Tabelle mitglieder) dürfen alles in ihrem Team. Spielerinnen (Tabelle zugaenge) sehen
-- nur Freigaben, die an sie gehen und nicht zurückgezogen sind, und schreiben nur ihre eigene Lesebestätigung
-- und Reaktion. An die Trainerdaten (docs) kommen sie nie – sie stehen nicht in mitglieder.

-- 1) Tabellen --------------------------------------------------------------------
create table if not exists public.zugaenge (
  team         text not null,
  spielerin_id text not null,                 -- Kennung der Spielerin im Kader der App
  email        text not null,
  name         text not null default '',
  aktiv        boolean not null default true,
  erstellt_am  timestamptz not null default now(),
  primary key (team, spielerin_id)
);
create unique index if not exists zugaenge_team_email on public.zugaenge (team, lower(email));

create table if not exists public.freigaben (
  id             uuid primary key default gen_random_uuid(),
  team           text not null,
  art            text not null check (art in ('analyse','beobachtung','bild','clip','kommentar')),
  titel          text not null default '',
  text           text not null default '',
  inhalt         jsonb not null default '{}'::jsonb,   -- Kopie der freigegebenen Inhalte (Punkte, Bilder, Links)
  quelle         jsonb,                                -- woher (z. B. {"spiel":"…","punkt":"…"}), nur für Trainer
  erstellt_von   uuid default auth.uid(),
  erstellt_am    timestamptz not null default now(),
  geaendert_am   timestamptz not null default now(),
  zurueckgezogen boolean not null default false
);
create index if not exists freigaben_team on public.freigaben (team, erstellt_am desc);

create table if not exists public.freigabe_empfaenger (
  freigabe_id  uuid not null references public.freigaben(id) on delete cascade,
  team         text not null,
  spielerin_id text not null,
  primary key (freigabe_id, spielerin_id)
);

create table if not exists public.gelesen (
  freigabe_id  uuid not null references public.freigaben(id) on delete cascade,
  team         text not null,
  spielerin_id text not null,
  zuerst_am    timestamptz not null default now(),
  zuletzt_am   timestamptz not null default now(),
  primary key (freigabe_id, spielerin_id)
);

create table if not exists public.reaktionen (
  freigabe_id  uuid not null references public.freigaben(id) on delete cascade,
  team         text not null,
  spielerin_id text not null,
  art          text check (art in ('verstanden','unsicher','gut','besprechen')),
  kommentar    text not null default '',
  am           timestamptz not null default now(),
  primary key (freigabe_id, spielerin_id)
);

-- 2) Hilfsfunktionen (security definer: lesen intern, ohne selbst an RLS zu scheitern) --------
create or replace function public.meine_email() returns text
language sql stable set search_path = public as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

-- Kennung der angemeldeten Spielerin in einem Team (nur aktive Zugänge), sonst null
create or replace function public.meine_spielerin(p_team text) returns text
language sql stable security definer set search_path = public as $$
  select z.spielerin_id from public.zugaenge z
  where z.team = p_team and z.aktiv and lower(z.email) = public.meine_email() and public.meine_email() <> ''
  limit 1;
$$;

-- Team einer Freigabe
create or replace function public.freigabe_team(p_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select f.team from public.freigaben f where f.id = p_id;
$$;

-- Ist die angemeldete Person die Spielerin p_sp und Empfängerin der (nicht zurückgezogenen) Freigabe?
create or replace function public.ist_empfaengerin(p_id uuid, p_sp text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.freigaben f
    join public.freigabe_empfaenger e on e.freigabe_id = f.id
    where f.id = p_id and not f.zurueckgezogen and e.spielerin_id = p_sp
      and p_sp = public.meine_spielerin(f.team));
$$;

-- Bin ich Empfängerin dieser Freigabe (egal unter welcher Kennung)?
create or replace function public.fuer_mich(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.freigaben f
    join public.freigabe_empfaenger e on e.freigabe_id = f.id
    where f.id = p_id and not f.zurueckgezogen and e.spielerin_id = public.meine_spielerin(f.team));
$$;

-- 3) Zugriffsschutz (Row Level Security) -------------------------------------------
alter table public.zugaenge            enable row level security;
alter table public.freigaben           enable row level security;
alter table public.freigabe_empfaenger enable row level security;
alter table public.gelesen             enable row level security;
alter table public.reaktionen          enable row level security;

-- Zugänge: Trainer verwalten; Spielerin sieht nur ihren eigenen aktiven Zugang
drop policy if exists "zugaenge trainer" on public.zugaenge;
create policy "zugaenge trainer" on public.zugaenge for all to authenticated
  using (public.ist_mitglied(team)) with check (public.ist_mitglied(team));
drop policy if exists "zugaenge eigener" on public.zugaenge;
create policy "zugaenge eigener" on public.zugaenge for select to authenticated
  using (aktiv and lower(email) = public.meine_email());

-- Freigaben: Trainer alles; Spielerin nur lesen, wenn an sie und nicht zurückgezogen
drop policy if exists "freigaben trainer" on public.freigaben;
create policy "freigaben trainer" on public.freigaben for all to authenticated
  using (public.ist_mitglied(team)) with check (public.ist_mitglied(team));
drop policy if exists "freigaben spielerin" on public.freigaben;
create policy "freigaben spielerin" on public.freigaben for select to authenticated
  using (public.fuer_mich(id));

-- Empfängerinnen: Trainer alles (Team muss zur Freigabe passen); Spielerin sieht nur ihre eigene Zeile
drop policy if exists "empfaenger trainer" on public.freigabe_empfaenger;
create policy "empfaenger trainer" on public.freigabe_empfaenger for all to authenticated
  using (public.ist_mitglied(team))
  with check (public.ist_mitglied(team) and team = public.freigabe_team(freigabe_id));
drop policy if exists "empfaenger spielerin" on public.freigabe_empfaenger;
create policy "empfaenger spielerin" on public.freigabe_empfaenger for select to authenticated
  using (public.ist_empfaengerin(freigabe_id, spielerin_id));

-- Gelesen: Trainer lesen; Spielerin liest/schreibt nur ihre eigene Zeile zu Freigaben an sie
drop policy if exists "gelesen trainer" on public.gelesen;
create policy "gelesen trainer" on public.gelesen for select to authenticated using (public.ist_mitglied(team));
drop policy if exists "gelesen spielerin lesen" on public.gelesen;
create policy "gelesen spielerin lesen" on public.gelesen for select to authenticated
  using (public.ist_empfaengerin(freigabe_id, spielerin_id));
drop policy if exists "gelesen spielerin anlegen" on public.gelesen;
create policy "gelesen spielerin anlegen" on public.gelesen for insert to authenticated
  with check (public.ist_empfaengerin(freigabe_id, spielerin_id) and team = public.freigabe_team(freigabe_id));
drop policy if exists "gelesen spielerin aendern" on public.gelesen;
create policy "gelesen spielerin aendern" on public.gelesen for update to authenticated
  using (public.ist_empfaengerin(freigabe_id, spielerin_id))
  with check (public.ist_empfaengerin(freigabe_id, spielerin_id) and team = public.freigabe_team(freigabe_id));

-- Reaktionen: Trainer lesen; Spielerin verwaltet nur ihre eigene Reaktion
drop policy if exists "reaktionen trainer" on public.reaktionen;
create policy "reaktionen trainer" on public.reaktionen for select to authenticated using (public.ist_mitglied(team));
drop policy if exists "reaktionen spielerin lesen" on public.reaktionen;
create policy "reaktionen spielerin lesen" on public.reaktionen for select to authenticated
  using (public.ist_empfaengerin(freigabe_id, spielerin_id));
drop policy if exists "reaktionen spielerin anlegen" on public.reaktionen;
create policy "reaktionen spielerin anlegen" on public.reaktionen for insert to authenticated
  with check (public.ist_empfaengerin(freigabe_id, spielerin_id) and team = public.freigabe_team(freigabe_id));
drop policy if exists "reaktionen spielerin aendern" on public.reaktionen;
create policy "reaktionen spielerin aendern" on public.reaktionen for update to authenticated
  using (public.ist_empfaengerin(freigabe_id, spielerin_id))
  with check (public.ist_empfaengerin(freigabe_id, spielerin_id) and team = public.freigabe_team(freigabe_id));
drop policy if exists "reaktionen spielerin loeschen" on public.reaktionen;
create policy "reaktionen spielerin loeschen" on public.reaktionen for delete to authenticated
  using (public.ist_empfaengerin(freigabe_id, spielerin_id));

-- Nicht angemeldete Besucher (anon) bekommen auf keine dieser Tabellen Rechte
revoke all on public.zugaenge, public.freigaben, public.freigabe_empfaenger, public.gelesen, public.reaktionen from anon;
