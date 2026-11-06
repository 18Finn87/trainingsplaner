-- Test für Phase 8b (Feedback). Im SQL Editor ausführen. Bricht am Ende absichtlich ab:
-- Das Ergebnis erscheint als Fehlermeldung, alle Testdaten werden zurückgenommen.
do $$
declare
  r text := E'TESTERGEBNIS FEEDBACK (alle Testdaten werden zurückgenommen)\n';
  n int; blockiert boolean; t text;
begin
  insert into public.mitglieder values ('rls-test','trainer@rls-test.invalid');
  insert into public.zugaenge(team,spielerin_id,email,name) values ('rls-test','A','a@rls-test.invalid','Anna'),('rls-test','B','b@rls-test.invalid','Berta');
  insert into public.zugaenge(team,spielerin_id,email,name,aktiv) values ('rls-test','C','c@rls-test.invalid','Clara',false);

  set local role authenticated;

  -- Spielerin A: einmal mit Namen, einmal anonym
  perform set_config('request.jwt.claims','{"role":"authenticated","email":"a@rls-test.invalid","sub":"00000000-0000-4000-8000-0000000000a1"}',true);
  begin perform public.feedback_senden('training','A mit Namen',false); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when not blockiert then 'OK     ' else 'FEHLER ' end || 'A sendet Feedback mit Namen' || E'\n';
  begin perform public.feedback_senden('trainerteam','A anonym',true); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when not blockiert then 'OK     ' else 'FEHLER ' end || 'A sendet anonymes Feedback' || E'\n';
  begin insert into public.feedback(team,thema,nachricht,anonym,spielerin_id,name) values ('rls-test','training','gefälscht',false,'B','Berta'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then 'OK     ' else 'FEHLER ' end || 'A kann nicht direkt (z. B. im Namen von B) schreiben' || E'\n';
  select count(*) into n from public.feedback;
  r := r || case when n=0 then 'OK     ' else 'FEHLER ' end || 'A sieht ' || n || ' Zeilen der Feedback-Tabelle (soll 0)' || E'\n';
  select count(*) into n from public.meine_feedbacks();
  r := r || case when n=1 then 'OK     ' else 'FEHLER ' end || 'A sieht ' || n || ' eigenes Feedback mit Namen (soll 1, das anonyme nicht)' || E'\n';
  update public.feedback set status='erledigt'; get diagnostics n = row_count;
  r := r || case when n=0 then 'OK     ' else 'FEHLER ' end || 'A kann keinen Status ändern' || E'\n';

  -- Spielerin B
  perform set_config('request.jwt.claims','{"role":"authenticated","email":"b@rls-test.invalid","sub":"00000000-0000-4000-8000-0000000000b1"}',true);
  begin perform public.feedback_senden('spiele','B anonym',true); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when not blockiert then 'OK     ' else 'FEHLER ' end || 'B sendet anonymes Feedback' || E'\n';
  select count(*) into n from public.meine_feedbacks();
  r := r || case when n=0 then 'OK     ' else 'FEHLER ' end || 'B sieht ' || n || ' Feedback (soll 0: nichts von A, ihr anonymes nicht)' || E'\n';

  -- gesperrte C und fremde Person
  perform set_config('request.jwt.claims','{"role":"authenticated","email":"c@rls-test.invalid","sub":"00000000-0000-4000-8000-0000000000c1"}',true);
  begin perform public.feedback_senden('training','C',false); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then 'OK     ' else 'FEHLER ' end || 'Gesperrte C kann nichts senden' || E'\n';
  perform set_config('request.jwt.claims','{"role":"authenticated","email":"fremd@rls-test.invalid","sub":"00000000-0000-4000-8000-0000000000f1"}',true);
  begin perform public.feedback_senden('training','fremd',false); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then 'OK     ' else 'FEHLER ' end || 'Fremde Person kann nichts senden' || E'\n';

  -- Trainer
  perform set_config('request.jwt.claims','{"role":"authenticated","email":"trainer@rls-test.invalid","sub":"00000000-0000-4000-8000-0000000000d1"}',true);
  select count(*) into n from public.feedback;
  r := r || case when n=3 then 'OK     ' else 'FEHLER ' end || 'Trainer sieht ' || n || ' Feedbacks (soll 3)' || E'\n';
  select count(*) into n from public.feedback where anonym and (spielerin_id is not null or name is not null or gesendet_am is not null);
  r := r || case when n=0 then 'OK     ' else 'FEHLER ' end || 'Anonyme Einträge enthalten keinen Namen, keine Kennung, keine Uhrzeit' || E'\n';
  select string_agg(coalesce(name,'–'),',' order by nachricht) into t from public.feedback where anonym;
  r := r || case when t='–,–' then 'OK     ' else 'FEHLER ' end || 'Auch der Trainer sieht bei anonym keinen Namen' || E'\n';
  select count(*) into n from public.feedback where not anonym and spielerin_id='A' and name='Anna' and gesendet_am is not null;
  r := r || case when n=1 then 'OK     ' else 'FEHLER ' end || 'Feedback mit Namen trägt Name und Zeitpunkt' || E'\n';
  update public.feedback set status='gelesen', notiz='besprochen' where nachricht='A mit Namen'; get diagnostics n = row_count;
  r := r || case when n=1 then 'OK     ' else 'FEHLER ' end || 'Trainer kann Status und Notiz setzen' || E'\n';
  begin update public.feedback set nachricht='geändert'; blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then 'OK     ' else 'FEHLER ' end || 'Trainer kann die Nachricht nicht verändern' || E'\n';
  begin update public.feedback set anonym=false, spielerin_id='B' where nachricht='B anonym'; blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then 'OK     ' else 'FEHLER ' end || 'Trainer kann anonymes Feedback nicht nachträglich zuordnen' || E'\n';
  delete from public.feedback where nachricht='B anonym'; get diagnostics n = row_count;
  r := r || case when n=1 then 'OK     ' else 'FEHLER ' end || 'Trainer kann Feedback löschen' || E'\n';

  -- A sieht den Status, aber nicht die Notiz
  perform set_config('request.jwt.claims','{"role":"authenticated","email":"a@rls-test.invalid","sub":"00000000-0000-4000-8000-0000000000a1"}',true);
  select status into t from public.meine_feedbacks();
  r := r || case when t='gelesen' then 'OK     ' else 'FEHLER ' end || 'A sieht, dass ihr Feedback gelesen wurde (Notiz bleibt verborgen)' || E'\n';

  raise exception '%', r;
end $$;
