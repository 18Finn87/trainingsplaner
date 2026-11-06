-- Trainingsplaner Oedheim – Phase 9: Termine mit Zu-/Absage, Abwesenheiten, Mitteilungen, Umfragen,
-- Dienste, Fahrgemeinschaften, Mannschaftskasse, Kalender-Abo.
-- Baut auf den Skripten 8a–8c auf. In Supabase → SQL Editor einfügen und „Run“. Mehrfaches Ausführen schadet nicht.
-- Grundsatz: Trainer (mitglieder) dürfen alles im eigenen Team. Spielerinnen (aktiver Zugang) lesen, was das Team
-- betrifft, und schreiben NUR Eigenes – meist über geprüfte Funktionen.

-- ---------- Hilfen ----------
create or replace function public.ist_spielerin_im_team(p_team text) returns boolean
language sql stable security definer set search_path = public as $$ select public.meine_spielerin(p_team) is not null; $$;

-- ---------- 1) Termine und Zu-/Absagen ----------
create table if not exists public.termine (
  id uuid primary key default gen_random_uuid(),
  team text not null,
  art text not null check (art in ('training','spiel','sonstiges')),
  titel text not null default '',
  beginn timestamptz not null,
  treffen text not null default '',          -- Treffpunkt-Uhrzeit, z. B. „18:30“
  ort text not null default '',
  hinweis text not null default '',
  frist timestamptz,                           -- Antworten nur bis dahin (leer = bis Beginn)
  quelle text,                                 -- Kennung des Trainings/Spiels in der App (falls verknüpft)
  abgesagt boolean not null default false,
  aufstellung jsonb,                           -- veröffentlichte Aufstellung (nur Namen)
  erinnert_am timestamptz,
  erstellt_am timestamptz not null default now()
);
create index if not exists termine_team on public.termine (team, beginn);

create table if not exists public.zusagen (
  termin_id uuid not null references public.termine(id) on delete cascade,
  team text not null,
  spielerin_id text not null,
  status text not null check (status in ('ja','nein','vielleicht')),
  grund text not null default '',
  kommentar text not null default '',
  auto boolean not null default false,         -- automatisch durch Abwesenheit
  am timestamptz not null default now(),
  primary key (termin_id, spielerin_id)
);

create or replace function public.termin_team(p uuid) returns text
language sql stable security definer set search_path = public as $$ select team from public.termine where id = p; $$;

create or replace function public.zusage_erlaubt(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.termine t where t.id = p and not t.abgesagt and now() <= coalesce(t.frist, t.beginn)); $$;

alter table public.termine enable row level security;
alter table public.zusagen enable row level security;
drop policy if exists "termine trainer" on public.termine;
create policy "termine trainer" on public.termine for all to authenticated using (public.ist_mitglied(team)) with check (public.ist_mitglied(team));
drop policy if exists "termine spielerin" on public.termine;
create policy "termine spielerin" on public.termine for select to authenticated using (public.ist_spielerin_im_team(team));

drop policy if exists "zusagen trainer" on public.zusagen;
create policy "zusagen trainer" on public.zusagen for all to authenticated using (public.ist_mitglied(team)) with check (public.ist_mitglied(team) and team = public.termin_team(termin_id));
drop policy if exists "zusagen eigene lesen" on public.zusagen;
create policy "zusagen eigene lesen" on public.zusagen for select to authenticated using (spielerin_id = public.meine_spielerin(team));
drop policy if exists "zusagen eigene anlegen" on public.zusagen;
create policy "zusagen eigene anlegen" on public.zusagen for insert to authenticated
  with check (spielerin_id = public.meine_spielerin(team) and team = public.termin_team(termin_id) and public.zusage_erlaubt(termin_id) and not auto);
drop policy if exists "zusagen eigene aendern" on public.zusagen;
create policy "zusagen eigene aendern" on public.zusagen for update to authenticated
  using (spielerin_id = public.meine_spielerin(team))
  with check (spielerin_id = public.meine_spielerin(team) and team = public.termin_team(termin_id) and public.zusage_erlaubt(termin_id) and not auto);
revoke all on public.termine, public.zusagen from anon;

-- Wer kommt? Für Spielerinnen und Trainer: Name + Status (ohne Grund/Kommentar anderer)
create or replace function public.termin_teilnehmer(p_termin uuid) returns table (spielerin_id text, name text, status text)
language sql stable security definer set search_path = public as $$
  select z.spielerin_id, coalesce(a.name, ''), z.status
  from public.zusagen z left join public.zugaenge a on a.team = z.team and a.spielerin_id = z.spielerin_id
  where z.termin_id = p_termin and (public.ist_mitglied(z.team) or public.ist_spielerin_im_team(z.team));
$$;
revoke all on function public.termin_teilnehmer(uuid) from public, anon;
grant execute on function public.termin_teilnehmer(uuid) to authenticated;

-- ---------- 2) Abwesenheiten (z. B. Urlaub) → automatische Absagen ----------
create table if not exists public.abwesenheiten (
  id uuid primary key default gen_random_uuid(),
  team text not null,
  spielerin_id text not null,
  von date not null,
  bis date not null,
  grund text not null default '',
  notiz text not null default '',
  erstellt_am timestamptz not null default now(),
  check (bis >= von)
);
alter table public.abwesenheiten enable row level security;
drop policy if exists "abw trainer" on public.abwesenheiten;
create policy "abw trainer" on public.abwesenheiten for all to authenticated using (public.ist_mitglied(team)) with check (public.ist_mitglied(team));
drop policy if exists "abw eigene" on public.abwesenheiten;
create policy "abw eigene" on public.abwesenheiten for all to authenticated
  using (spielerin_id = public.meine_spielerin(team)) with check (spielerin_id = public.meine_spielerin(team));
revoke all on public.abwesenheiten from anon;

create or replace function public.abw_anwenden() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE','DELETE') then
    delete from public.zusagen z using public.termine t
    where z.termin_id = t.id and z.auto and z.spielerin_id = old.spielerin_id and t.team = old.team
      and (t.beginn at time zone 'Europe/Berlin')::date between old.von and old.bis;
  end if;
  if tg_op in ('INSERT','UPDATE') then
    insert into public.zusagen (termin_id, team, spielerin_id, status, grund, auto, am)
    select t.id, t.team, new.spielerin_id, 'nein', coalesce(nullif(new.grund, ''), 'Abwesend'), true, now()
    from public.termine t where t.team = new.team and not t.abgesagt
      and (t.beginn at time zone 'Europe/Berlin')::date between new.von and new.bis
    on conflict (termin_id, spielerin_id) do update set status = 'nein', grund = excluded.grund, auto = true, am = now();
  end if;
  return null;
end $$;
drop trigger if exists abw_anwenden on public.abwesenheiten;
create trigger abw_anwenden after insert or update or delete on public.abwesenheiten for each row execute function public.abw_anwenden();

create or replace function public.termin_abw_anwenden() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.zusagen (termin_id, team, spielerin_id, status, grund, auto, am)
  select new.id, new.team, a.spielerin_id, 'nein', coalesce(nullif(a.grund, ''), 'Abwesend'), true, now()
  from public.abwesenheiten a where a.team = new.team and (new.beginn at time zone 'Europe/Berlin')::date between a.von and a.bis
  on conflict (termin_id, spielerin_id) do nothing;
  return null;
end $$;
drop trigger if exists termin_abw_anwenden on public.termine;
create trigger termin_abw_anwenden after insert on public.termine for each row execute function public.termin_abw_anwenden();

-- ---------- 3) Mitteilungen ----------
create table if not exists public.mitteilungen (
  id uuid primary key default gen_random_uuid(),
  team text not null,
  titel text not null default '',
  text text not null default '',
  wichtig boolean not null default false,
  erstellt_am timestamptz not null default now()
);
create table if not exists public.mitteilung_gelesen (
  mitteilung_id uuid not null references public.mitteilungen(id) on delete cascade,
  team text not null,
  spielerin_id text not null,
  am timestamptz not null default now(),
  primary key (mitteilung_id, spielerin_id)
);
create or replace function public.mitteilung_team(p uuid) returns text
language sql stable security definer set search_path = public as $$ select team from public.mitteilungen where id = p; $$;
alter table public.mitteilungen enable row level security;
alter table public.mitteilung_gelesen enable row level security;
drop policy if exists "mitt trainer" on public.mitteilungen;
create policy "mitt trainer" on public.mitteilungen for all to authenticated using (public.ist_mitglied(team)) with check (public.ist_mitglied(team));
drop policy if exists "mitt spielerin" on public.mitteilungen;
create policy "mitt spielerin" on public.mitteilungen for select to authenticated using (public.ist_spielerin_im_team(team));
drop policy if exists "mittg trainer" on public.mitteilung_gelesen;
create policy "mittg trainer" on public.mitteilung_gelesen for select to authenticated using (public.ist_mitglied(team));
drop policy if exists "mittg eigene lesen" on public.mitteilung_gelesen;
create policy "mittg eigene lesen" on public.mitteilung_gelesen for select to authenticated using (spielerin_id = public.meine_spielerin(team));
drop policy if exists "mittg eigene anlegen" on public.mitteilung_gelesen;
create policy "mittg eigene anlegen" on public.mitteilung_gelesen for insert to authenticated
  with check (spielerin_id = public.meine_spielerin(team) and team = public.mitteilung_team(mitteilung_id));
revoke all on public.mitteilungen, public.mitteilung_gelesen from anon;

-- ---------- 4) Umfragen (auf Wunsch anonym) ----------
create table if not exists public.umfragen (
  id uuid primary key default gen_random_uuid(),
  team text not null,
  frage text not null,
  optionen jsonb not null default '[]'::jsonb,   -- ["Option A", "Option B", …]
  mehrfach boolean not null default false,
  anonym boolean not null default false,
  ende timestamptz,
  geschlossen boolean not null default false,
  erstellt_am timestamptz not null default now()
);
create table if not exists public.umfrage_teilnahme (     -- wer abgestimmt hat (ohne Zeitpunkt, ohne Wahl)
  umfrage_id uuid not null references public.umfragen(id) on delete cascade,
  team text not null,
  spielerin_id text not null,
  primary key (umfrage_id, spielerin_id)
);
create table if not exists public.umfrage_stimmen (       -- bei anonym OHNE Spielerin
  id uuid primary key default gen_random_uuid(),
  umfrage_id uuid not null references public.umfragen(id) on delete cascade,
  team text not null,
  option int not null,
  spielerin_id text
);
alter table public.umfragen enable row level security;
alter table public.umfrage_teilnahme enable row level security;
alter table public.umfrage_stimmen enable row level security;
drop policy if exists "umf trainer" on public.umfragen;
create policy "umf trainer" on public.umfragen for all to authenticated using (public.ist_mitglied(team)) with check (public.ist_mitglied(team));
drop policy if exists "umf spielerin" on public.umfragen;
create policy "umf spielerin" on public.umfragen for select to authenticated using (public.ist_spielerin_im_team(team));
drop policy if exists "umft trainer" on public.umfrage_teilnahme;
create policy "umft trainer" on public.umfrage_teilnahme for select to authenticated using (public.ist_mitglied(team));
drop policy if exists "umfs trainer" on public.umfrage_stimmen;
create policy "umfs trainer" on public.umfrage_stimmen for select to authenticated using (public.ist_mitglied(team));
revoke all on public.umfragen, public.umfrage_teilnahme, public.umfrage_stimmen from anon;
revoke insert, update, delete on public.umfrage_teilnahme, public.umfrage_stimmen from authenticated;

create or replace function public.abstimmen(p_umfrage uuid, p_optionen int[]) returns void
language plpgsql security definer set search_path = public as $$
declare u record; ich text; n int;
begin
  select * into u from public.umfragen where id = p_umfrage;
  if not found then raise exception 'Umfrage nicht gefunden'; end if;
  ich := public.meine_spielerin(u.team);
  if ich is null then raise exception 'Kein Zugang'; end if;
  if u.geschlossen or (u.ende is not null and now() > u.ende) then raise exception 'Umfrage ist beendet'; end if;
  n := coalesce(array_length(p_optionen, 1), 0);
  if n = 0 then raise exception 'Bitte eine Antwort wählen'; end if;
  if not u.mehrfach and n > 1 then raise exception 'Nur eine Antwort möglich'; end if;
  if exists (select 1 from unnest(p_optionen) o where o < 0 or o >= jsonb_array_length(u.optionen)) then raise exception 'Ungültige Antwort'; end if;
  if u.anonym then
    if exists (select 1 from public.umfrage_teilnahme where umfrage_id = u.id and spielerin_id = ich) then raise exception 'Du hast schon abgestimmt'; end if;
    insert into public.umfrage_teilnahme (umfrage_id, team, spielerin_id) values (u.id, u.team, ich);
    insert into public.umfrage_stimmen (umfrage_id, team, option) select u.id, u.team, o from (select distinct unnest(p_optionen) o) x;
  else
    delete from public.umfrage_stimmen where umfrage_id = u.id and spielerin_id = ich;
    insert into public.umfrage_teilnahme (umfrage_id, team, spielerin_id) values (u.id, u.team, ich) on conflict do nothing;
    insert into public.umfrage_stimmen (umfrage_id, team, option, spielerin_id) select u.id, u.team, o, ich from (select distinct unnest(p_optionen) o) x;
  end if;
end $$;
revoke all on function public.abstimmen(uuid, int[]) from public, anon;
grant execute on function public.abstimmen(uuid, int[]) to authenticated;

-- Eigener Stand je Umfrage (teilgenommen? eigene Wahl – bei anonym leer)
create or replace function public.meine_umfragen() returns table (umfrage_id uuid, teilgenommen boolean, optionen int[])
language sql stable security definer set search_path = public as $$
  select u.id,
    exists (select 1 from public.umfrage_teilnahme t where t.umfrage_id = u.id and t.spielerin_id = public.meine_spielerin(u.team)),
    coalesce((select array_agg(s.option order by s.option) from public.umfrage_stimmen s where s.umfrage_id = u.id and s.spielerin_id = public.meine_spielerin(u.team)), '{}')
  from public.umfragen u where public.ist_spielerin_im_team(u.team);
$$;
revoke all on function public.meine_umfragen() from public, anon;
grant execute on function public.meine_umfragen() to authenticated;

-- Ergebnis: Trainer immer; Spielerin erst nach eigener Abstimmung oder nach Ende. Namen nur bei nicht-anonymen Umfragen.
create or replace function public.umfrage_ergebnis(p_umfrage uuid) returns table (option int, anzahl int, namen text[])
language plpgsql stable security definer set search_path = public as $$
declare u record; ich text;
begin
  select * into u from public.umfragen where id = p_umfrage;
  if not found then return; end if;
  if not public.ist_mitglied(u.team) then
    ich := public.meine_spielerin(u.team);
    if ich is null then return; end if;
    if not (u.geschlossen or (u.ende is not null and now() > u.ende)
            or exists (select 1 from public.umfrage_teilnahme t where t.umfrage_id = u.id and t.spielerin_id = ich)) then return; end if;
  end if;
  return query
    select s.option, count(*)::int,
      case when u.anonym then '{}'::text[] else array_agg(coalesce(z.name, '') order by z.name) end
    from public.umfrage_stimmen s left join public.zugaenge z on z.team = s.team and z.spielerin_id = s.spielerin_id
    where s.umfrage_id = u.id group by s.option;
end $$;
revoke all on function public.umfrage_ergebnis(uuid) from public, anon;
grant execute on function public.umfrage_ergebnis(uuid) to authenticated;

-- ---------- 5) Dienste / Aufgaben ----------
create table if not exists public.dienste (
  id uuid primary key default gen_random_uuid(),
  team text not null,
  titel text not null,
  datum date not null,
  termin_id uuid references public.termine(id) on delete set null,
  spielerin_id text,                 -- leer = offen (zu übernehmen)
  erledigt boolean not null default false,
  notiz text not null default '',
  erstellt_am timestamptz not null default now()
);
alter table public.dienste enable row level security;
drop policy if exists "dienst trainer" on public.dienste;
create policy "dienst trainer" on public.dienste for all to authenticated using (public.ist_mitglied(team)) with check (public.ist_mitglied(team));
drop policy if exists "dienst spielerin" on public.dienste;
create policy "dienst spielerin" on public.dienste for select to authenticated using (public.ist_spielerin_im_team(team));
revoke all on public.dienste from anon;
create or replace function public.dienst_aendern(p_id uuid, p_aktion text) returns void
language plpgsql security definer set search_path = public as $$
declare d record; ich text;
begin
  select * into d from public.dienste where id = p_id;
  if not found then raise exception 'Dienst nicht gefunden'; end if;
  ich := public.meine_spielerin(d.team);
  if ich is null then raise exception 'Kein Zugang'; end if;
  if p_aktion = 'abgeben' and d.spielerin_id = ich then update public.dienste set spielerin_id = null, erledigt = false where id = p_id;
  elsif p_aktion = 'uebernehmen' and d.spielerin_id is null then update public.dienste set spielerin_id = ich where id = p_id;
  elsif p_aktion = 'erledigt' and d.spielerin_id = ich then update public.dienste set erledigt = not erledigt where id = p_id;
  else raise exception 'Nicht möglich'; end if;
end $$;
revoke all on function public.dienst_aendern(uuid, text) from public, anon;
grant execute on function public.dienst_aendern(uuid, text) to authenticated;
-- Namen der Dienst-Inhaberinnen für Spielerinnen
create or replace function public.team_namen() returns table (spielerin_id text, name text)
language sql stable security definer set search_path = public as $$
  select z.spielerin_id, z.name from public.zugaenge z
  where z.aktiv and (public.ist_mitglied(z.team) or public.ist_spielerin_im_team(z.team));
$$;
revoke all on function public.team_namen() from public, anon;
grant execute on function public.team_namen() to authenticated;

-- ---------- 6) Fahrgemeinschaften ----------
create table if not exists public.fahrten (
  id uuid primary key default gen_random_uuid(),
  termin_id uuid not null references public.termine(id) on delete cascade,
  team text not null,
  spielerin_id text not null,
  name text not null default '',
  plaetze int not null check (plaetze between 1 and 8),
  abfahrt text not null default '',
  treffpunkt text not null default '',
  notiz text not null default '',
  erstellt_am timestamptz not null default now()
);
create table if not exists public.mitfahrten (
  fahrt_id uuid not null references public.fahrten(id) on delete cascade,
  team text not null,
  spielerin_id text not null,
  name text not null default '',
  primary key (fahrt_id, spielerin_id)
);
alter table public.fahrten enable row level security;
alter table public.mitfahrten enable row level security;
drop policy if exists "fahrt lesen" on public.fahrten;
create policy "fahrt lesen" on public.fahrten for select to authenticated using (public.ist_mitglied(team) or public.ist_spielerin_im_team(team));
drop policy if exists "fahrt trainer loeschen" on public.fahrten;
create policy "fahrt trainer loeschen" on public.fahrten for delete to authenticated using (public.ist_mitglied(team));
drop policy if exists "mitf lesen" on public.mitfahrten;
create policy "mitf lesen" on public.mitfahrten for select to authenticated using (public.ist_mitglied(team) or public.ist_spielerin_im_team(team));
revoke all on public.fahrten, public.mitfahrten from anon;
revoke insert, update on public.fahrten, public.mitfahrten from authenticated;
revoke delete on public.mitfahrten from authenticated;
create or replace function public.fahrt_aendern(p_aktion text, p_termin uuid, p_fahrt uuid, p_plaetze int, p_abfahrt text, p_treffpunkt text, p_notiz text) returns void
language plpgsql security definer set search_path = public as $$
declare t text; ich text; nm text; f record; belegt int;
begin
  if p_aktion = 'anbieten' then
    t := public.termin_team(p_termin);
  else
    select * into f from public.fahrten where id = p_fahrt; if not found then raise exception 'Fahrt nicht gefunden'; end if; t := f.team;
  end if;
  ich := public.meine_spielerin(t); if ich is null then raise exception 'Kein Zugang'; end if;
  select name into nm from public.zugaenge where team = t and spielerin_id = ich;
  if p_aktion = 'anbieten' then
    insert into public.fahrten (termin_id, team, spielerin_id, name, plaetze, abfahrt, treffpunkt, notiz)
    values (p_termin, t, ich, coalesce(nm, ''), p_plaetze, btrim(coalesce(p_abfahrt, '')), btrim(coalesce(p_treffpunkt, '')), btrim(coalesce(p_notiz, '')));
  elsif p_aktion = 'loeschen' then
    if f.spielerin_id <> ich then raise exception 'Nicht deine Fahrt'; end if; delete from public.fahrten where id = f.id;
  elsif p_aktion = 'mitfahren' then
    if f.spielerin_id = ich then raise exception 'Das ist deine eigene Fahrt'; end if;
    select count(*) into belegt from public.mitfahrten where fahrt_id = f.id;
    if belegt >= f.plaetze then raise exception 'Leider schon voll'; end if;
    insert into public.mitfahrten (fahrt_id, team, spielerin_id, name) values (f.id, t, ich, coalesce(nm, '')) on conflict do nothing;
  elsif p_aktion = 'aussteigen' then
    delete from public.mitfahrten where fahrt_id = f.id and spielerin_id = ich;
  else raise exception 'Unbekannt'; end if;
end $$;
revoke all on function public.fahrt_aendern(text, uuid, uuid, int, text, text, text) from public, anon;
grant execute on function public.fahrt_aendern(text, uuid, uuid, int, text, text, text) to authenticated;

-- ---------- 7) Mannschaftskasse (nur Übersicht, kein echtes Bezahlen) ----------
create table if not exists public.kasse_katalog (
  id uuid primary key default gen_random_uuid(),
  team text not null,
  titel text not null,
  betrag numeric(8,2) not null check (betrag >= 0)
);
create table if not exists public.kasse_buchungen (
  id uuid primary key default gen_random_uuid(),
  team text not null,
  spielerin_id text not null,
  titel text not null,
  betrag numeric(8,2) not null,         -- positiv = offen (Strafe/Beitrag), negativ = bezahlt
  datum date not null default current_date,
  notiz text not null default ''
);
alter table public.kasse_katalog enable row level security;
alter table public.kasse_buchungen enable row level security;
drop policy if exists "kat trainer" on public.kasse_katalog;
create policy "kat trainer" on public.kasse_katalog for all to authenticated using (public.ist_mitglied(team)) with check (public.ist_mitglied(team));
drop policy if exists "kat spielerin" on public.kasse_katalog;
create policy "kat spielerin" on public.kasse_katalog for select to authenticated using (public.ist_spielerin_im_team(team));
drop policy if exists "buch trainer" on public.kasse_buchungen;
create policy "buch trainer" on public.kasse_buchungen for all to authenticated using (public.ist_mitglied(team)) with check (public.ist_mitglied(team));
drop policy if exists "buch eigene" on public.kasse_buchungen;
create policy "buch eigene" on public.kasse_buchungen for select to authenticated using (spielerin_id = public.meine_spielerin(team));
revoke all on public.kasse_katalog, public.kasse_buchungen from anon;

-- ---------- 8) Kalender-Abo ----------
create table if not exists public.kalender_tokens (
  token text primary key default encode(extensions.gen_random_bytes(18), 'hex'),
  team text not null,
  spielerin_id text,                      -- leer = Trainer-Kalender
  user_id uuid not null unique,
  erstellt_am timestamptz not null default now()
);
alter table public.kalender_tokens enable row level security;
revoke all on public.kalender_tokens from anon, authenticated;
create or replace function public.mein_kalender_token() returns text
language plpgsql security definer set search_path = public as $$
declare t text; sp text; tok text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select token into tok from public.kalender_tokens where user_id = auth.uid();
  if found then return tok; end if;
  select m.team into t from public.mitglieder m where lower(m.email) = public.meine_email() and public.meine_email() <> '' limit 1;
  if not found then
    select z.team, z.spielerin_id into t, sp from public.zugaenge z where z.aktiv and lower(z.email) = public.meine_email() and public.meine_email() <> '' limit 1;
    if not found then raise exception 'Kein Zugang'; end if;
  end if;
  insert into public.kalender_tokens (team, spielerin_id, user_id) values (t, sp, auth.uid()) returning token into tok;
  return tok;
end $$;
revoke all on function public.mein_kalender_token() from public, anon;
grant execute on function public.mein_kalender_token() to authenticated;
create or replace function public.kalender_neu() returns void
language sql security definer set search_path = public as $$ delete from public.kalender_tokens where user_id = auth.uid(); $$;
revoke all on function public.kalender_neu() from public, anon;
grant execute on function public.kalender_neu() to authenticated;

-- ---------- 9) Einstellungen für Termin-Erinnerungen ----------
alter table public.push_einstellungen add column if not exists termin_erinnerung boolean not null default true;   -- 24 h vorher an alle ohne Antwort
alter table public.push_einstellungen add column if not exists absage_meldung boolean not null default true;      -- Trainer: Absagen kurz vor dem Termin
