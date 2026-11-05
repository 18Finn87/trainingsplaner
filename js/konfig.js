"use strict";
/* Verbindung zur gemeinsamen Datenbank (Supabase).
   Beide Werte stehen in Supabase unter Project Settings → Data API (URL) bzw. API Keys (Schlüssel).
   Der Schlüssel ist der öffentliche („publishable“) – er darf in der App stehen;
   geschützt sind die Daten über die Anmeldung und die Mitgliederliste (Row Level Security).
   NIE den geheimen Schlüssel („secret“ / „service_role“) hier eintragen!
   Leer lassen = App arbeitet nur auf dem Gerät. */
const KONFIG={
  supabaseUrl:"https://rijfdkentuchjrfuzqrp.supabase.co",
  supabaseKey:"sb_publishable_zF9c5FBMmREyFLPEywhUhw_YM_uP6Gr",
};
