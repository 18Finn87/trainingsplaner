// Trainingsplaner Oedheim – Versand-Baustein für Push-Erinnerungen (Supabase Edge Function „push“)
// In Supabase unter Edge Functions als Funktion „push“ angelegt, „Verify JWT“ AUS (die Funktion prüft selbst).
//
// Aktionen (POST, JSON-Körper {aktion, …}):
//   cron       – stündlich aus der Datenbank (Kopfzeile x-cron mit dem Geheimwort aus dem Tresor)
//   schluessel – liefert den öffentlichen Schlüssel (legt beim allerersten Aufruf die Schlüssel an)
//   test       – Test-Benachrichtigung an die eigenen Geräte
//   erinnern   – (nur Trainer) {ziel: "ungelesen" | "alle" | <Spielerin-Kennung>}
//   freigabe   – (nur Trainer) {id} sofortige Meldung an die Empfängerinnen einer Freigabe
// Die privaten Schlüssel liegen im Supabase-Tresor (Vault); niemand muss sie sehen oder eintippen.
import * as webpush from "jsr:@negrel/webpush@0.5.0";
import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const APP_URL = "https://18finn87.github.io/trainingsplaner/";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const antwort = (daten: unknown, status = 200) =>
  new Response(JSON.stringify(daten), { status, headers: { ...CORS, "Content-Type": "application/json" } });

type Abo = { id: string; endpoint: string; p256dh: string; auth: string; spielerin_id: string | null; user_id: string };
type Nachricht = { title: string; body: string; url?: string; tag?: string };

// ---------- Schlüssel ----------
let server: webpush.ApplicationServer | null = null;
let publicKey = "";
async function appServer() {
  if (server) return server;
  let json = (await db.rpc("push_vapid_holen")).data as string | null;
  if (!json) {
    const keys = await webpush.generateVapidKeys({ extractable: true });
    const exp = await webpush.exportVapidKeys(keys);
    const pub = await webpush.exportApplicationServerKey(keys);
    const { error } = await db.rpc("push_vapid_speichern", { p_privat: JSON.stringify(exp), p_public: pub });
    if (error) { json = (await db.rpc("push_vapid_holen")).data as string | null; if (!json) throw error; }
    else json = JSON.stringify(exp);
  }
  const keys = await webpush.importVapidKeys(JSON.parse(json), { extractable: false });
  publicKey = await webpush.exportApplicationServerKey(keys);
  server = await webpush.ApplicationServer.new({ contactInformation: APP_URL, vapidKeys: keys });
  return server;
}

// ---------- Versand ----------
async function senden(abos: Abo[], n: (a: Abo) => Nachricht | null) {
  const s = await appServer();
  const erg = { gesendet: 0, abgemeldet: 0, fehler: 0 };
  for (const a of abos) {
    const msg = n(a); if (!msg) continue;
    try {
      await s.subscribe({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } })
        .pushTextMessage(JSON.stringify({ url: APP_URL, ...msg }), { ttl: 60 * 60 * 24 * 3 });
      erg.gesendet++;
    } catch (e) {
      const st = (e as { response?: Response })?.response?.status;
      if (st === 404 || st === 410) { await db.from("push_abos").delete().eq("id", a.id); erg.abgemeldet++; }
      else erg.fehler++;
    }
  }
  return erg;
}

// Ungelesene Freigaben je Spielerin (nicht zurückgezogen, noch nicht geöffnet)
async function ungelesen(team: string) {
  const { data } = await db.from("freigaben").select("id, freigabe_empfaenger(spielerin_id), gelesen(spielerin_id)")
    .eq("team", team).eq("zurueckgezogen", false);
  const m = new Map<string, number>();
  for (const f of (data ?? []) as { freigabe_empfaenger: { spielerin_id: string }[]; gelesen: { spielerin_id: string }[] }[]) {
    const gel = new Set(f.gelesen.map((g) => g.spielerin_id));
    for (const e of f.freigabe_empfaenger) if (!gel.has(e.spielerin_id)) m.set(e.spielerin_id, (m.get(e.spielerin_id) ?? 0) + 1);
  }
  return m;
}
async function spielerinnenAbos(team: string) {
  const [{ data: abos }, { data: zug }] = await Promise.all([
    db.from("push_abos").select("*").eq("team", team).eq("rolle", "spielerin"),
    db.from("zugaenge").select("spielerin_id").eq("team", team).eq("aktiv", true),
  ]);
  const aktiv = new Set((zug ?? []).map((z: { spielerin_id: string }) => z.spielerin_id));
  return ((abos ?? []) as Abo[]).filter((a) => a.spielerin_id && aktiv.has(a.spielerin_id));
}

async function erinnern(team: string, ziel: string) {
  const offen = await ungelesen(team);
  let liste = await spielerinnenAbos(team);
  if (ziel === "ungelesen") liste = liste.filter((a) => offen.get(a.spielerin_id!));
  else if (ziel !== "alle") liste = liste.filter((a) => a.spielerin_id === ziel);
  const erg = await senden(liste, (a) => {
    const n = offen.get(a.spielerin_id!) ?? 0;
    return n
      ? { title: "Trainingsplaner Oedheim", body: `Du hast ${n} ${n === 1 ? "neue Freigabe" : "neue Freigaben"} von deinem Trainerteam.`, tag: "erinnerung" }
      : { title: "Trainingsplaner Oedheim", body: "Schau mal rein – und wenn du magst, gib deinem Trainerteam Feedback.", tag: "erinnerung" };
  });
  return { ...erg, spielerinnen: new Set(liste.map((a) => a.spielerin_id)).size };
}

async function freigabeMelden(team: string, id: string) {
  const { data: einst } = await db.from("push_einstellungen").select("bei_freigabe").eq("team", team).maybeSingle();
  if (einst && !einst.bei_freigabe) return { gesendet: 0, aus: true };
  const { data: f } = await db.from("freigaben").select("titel, zurueckgezogen, team, freigabe_empfaenger(spielerin_id)").eq("id", id).maybeSingle();
  if (!f || f.team !== team || f.zurueckgezogen) return { gesendet: 0 };
  const an = new Set((f.freigabe_empfaenger ?? []).map((e: { spielerin_id: string }) => e.spielerin_id));
  const liste = (await spielerinnenAbos(team)).filter((a) => an.has(a.spielerin_id!));
  return await senden(liste, () => ({ title: "Neu vom Trainerteam", body: f.titel || "Neue Freigabe", tag: "fg-" + id }));
}

// ---------- Zeitsteuerung (stündlich) ----------
function jetztBerlin() {
  const t = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", weekday: "short", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const wd = t.find((p) => p.type === "weekday")!.value;
  const stunde = Number(t.find((p) => p.type === "hour")!.value);
  const tag = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(wd) + 1;
  const datum = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date()); // JJJJ-MM-TT
  return { tag, stunde, datum };
}
const ABSTAND: Record<string, number> = { woche: 6, zweiwochen: 13, monat: 27 }; // Tage, mindestens
async function cronLauf() {
  const { tag, stunde, datum } = jetztBerlin();
  const { data: alle } = await db.from("push_einstellungen").select("*");
  const ergebnis: unknown[] = [];
  for (const e of alle ?? []) {
    if (e.stunde !== stunde) continue;
    // gelegentliche Erinnerung an Spielerinnen
    if (e.haeufigkeit !== "aus" && e.wochentag === tag) {
      const seit = e.letzte_erinnerung ? (Date.now() - Date.parse(e.letzte_erinnerung)) / 864e5 : 999;
      if (seit >= ABSTAND[e.haeufigkeit]) {
        ergebnis.push({ team: e.team, erinnerung: await erinnern(e.team, e.empfaenger) });
        await db.from("push_einstellungen").update({ letzte_erinnerung: new Date().toISOString() }).eq("team", e.team);
      }
    }
    // tägliche Sammelmeldung an Trainer bei neuem Feedback (bewusst nicht sofort – schützt anonyme Absenderinnen)
    if (e.feedback_meldung && e.letzte_feedback_meldung !== datum) {
      let q = db.from("feedback").select("id", { count: "exact", head: true }).eq("team", e.team).eq("status", "neu");
      if (e.letzte_feedback_meldung) q = q.gte("datum", e.letzte_feedback_meldung);
      const { count } = await q;
      if (count) {
        const { data: abos } = await db.from("push_abos").select("*").eq("team", e.team).eq("rolle", "trainer");
        ergebnis.push({ team: e.team, feedback: await senden((abos ?? []) as Abo[], () => ({
          title: "Trainingsplaner Oedheim", body: `${count} ${count === 1 ? "neues Feedback" : "neue Feedbacks"} von Spielerinnen.`, tag: "feedback" })) });
      }
      await db.from("push_einstellungen").update({ letzte_feedback_meldung: datum }).eq("team", e.team);
    }
  }
  return { ok: true, tag, stunde, ergebnis };
}

// ---------- Anfragen ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    const aktion = String(body.aktion ?? "");

    if (aktion === "cron") {
      const geheim = req.headers.get("x-cron") ?? "";
      const { data: ok } = await db.rpc("push_cron_pruefen", { p: geheim });
      if (!geheim || !ok) return antwort({ error: "Nicht erlaubt" }, 401);
      return antwort(await cronLauf());
    }

    // angemeldete Person prüfen
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await db.auth.getUser(token);
    const email = u?.user?.email?.toLowerCase();
    if (!email) return antwort({ error: "Nicht angemeldet" }, 401);
    const { data: mit } = await db.from("mitglieder").select("team, email");
    const trainerTeam = (mit ?? []).find((m: { email: string }) => m.email.toLowerCase() === email)?.team as string | undefined;

    if (aktion === "schluessel") { await appServer(); return antwort({ public_key: publicKey }); }
    if (aktion === "test") {
      const { data: abos } = await db.from("push_abos").select("*").eq("user_id", u!.user!.id);
      return antwort(await senden((abos ?? []) as Abo[], () => ({ title: "Trainingsplaner Oedheim", body: "Test: Benachrichtigungen funktionieren 👍", tag: "test" })));
    }
    if (!trainerTeam) return antwort({ error: "Nur für Trainer" }, 403);
    if (aktion === "erinnern") return antwort(await erinnern(trainerTeam, String(body.ziel ?? "ungelesen")));
    if (aktion === "freigabe") return antwort(await freigabeMelden(trainerTeam, String(body.id ?? "")));
    return antwort({ error: "Unbekannte Aktion" }, 400);
  } catch (e) {
    return antwort({ error: (e as Error).message ?? "Fehler" }, 500);
  }
});
