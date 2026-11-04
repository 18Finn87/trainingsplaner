# Trainingsplaner Oedheim

## Online
- **App:** https://18finn87.github.io/trainingsplaner/ (auf dem Handy öffnen und installieren, siehe unten)
- **Code:** https://github.com/18Finn87/trainingsplaner (öffentlich – enthält keine Daten)
- Dieser Ordner ist mit GitHub verbunden. Word-, PDF-, Excel- und Sicherungsdateien (`.json`) werden nie hochgeladen
  (siehe `.gitignore`).
- **Updates:** Claude ändert die Dateien hier und lädt sie (nach Rückfrage) zu GitHub hoch. Nach etwa einer Minute ist
  die neue Version online; die App holt sie beim nächsten Öffnen mit Internet.

## Am PC starten
1. Doppelklick auf **Trainingsplaner starten.bat**.
2. Der Browser öffnet die App unter `http://localhost:8081`. Das schwarze Fenster offen lassen, solange du arbeitest.
3. Zum Beenden das schwarze Fenster schließen.

Wichtig: Der Browser speichert die Daten **pro Adresse**. `localhost:8081` (PC) und die Online-Adresse haben
**getrennte** Daten. Übertragen: „Alles sichern“ → Datei → am anderen Ort „Datei einspielen“ –
oder gemeinsame Daten über Supabase einrichten (siehe unten).

## Mannschaften
- Oben neben dem Namen wählst du die Mannschaft; das Gerät merkt sich die Wahl.
- Jede Mannschaft hat eigenen Kader, eigene Trainings, Spiele, Anwesenheit, Statistik sowie eigenen Standard-Beginn/-Dauer.
  Übungen, alle Auswahllisten und der Materialbestand gelten für alle Mannschaften.
- Anlegen, umbenennen, löschen: Zahnrad → „Mannschaften“. Löschen nur nach Eintippen des Namens.
- Sichern: „Alles sichern“ (alle Mannschaften) oder „Nur … sichern“ (eine Mannschaft). Beides über „Datei einspielen“ zurückholen.

## Farben ändern
Ganz oben in `app/css/app.css` im Block „FARBEN – hier ändern“: `--farbe-akzent` (Blau), `--farbe-akzent-flaeche`
(Blau für gefüllte Knöpfe), `--farbe-akzent-hell` (Blau im Hellmodus), `--farbe-akzent2` (Weiß) sowie die Grundfarben.

## Bedienung in Kürze
- **Training → Anwesenheit:** Name antippen = anwesend (nochmal = offen). „Alle übrigen auf abwesend“ setzt den Rest –
  eingeschränkte Spielerinnen bleiben offen. „⋯“ öffnet Grund fürs Fehlen und die Einschränkung.
- **Eingeschränkt** (Krankheit, Verletzung …) hängt dauerhaft an der Spielerin und gilt in jedem neuen Training,
  bis du es im Kader oder über „⋯“ wieder aufhebst. Eingeschränkt + anwesend geht (z. B. nur Lauftraining).
- **Zahnrad oben:** Einstellungen – alle Auswahllisten (Inhalte, Kategorien, Material + Bestand, Gründe, Positionen),
  Standardzeiten und Datensicherung. Umbenennen zieht alle Verwendungen mit.
- **Statistik:** Anwesenheit pro Spielerin und Training, trainierte Inhalte, wer gerade eingeschränkt ist.
- **„An Trainer teilen“** (im Training bzw. in der Übung): Datei ohne Namen und Anwesenheit; der andere Trainer spielt sie
  unter Einstellungen → „Datei einspielen“ ein.

## Online stellen (damit es auf dem Handy und bei Co-Trainern läuft)
Online liegt nur das Programm. Die Daten bleiben auf jedem Gerät – bis die gemeinsame Datenbank eingerichtet ist.

**Variante A – Netlify (am einfachsten)**
1. Auf netlify.com ein kostenloses Konto anlegen.
2. app.netlify.com/drop öffnen und den Ordner **`app`** ins Fenster ziehen.
3. Du bekommst eine Adresse wie `https://xyz.netlify.app` (unter „Site settings“ umbenennbar, z. B. `trainingsplaner-oedheim`).
4. Update: im Netlify-Projekt unter „Deploys“ den Ordner `app` erneut hineinziehen.

**Variante B – GitHub Pages**
1. Auf github.com ein kostenloses Konto anlegen, ein neues Repository erstellen (z. B. `trainingsplaner`).
2. „Add file → Upload files“: den **Inhalt** des Ordners `app` hochladen (index.html muss oben liegen).
3. Settings → Pages → Branch „main“, Ordner „/ (root)“ → Save.
4. Nach etwa einer Minute läuft die App unter `https://DEINNAME.github.io/trainingsplaner/`.
   Achtung: Ist das Repository öffentlich, ist der Programmcode für alle sichtbar (deine Daten nicht – die sind nicht darin).

**Auf dem Handy installieren:** Adresse öffnen →
iPhone (Safari): Teilen → „Zum Home-Bildschirm“ · Android (Chrome): ⋮ → „App installieren“.

## Gemeinsame Daten mit Co-Trainern (Supabase) einrichten
Einmalig, etwa 10 Minuten. Danach gleichen sich alle angemeldeten Geräte automatisch ab; offline arbeitet die App
weiter und holt den Abgleich nach.

1. **Konto:** auf supabase.com „Start your project“ → kostenlos registrieren.
2. **Projekt:** „New project“ → Name z. B. `trainingsplaner`, Region **Central EU (Frankfurt)**,
   Datenbank-Passwort vergeben und notieren (die App braucht es nicht).
3. **Datenbank anlegen:** links „SQL Editor“ → „New query“ → den kompletten Inhalt der Datei
   `supabase-einrichtung.sql` (liegt neben diesem Text) einfügen. Ganz unten `DEINE-EMAIL@beispiel.de` durch deine
   E-Mail ersetzen, für jeden Co-Trainer eine weitere Zeile. → „Run“.
4. **Code statt Link in der E-Mail:** links „Authentication“ → „Emails“ (E-Mail-Vorlagen). In den Vorlagen
   **„Magic Link“** und **„Confirm signup“** eine Zeile ergänzen: `Dein Code: {{ .Token }}` → speichern.
5. **Zwei Werte kopieren:** „Project Settings“ → „API“ bzw. „Data API“/„API Keys“:
   - **Project URL** (z. B. `https://abcd1234.supabase.co`)
   - **öffentlicher Schlüssel** („anon“ bzw. „publishable“ – **nicht** „service_role“/„secret“!)
   Beide in `app/js/konfig.js` eintragen (oder Claude schicken).
6. **App aktualisieren** (Ordner `app` neu hochladen) und **zuerst auf dem Gerät mit deinen aktuellen Daten**
   unter Einstellungen → „Gemeinsame Daten“ anmelden. Dieses Gerät lädt beim ersten Mal alles hoch.
   Danach melden sich die Co-Trainer an und bekommen den Stand.

Gut zu wissen:
- Ändern zwei Trainer gleichzeitig dasselbe (z. B. dasselbe Training), gilt die zuletzt gespeicherte Fassung.
- Weiteren Trainer freischalten: in Supabase „Table Editor“ → `mitglieder` → Zeile mit Team `oedheim-damen` und E-Mail.
- Kostenlose Projekte schlafen nach ca. einer Woche ohne Nutzung ein; im Supabase-Dashboard „Restore“ drücken.
  Die App arbeitet so lange auf dem Gerät weiter und gleicht danach ab.
- Gesundheitsangaben (Verletzungen) liegen dann online – Gründe lieber allgemein halten und mit dem Verein abstimmen.

## Daten sichern und übertragen
- **Einstellungen → Datensicherung → „Sicherung herunterladen“** (am Handy auch „Sicherung teilen …“).
- Die App erinnert dich, wenn die letzte Sicherung älter als 14 Tage ist.
- **Auf ein anderes Gerät:** dort „Datei einspielen“ und die Sicherung wählen.
- Beim Update auf Version 3 hat die App deinen alten Stand gesichert: Einstellungen → „Alten Stand herunterladen“.

## Updates
Neue Dateien in `app/` (bzw. bei Netlify/GitHub hochladen) – die App lädt die neue Version beim nächsten Öffnen.
