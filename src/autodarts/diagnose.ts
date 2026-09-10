// Diagnoseprotokoll fuer den Anmelde- und Verbindungsaufbau. Schreibt eine
// Datei unter app.getPath('userData')/diagnose.log, die der Herausgeber im
// Fehlerfall an den Support schicken kann - deshalb die harte Regel: kein
// Token, kein Code, kein Verifier, kein State und kein Passwort darf je in
// dieser Datei landen. geheimnisseFiltern() ist die einzige Stelle, die
// entscheidet, was aus einem Wert vor dem Schreiben entfernt wird, und
// protokollieren() ruft sie ausnahmslos auf - kein Aufrufer kann sie
// versehentlich umgehen, weil es keinen zweiten Weg gibt, in diese Datei zu
// schreiben.
//
// Liegt in src/autodarts/ statt in src/main/, obwohl sie unter userData
// schreibt: sowohl oauth.ts als auch websocket.ts (beide src/autodarts/)
// protokollieren hierher, und src/main/ haengt bereits von src/autodarts/ ab
// (ipc.ts, verbindung.ts importieren von dort) - nicht umgekehrt. Eine Datei
// unter src/main/ wuerde diese Abhaengigkeitsrichtung fuer diese eine Datei
// umdrehen.
//
// Kein Top-Level-Import von 'electron', gleiches Muster wie in oauth.ts und
// konfiguration.ts: geheimnisseFiltern, adresseOhneAbfrage und
// feldUebersicht sind reine Funktionen, unter Vitest ohne laufende
// Electron-Runtime testbar. app.getPath('userData') wird erst innerhalb von
// diagnosePfad() per dynamischem import('electron') geholt.

import { appendFile, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const ERSATZ = '[ENTFERNT]'

// Nur in Abfrageparametern gefaehrlich. "code" und "state" tauchen im
// Autodarts-API sonst nur als harmlose Fehlerklassifizierung auf - z.B.
// antwortet der Server auf einen abgelehnten Code-Tausch mit
// {"error":{"code":"invalid_code", "message": "..."}} (Status 400) - und
// sollen dort lesbar bleiben, sonst sieht der Herausgeber die Ursache nicht.
// Der tatsaechliche Autorisierungscode und der state-Wert stehen dagegen
// ausschliesslich in Abfrageparametern der Umleitungsadresse.
const NUR_IN_ABFRAGE = ['code', 'state']

// Diese Werte sind ueberall gefaehrlich, egal ob als Abfrageparameter oder
// als JSON-Feld einer Antwort - access_token/refresh_token/id_token stehen
// z.B. direkt im Rumpf der Code-Tausch- bzw. Erneuerungs-Antwort.
const UEBERALL_GEFAEHRLICH = [
  'access_token',
  'refresh_token',
  'id_token',
  'token',
  'code_verifier',
  'verifier',
  'client_secret',
  'password',
  'secret',
]

function abfrageErsetzen(text: string, schluessel: string): string {
  return text.replace(new RegExp(`([?&]${schluessel}=)[^&"'\\s]*`, 'gi'), `$1${ERSATZ}`)
}

function jsonFeldErsetzen(text: string, schluessel: string): string {
  return text.replace(new RegExp(`("${schluessel}"\\s*:\\s*")[^"]*(")`, 'gi'), `$1${ERSATZ}$2`)
}

/**
 * Ersetzt alle bekannten Geheimniswerte in `wert` durch ERSATZ, bevor er ins
 * Diagnoseprotokoll geschrieben wird. Nimmt Zeichenketten, Fehler und
 * beliebige Objekte entgegen - alles wird zuerst zu Text (JSON.stringify
 * bzw. "Name: Nachricht" bei einem Error), dann regelbasiert gesaeubert.
 * protokollieren() unten ruft diese Funktion ausnahmslos auf, bevor sie
 * irgendetwas schreibt - das ist die wichtigste Regel dieser Datei.
 */
export function geheimnisseFiltern(wert: unknown): string {
  let text: string
  if (typeof wert === 'string') {
    text = wert
  } else if (wert instanceof Error) {
    text = `${wert.name}: ${wert.message}`
  } else {
    try {
      text = JSON.stringify(wert)
    } catch {
      text = String(wert)
    }
  }

  for (const schluessel of NUR_IN_ABFRAGE) {
    text = abfrageErsetzen(text, schluessel)
  }
  for (const schluessel of UEBERALL_GEFAEHRLICH) {
    text = abfrageErsetzen(text, schluessel)
    text = jsonFeldErsetzen(text, schluessel)
  }

  // Ein Token ganz ohne erkennbaren Feldnamen im Fliesstext einer
  // Fehlermeldung - drei durch Punkte getrennte, jeweils ausreichend lange
  // Teile, die uebliche JWT-Form.
  text = text.replace(/[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g, ERSATZ)

  return text
}

/**
 * Reduziert eine Adresse auf Schema, Host und Pfad - fuer die Navigations-
 * protokollierung, die Abfrageparameter (Code, State) nie sehen soll. Eine
 * unlesbare Adresse (kein gueltiges URL-Format) faellt auf einen festen
 * Platzhalter zurueck statt eine Exception zu werfen - eine kaputte Adresse
 * ist selbst schon ein interessanter Befund fuers Protokoll.
 */
export function adresseOhneAbfrage(url: string): string {
  try {
    const adresse = new URL(url)
    return `${adresse.protocol}//${adresse.host}${adresse.pathname}`
  } catch {
    return '(unlesbare Adresse)'
  }
}

/**
 * Beschreibt die Felder eines Objekts fuers Protokoll - nur Namen und
 * JS-Werttyp, nie der Wert selbst. Fuer die Antwort auf den Code-Tausch
 * gedacht: heisst ein Feld dort anders als angenommen (access_token,
 * refresh_token, expires_in), zeigt sich das hier, ohne den Wert preiszugeben.
 */
export function feldUebersicht(objekt: unknown): string {
  if (typeof objekt !== 'object' || objekt === null) {
    return `(kein Objekt, sondern ${typeof objekt})`
  }
  const eintraege = Object.entries(objekt as Record<string, unknown>).map(
    ([schluessel, wert]) => `${schluessel}:${wert === null ? 'null' : typeof wert}`,
  )
  return eintraege.length > 0 ? eintraege.join(', ') : '(leeres Objekt)'
}

// Etwas unter "ein paar hundert Kilobyte" (Aufgabenstellung) - die Datei
// begrenzt sich selbst, statt unbemerkt vollzulaufen.
const MAX_BYTES = 300 * 1024

/** Pfad des Diagnoseprotokolls - auch fuer die Anzeige im Control-Fenster. */
export async function diagnosePfad(): Promise<string> {
  const { app } = await import('electron')
  return join(app.getPath('userData'), 'diagnose.log')
}

async function beiBedarfKuerzen(datei: string): Promise<void> {
  try {
    const { size } = await stat(datei)
    if (size <= MAX_BYTES) return
    const inhalt = await readFile(datei, 'utf-8')
    // Nur die neuere Haelfte behalten, an der naechsten Zeilenumbruchgrenze
    // abgeschnitten, damit keine halbe Zeile stehen bleibt.
    const rest = inhalt.slice(-Math.floor(MAX_BYTES / 2))
    const ersterZeilenumbruch = rest.indexOf('\n')
    await writeFile(datei, ersterZeilenumbruch >= 0 ? rest.slice(ersterZeilenumbruch + 1) : rest, 'utf-8')
  } catch {
    // Datei existiert noch nicht oder ist gerade nicht lesbar - beim
    // naechsten Anhaengen entsteht sie neu, kein Grund zum Abbruch.
  }
}

// Alle Aufrufer (oauth.ts, websocket.ts, verbindung.ts) rufen protokollieren()
// bewusst als "void protokollieren(...)" auf - Feuer-und-vergessen, ohne den
// eigentlichen Ablauf auf das Schreiben warten zu lassen. Ohne diese Kette
// wuerden mehrere kurz hintereinander ausgeloeste Aufrufe parallel um dieselbe
// Datei konkurrieren: der langsamere haette am Ende geschrieben, obwohl er
// zuerst aufgerufen wurde (beobachtet: "Anmeldefenster geoeffnet" landete vor
// "Anmeldung gestartet" in der Datei, obwohl deren eigene Zeitstempel das
// Gegenteil zeigten) - und beiBedarfKuerzen() (liest+ueberschreibt die ganze
// Datei) koennte sich mit einem gleichzeitigen appendFile() ueberschneiden.
// Jeder Aufruf haengt sich an die vorherige Schreibkette, dadurch laufen alle
// Schreibvorgaenge streng nacheinander in Aufrufreihenfolge.
let schreibKette: Promise<void> = Promise.resolve()

async function zeileSchreiben(zeile: string): Promise<void> {
  try {
    const datei = await diagnosePfad()
    await beiBedarfKuerzen(datei)
    await appendFile(datei, zeile, 'utf-8')
  } catch (fehler) {
    console.error('Diagnoseprotokoll liess sich nicht schreiben:', fehler)
  }
}

/**
 * Haengt eine Zeile ans Diagnoseprotokoll an: Zeitstempel plus der durch
 * geheimnisseFiltern() gesaeuberte Text von `nachricht`. oauth.ts,
 * websocket.ts und verbindung.ts nutzen ausschliesslich diese Funktion zum
 * Schreiben - es gibt keinen zweiten Weg an der Filterung vorbei. Zeitstempel
 * und Filterung laufen synchron beim Aufruf (siehe schreibKette oben), damit
 * die Reihenfolge in der Datei immer der tatsaechlichen Aufrufreihenfolge
 * entspricht. Ein Schreibfehler (z.B. Platte voll) landet nur in der
 * Konsole, er soll nie die eigentliche Anmeldung oder Verbindung zum
 * Scheitern bringen.
 */
export function protokollieren(nachricht: unknown): Promise<void> {
  const zeile = `[${new Date().toISOString()}] ${geheimnisseFiltern(nachricht)}\n`
  schreibKette = schreibKette.then(() => zeileSchreiben(zeile))
  return schreibKette
}
