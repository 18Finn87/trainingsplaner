-- Test des Zugriffsschutzes für Phase 8a. Im SQL Editor ausführen.
-- Legt Testdaten im Team „rls-test“ an, prüft als Spielerin A, B, gesperrte Spielerin C und Trainer,
-- und bricht am Ende absichtlich ab: Das Ergebnis erscheint als Fehlermeldung, alle Testdaten werden zurückgenommen.
do $$
declare
  r text := E'TESTERGEBNIS (alle Testdaten werden zurückgenommen)\n';
  n int; blockiert boolean;
  fa uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
  fb uuid := 'aaaaaaaa-0000-4000-8000-000000000002';
  fc uuid := 'aaaaaaaa-0000-4000-8000-000000000003';
  pruef text;
begin
  -- Testdaten (als Admin, ohne Zugriffsschutz)
  insert into public.mitglieder values ('rls-test','trainer@rls-test.invalid');
  insert into public.zugaenge(team,spielerin_id,email,name) values ('rls-test','A','a@rls-test.invalid','A'),('rls-test','B','b@rls-test.invalid','B');
  insert into public.zugaenge(team,spielerin_id,email,name,aktiv) values ('rls-test','C','c@rls-test.invalid','C',false);
  insert into public.freigaben(id,team,art,titel) values (fa,'rls-test','kommentar','an A und C'),(fb,'rls-test','kommentar','an B'),(fc,'rls-test','kommentar','an A, zurückgezogen');
  update public.freigaben set zurueckgezogen = true where id = fc;
  insert into public.freigabe_empfaenger values (fa,'rls-test','A'),(fa,'rls-test','C'),(fb,'rls-test','B'),(fc,'rls-test','A');
  insert into public.reaktionen(freigabe_id,team,spielerin_id,art) values (fb,'rls-test','B','gut');
  insert into public.gelesen(freigabe_id,team,spielerin_id) values (fb,'rls-test','B');
  insert into public.docs(team,coll,id,data,updated_at) values ('rls-test','meta','settings','{"geheim":true}',1);

  set local role authenticated;

  ---------------- Spielerin A ----------------
  perform set_config('request.jwt.claims','{"role":"authenticated","email":"a@rls-test.invalid","sub":"00000000-0000-4000-8000-0000000000a1"}',true);
  select count(*) into n from public.freigaben;            r := r || case when n=1 then 'OK     ' else 'FEHLER ' end || 'A sieht ' || n || ' Freigabe(n) (soll 1: nur ihre, nicht B, nicht zurückgezogene)' || E'\n';
  select count(*) into n from public.freigaben where id=fb; r := r || case when n=0 then 'OK     ' else 'FEHLER ' end || 'A sieht Freigabe von B nicht' || E'\n';
  select count(*) into n from public.freigabe_empfaenger;  r := r || case when n=1 then 'OK     ' else 'FEHLER ' end || 'A sieht ' || n || ' Empfängerzeile(n) (soll 1, nicht wer sonst noch etwas bekam)' || E'\n';
  select count(*) into n from public.docs;                 r := r || case when n=0 then 'OK     ' else 'FEHLER ' end || 'A sieht ' || n || ' Trainerdaten (soll 0)' || E'\n';
  select count(*) into n from public.mitglieder;           r := r || case when n=0 then 'OK     ' else 'FEHLER ' end || 'A sieht ' || n || ' Trainer-Einträge (soll 0)' || E'\n';
  select count(*) into n from public.zugaenge;             r := r || case when n=1 then 'OK     ' else 'FEHLER ' end || 'A sieht ' || n || ' Zugang (soll 1: nur ihren eigenen)' || E'\n';
  select count(*) into n from public.reaktionen;           r := r || case when n=0 then 'OK     ' else 'FEHLER ' end || 'A sieht ' || n || ' fremde Reaktionen (soll 0)' || E'\n';
  select count(*) into n from public.gelesen;              r := r || case when n=0 then 'OK     ' else 'FEHLER ' end || 'A sieht ' || n || ' fremde Lesebestätigungen (soll 0)' || E'\n';

  begin insert into public.gelesen(freigabe_id,team,spielerin_id) values (fa,'rls-test','A'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when not blockiert then 'OK     ' else 'FEHLER ' end || 'A kann ihre eigene Lesebestätigung eintragen' || E'\n';
  begin insert into public.reaktionen(freigabe_id,team,spielerin_id,art,kommentar) values (fa,'rls-test','A','verstanden','passt'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when not blockiert then 'OK     ' else 'FEHLER ' end || 'A kann ihre eigene Reaktion abgeben' || E'\n';
  update public.reaktionen set art='besprechen' where freigabe_id=fa and spielerin_id='A'; get diagnostics n = row_count;
  r := r || case when n=1 then 'OK     ' else 'FEHLER ' end || 'A kann ihre Reaktion ändern' || E'\n';

  begin insert into public.gelesen(freigabe_id,team,spielerin_id) values (fb,'rls-test','A'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then 'OK     ' else 'FEHLER ' end || 'A kann nichts zu Freigaben eintragen, die nicht an sie gehen' || E'\n';
  begin insert into public.reaktionen(freigabe_id,team,spielerin_id,art) values (fb,'rls-test','B','unsicher'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then 'OK     ' else 'FEHLER ' end || 'A kann nicht als B reagieren' || E'\n';
  begin insert into public.gelesen(freigabe_id,team,spielerin_id) values (fc,'rls-test','A'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then 'OK     ' else 'FEHLER ' end || 'A kann zurückgezogene Freigaben nicht mehr nutzen' || E'\n';
  update public.reaktionen set kommentar='gehackt' where spielerin_id='B'; get diagnostics n = row_count;
  r := r || case when n=0 then 'OK     ' else 'FEHLER ' end || 'A kann Reaktionen von B nicht ändern' || E'\n';
  delete from public.reaktionen where spielerin_id='B'; get diagnostics n = row_count;
  r := r || case when n=0 then 'OK     ' else 'FEHLER ' end || 'A kann Reaktionen von B nicht löschen' || E'\n';
  begin insert into public.freigaben(team,art,titel) values ('rls-test','kommentar','von A'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then 'OK     ' else 'FEHLER ' end || 'A kann keine Freigaben anlegen' || E'\n';
  begin insert into public.freigabe_empfaenger values (fb,'rls-test','A'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then 'OK     ' else 'FEHLER ' end || 'A kann sich nicht selbst als Empfängerin eintragen' || E'\n';
  update public.freigaben set titel='geändert' where id=fa; get diagnostics n = row_count;
  r := r || case when n=0 then 'OK     ' else 'FEHLER ' end || 'A kann Freigaben nicht ändern' || E'\n';
  update public.zugaenge set aktiv=true where spielerin_id='C'; get diagnostics n = row_count;
  r := r || case when n=0 then 'OK     ' else 'FEHLER ' end || 'A kann keine Zugänge freischalten' || E'\n';
  begin insert into public.mitglieder values ('rls-test','a@rls-test.invalid'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then 'OK     ' else 'FEHLER ' end || 'A kann sich nicht zur Trainerin machen' || E'\n';
  begin perform public.push_docs('rls-test','[{"coll":"meta","id":"settings","data":{},"updated_at":999}]'::jsonb); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then 'OK     ' else 'FEHLER ' end || 'A kann keine Trainerdaten schreiben' || E'\n';

  ---------------- Spielerin B ----------------
  perform set_config('request.jwt.claims','{"role":"authenticated","email":"b@rls-test.invalid","sub":"00000000-0000-4000-8000-0000000000b1"}',true);
  select count(*) into n from public.freigaben;   r := r || case when n=1 then 'OK     ' else 'FEHLER ' end || 'B sieht ' || n || ' Freigabe(n) (soll 1)' || E'\n';
  select count(*) into n from public.reaktionen;  r := r || case when n=1 then 'OK     ' else 'FEHLER ' end || 'B sieht ' || n || ' Reaktion(en) (soll 1: nur ihre, nicht die von A)' || E'\n';
  select kommentar into pruef from public.reaktionen where spielerin_id='B';
  r := r || case when pruef = '' then 'OK     ' else 'FEHLER ' end || 'Reaktion von B ist unverändert' || E'\n';

  ---------------- gesperrte Spielerin C (Zugang aktiv = false) ----------------
  perform set_config('request.jwt.claims','{"role":"authenticated","email":"c@rls-test.invalid","sub":"00000000-0000-4000-8000-0000000000c1"}',true);
  select count(*) into n from public.freigaben;   r := r || case when n=0 then 'OK     ' else 'FEHLER ' end || 'Gesperrte C sieht ' || n || ' Freigaben (soll 0)' || E'\n';

  ---------------- fremde Person (kein Zugang) ----------------
  perform set_config('request.jwt.claims','{"role":"authenticated","email":"fremd@rls-test.invalid","sub":"00000000-0000-4000-8000-0000000000f1"}',true);
  select count(*) into n from public.freigaben;   r := r || case when n=0 then 'OK     ' else 'FEHLER ' end || 'Fremde Person sieht ' || n || ' Freigaben (soll 0)' || E'\n';
  select count(*) into n from public.zugaenge;    r := r || case when n=0 then 'OK     ' else 'FEHLER ' end || 'Fremde Person sieht ' || n || ' Zugänge (soll 0)' || E'\n';

  ---------------- Trainer ----------------
  perform set_config('request.jwt.claims','{"role":"authenticated","email":"trainer@rls-test.invalid","sub":"00000000-0000-4000-8000-0000000000d1"}',true);
  select count(*) into n from public.freigaben;           r := r || case when n=3 then 'OK     ' else 'FEHLER ' end || 'Trainer sieht ' || n || ' Freigaben (soll 3, auch zurückgezogene)' || E'\n';
  select count(*) into n from public.reaktionen;          r := r || case when n=2 then 'OK     ' else 'FEHLER ' end || 'Trainer sieht ' || n || ' Reaktionen (soll 2)' || E'\n';
  select count(*) into n from public.gelesen;             r := r || case when n=2 then 'OK     ' else 'FEHLER ' end || 'Trainer sieht ' || n || ' Lesebestätigungen (soll 2)' || E'\n';
  select count(*) into n from public.zugaenge;            r := r || case when n=3 then 'OK     ' else 'FEHLER ' end || 'Trainer sieht ' || n || ' Zugänge (soll 3)' || E'\n';
  select count(*) into n from public.freigaben where team='oedheim-damen'; r := r || case when n=0 then 'OK     ' else 'FEHLER ' end || 'Trainer des Testteams sieht keine Freigaben anderer Teams' || E'\n';
  select count(*) into n from public.docs where team<>'rls-test'; r := r || case when n=0 then 'OK     ' else 'FEHLER ' end || 'Trainer des Testteams sieht keine Trainerdaten anderer Teams' || E'\n';
  begin insert into public.freigaben(team,art,titel) values ('rls-test','kommentar','neu'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when not blockiert then 'OK     ' else 'FEHLER ' end || 'Trainer kann Freigaben anlegen' || E'\n';
  begin insert into public.freigaben(team,art,titel) values ('oedheim-damen','kommentar','fremd'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then 'OK     ' else 'FEHLER ' end || 'Trainer kann nichts in fremden Teams anlegen' || E'\n';
  begin insert into public.reaktionen(freigabe_id,team,spielerin_id,art) values (fa,'rls-test','C','gut'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then 'OK     ' else 'FEHLER ' end || 'Trainer kann keine Reaktionen im Namen von Spielerinnen abgeben' || E'\n';

  raise exception '%', r;
end $$;
