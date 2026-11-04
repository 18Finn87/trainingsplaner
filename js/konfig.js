"use strict";
/* Verbindung zur gemeinsamen Datenbank (Supabase).
   Beide Werte stehen in Supabase unter Project Settings → API (bzw. „Data API“ / „API Keys“).
   Der Schlüssel ist der öffentliche („anon“ bzw. „publishable“) – er darf in der App stehen;
   geschützt sind die Daten über die Anmeldung und die Mitgliederliste.
   Leer lassen = App arbeitet nur auf dem Gerät. */
const KONFIG={
  supabaseUrl:"",
  supabaseKey:"",
};
