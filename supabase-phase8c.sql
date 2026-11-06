-- Trainingsplaner Oedheim – Phase 8c: Push-Erinnerungen
-- Baut auf den Skripten der Phasen 8a/8b auf. In Supabase → SQL Editor einfügen und „Run“.
--
-- Niemand muss einen geheimen Schlüssel eintippen:
--  • Die VAPID-Schlüssel (für Web-Push) erzeugt der Versand-Baustein beim ersten Start selbst und legt den
--    privaten Teil im Supabase-Tresor (Vault) ab. Nur der öffentliche Teil steht in push_schluessel.
--  • Das Geheimwort der Zeitsteuerung erzeugt dieses Skript zufällig im Tresor.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1) Tabellen --------------------------------------------------------------------
-- Push-Anmeldungen der Geräte (ein Eintrag je Gerät/Browser)
create table if not exists public.push_abos (
  id           uuid primary key default gen_random_uuid(),
  team         text not null,
  rolle        text not null check (rolle in ('spielerin','trainer')),
  spielerin_id text,
  user_id      uuid not null,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  geraet       text not null default '',
  erstellt_am  timestamptz not null default now(),
  constraint spielerin_mit_kennung check (rolle <> 'spielerin' or spielerin_id is not null)
);
-- Einstellungen je Team (vom Trainer gepflegt)
create table if not exists public.push_einstellungen (
  team                    text primary key,
  haeufigkeit             text not null default 'aus' check (haeufigkeit in ('aus','woche','zweiwochen','monat')),
  wochentag               int  not null default 3 check (wochentag between 1 and 7),   -- 1 = Montag … 7 = Sonntag
  stunde                  int  not null default 18 check (stunde between 0 and 23),    -- deutsche Zeit
  empfaenger              text not null default 'ungelesen' check (empfaenger in ('ungelesen','alle')),
  bei_freigabe            boolean not null default true,    -- sofort benachrichtigen, wenn etwas freigegeben wird
  feedback_meldung        boolean not null default true,    -- Trainer: täglich gesammelt bei neuem Feedback
  letzte_erinnerung       timestamptz,
  letzte_feedback_meldung date
);
-- Öffentlicher VAPID-Schlüssel (der private liegt im Tresor)
create table if not exists public.push_schluessel (
  id         int primary key default 1 check (id = 1),
  public_key text not null
);

-- 2) Zugriffsschutz -------------------------------------------------------------------
alter table public.push_abos          enable row level security;
alter table public.push_einstellungen enable row level security;
alter table public.push_schluessel    enable row level security;

drop policy if exists "push eigene" on public.push_abos;
create policy "push eigene" on public.push_abos for select to authenticated using (user_id = auth.uid());
revoke all on public.push_abos from anon;
revoke insert, update, delete on public.push_abos from authenticated;   -- an- und abmelden nur über Funktionen
grant select on public.push_abos to authenticated;

drop policy if exists "push einst trainer lesen" on public.push_einstellungen;
create policy "push einst trainer lesen" on public.push_einstellungen for select to authenticated using (public.ist_mitglied(team));
drop policy if exists "push einst trainer anlegen" on public.push_einstellungen;
create policy "push einst trainer anlegen" on public.push_einstellungen for insert to authenticated with check (public.ist_mitglied(team));
drop policy if exists "push einst trainer aendern" on public.push_einstellungen;
create policy "push einst trainer aendern" on public.push_einstellungen for update to authenticated using (public.ist_mitglied(team)) with check (public.ist_mitglied(team));
revoke all on public.push_einstellungen from anon;
revoke delete on public.push_einstellungen from authenticated;

revoke all on public.push_schluessel from anon, authenticated;          -- nur über push_public_key()

-- 3) Funktionen für die App ---------------------------------------------------------------
create or replace function public.push_public_key() returns text
language sql stable security definer set search_path = public as $$
  select public_key from public.push_schluessel where id = 1;
$$;
revoke all on function public.push_public_key() from public, anon;
grant execute on function public.push_public_key() to authenticated;

-- Gerät anmelden: Rolle ergibt sich aus der E-Mail (Trainer = mitglieder, Spielerin = aktiver Zugang)
create or replace function public.push_anmelden(p_endpoint text, p_p256dh text, p_auth text, p_geraet text) returns text
language plpgsql security definer set search_path = public as $$
declare t text; sp text; r text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select m.team into t from public.mitglieder m where lower(m.email) = public.meine_email() and public.meine_email() <> '' limit 1;
  if found then r := 'trainer';
  else
    select z.team, z.spielerin_id into t, sp from public.zugaenge z where z.aktiv and lower(z.email) = public.meine_email() and public.meine_email() <> '' limit 1;
    if not found then raise exception 'Kein Zugang'; end if;
    r := 'spielerin';
  end if;
  delete from public.push_abos where endpoint = p_endpoint;
  insert into public.push_abos (team, rolle, spielerin_id, user_id, endpoint, p256dh, auth, geraet)
  values (t, r, sp, auth.uid(), p_endpoint, p_p256dh, p_auth, left(coalesce(p_geraet, ''), 100));
  return r;
end $$;
revoke all on function public.push_anmelden(text, text, text, text) from public, anon;
grant execute on function public.push_anmelden(text, text, text, text) to authenticated;

create or replace function public.push_abmelden(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_abos where endpoint = p_endpoint and user_id = auth.uid();
$$;
revoke all on function public.push_abmelden(text) from public, anon;
grant execute on function public.push_abmelden(text) to authenticated;

-- Für Trainer: welche Spielerin hat Erinnerungen an (ohne technische Geräte-Daten)
create or replace function public.push_uebersicht() returns table (spielerin_id text, geraete int)
language sql stable security definer set search_path = public as $$
  select a.spielerin_id, count(*)::int from public.push_abos a
  where a.rolle = 'spielerin' and public.ist_mitglied(a.team) group by a.spielerin_id;
$$;
revoke all on function public.push_uebersicht() from public, anon;
grant execute on function public.push_uebersicht() to authenticated;

-- 4) Funktionen nur für den Versand-Baustein (service_role) -----------------------------------
create or replace function public.push_vapid_holen() returns text
language sql stable security definer set search_path = public as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'push_vapid' limit 1;
$$;
create or replace function public.push_vapid_speichern(p_privat text, p_public text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from vault.secrets where name = 'push_vapid') then raise exception 'Schlüssel existieren bereits'; end if;
  perform vault.create_secret(p_privat, 'push_vapid', 'VAPID-Schlüssel für Push-Erinnerungen');
  insert into public.push_schluessel (id, public_key) values (1, p_public)
  on conflict (id) do update set public_key = excluded.public_key;
end $$;
create or replace function public.push_cron_pruefen(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select decrypted_secret = p from vault.decrypted_secrets where name = 'push_cron' limit 1), false);
$$;
revoke all on function public.push_vapid_holen() from public, anon, authenticated;
revoke all on function public.push_vapid_speichern(text, text) from public, anon, authenticated;
revoke all on function public.push_cron_pruefen(text) from public, anon, authenticated;
grant execute on function public.push_vapid_holen() to service_role;
grant execute on function public.push_vapid_speichern(text, text) to service_role;
grant execute on function public.push_cron_pruefen(text) to service_role;

-- 5) Geheimwort für die Zeitsteuerung (zufällig, sieht niemand) -----------------------------------
do $$ begin
  if not exists (select 1 from vault.secrets where name = 'push_cron') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'push_cron', 'Zeitsteuerung Push-Erinnerungen');
  end if;
end $$;
