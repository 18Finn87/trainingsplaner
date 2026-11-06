-- Test für Phase 8c (Push). Im SQL Editor ausführen. Bricht am Ende absichtlich ab: Ergebnis als Fehlermeldung,
-- alle Testdaten werden zurückgenommen. Erwartet: 19 × OK.
do $$
declare r text := E'TESTERGEBNIS PUSH (alles wird zurückgenommen)\n'; n int; b boolean; t text;
begin
  insert into public.mitglieder values ('rls-test','trainer@rls-test.invalid');
  insert into public.zugaenge(team,spielerin_id,email,name) values ('rls-test','A','a@rls-test.invalid','Anna'),('rls-test','B','b@rls-test.invalid','Berta');
  set local role authenticated;
  perform set_config('request.jwt.claims','{"role":"authenticated","email":"a@rls-test.invalid","sub":"00000000-0000-4000-8000-0000000000a1"}',true);
  begin select public.push_anmelden('https://push.test/A','p','a','Test') into t; b:=false; exception when others then b:=true; end;
  r:=r||case when not b and t='spielerin' then 'OK     ' else 'FEHLER ' end||'A meldet ihr Gerät an (Rolle Spielerin)'||E'\n';
  begin insert into public.push_abos(team,rolle,spielerin_id,user_id,endpoint,p256dh,auth) values ('rls-test','spielerin','B','00000000-0000-4000-8000-0000000000b1','https://push.test/x','p','a'); b:=false; exception when others then b:=true; end;
  r:=r||case when b then 'OK     ' else 'FEHLER ' end||'A kann nicht direkt (z. B. für B) eintragen'||E'\n';
  select count(*) into n from public.push_abos; r:=r||case when n=1 then 'OK     ' else 'FEHLER ' end||'A sieht nur ihr eigenes Gerät ('||n||')'||E'\n';
  select count(*) into n from public.push_uebersicht(); r:=r||case when n=0 then 'OK     ' else 'FEHLER ' end||'A sieht keine Übersicht'||E'\n';
  select count(*) into n from public.push_einstellungen; r:=r||case when n=0 then 'OK     ' else 'FEHLER ' end||'A sieht keine Einstellungen'||E'\n';
  begin insert into public.push_einstellungen(team) values ('rls-test'); b:=false; exception when others then b:=true; end;
  r:=r||case when b then 'OK     ' else 'FEHLER ' end||'A kann keine Einstellungen anlegen'||E'\n';
  begin perform public.push_vapid_holen(); b:=false; exception when others then b:=true; end;
  r:=r||case when b then 'OK     ' else 'FEHLER ' end||'A kommt nicht an den geheimen Schlüssel'||E'\n';
  begin perform public.push_cron_pruefen('x'); b:=false; exception when others then b:=true; end;
  r:=r||case when b then 'OK     ' else 'FEHLER ' end||'A kann das Geheimwort nicht prüfen/erraten'||E'\n';
  begin perform public.push_vapid_speichern('x','y'); b:=false; exception when others then b:=true; end;
  r:=r||case when b then 'OK     ' else 'FEHLER ' end||'A kann keine Schlüssel setzen'||E'\n';
  begin select count(*) into n from public.push_schluessel; b:=false; exception when others then b:=true; end;
  r:=r||case when b then 'OK     ' else 'FEHLER ' end||'Schlüssel-Tabelle direkt gesperrt'||E'\n';
  perform set_config('request.jwt.claims','{"role":"authenticated","email":"b@rls-test.invalid","sub":"00000000-0000-4000-8000-0000000000b1"}',true);
  perform public.push_abmelden('https://push.test/A');
  select count(*) into n from public.push_abos; r:=r||case when n=0 then 'OK     ' else 'FEHLER ' end||'B sieht das Gerät von A nicht'||E'\n';
  perform set_config('request.jwt.claims','{"role":"authenticated","email":"fremd@rls-test.invalid","sub":"00000000-0000-4000-8000-0000000000f1"}',true);
  begin perform public.push_anmelden('https://push.test/F','p','a','x'); b:=false; exception when others then b:=true; end;
  r:=r||case when b then 'OK     ' else 'FEHLER ' end||'Fremde Person kann kein Gerät anmelden'||E'\n';
  perform set_config('request.jwt.claims','{"role":"authenticated","email":"trainer@rls-test.invalid","sub":"00000000-0000-4000-8000-0000000000d1"}',true);
  select count(*) into n from public.push_uebersicht() where spielerin_id='A'; r:=r||case when n=1 then 'OK     ' else 'FEHLER ' end||'Trainer sieht: A hat Benachrichtigungen an (B konnte sie nicht abmelden)'||E'\n';
  select count(*) into n from public.push_abos; r:=r||case when n=0 then 'OK     ' else 'FEHLER ' end||'Trainer sieht keine Geräte-Daten der Spielerinnen'||E'\n';
  begin select public.push_anmelden('https://push.test/T','p','a','x') into t; b:=false; exception when others then b:=true; end;
  r:=r||case when not b and t='trainer' then 'OK     ' else 'FEHLER ' end||'Trainer meldet Gerät an (Rolle Trainer)'||E'\n';
  begin insert into public.push_einstellungen(team) values ('rls-test'); b:=false; exception when others then b:=true; end;
  r:=r||case when not b then 'OK     ' else 'FEHLER ' end||'Trainer legt Einstellungen an'||E'\n';
  update public.push_einstellungen set haeufigkeit='woche' where team='rls-test'; get diagnostics n=row_count;
  r:=r||case when n=1 then 'OK     ' else 'FEHLER ' end||'Trainer ändert Einstellungen'||E'\n';
  begin insert into public.push_einstellungen(team) values ('oedheim-damen-fremd'); b:=false; exception when others then b:=true; end;
  r:=r||case when b then 'OK     ' else 'FEHLER ' end||'Trainer: keine Einstellungen für fremde Teams'||E'\n';
  perform set_config('request.jwt.claims','{"role":"authenticated","email":"a@rls-test.invalid","sub":"00000000-0000-4000-8000-0000000000a1"}',true);
  perform public.push_abmelden('https://push.test/A');
  select count(*) into n from public.push_abos; r:=r||case when n=0 then 'OK     ' else 'FEHLER ' end||'A meldet ihr Gerät wieder ab'||E'\n';
  raise exception '%', r;
end $$;
