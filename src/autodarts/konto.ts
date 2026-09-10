// Ermittelt den Anzeigenamen des angemeldeten Kontos fuer "Angemeldet als:
// <Name>" im Control-Fenster.
//
// Urspruenglich fuer GET /us/v0/users/@me gebaut (der Pfad existiert, siehe
// docs/autodarts-api.md - ein 401 ohne Token beweist das). Eigener Test mit
// gueltigem Token deckte aber auf: der Pfad ist kein "aktueller Nutzer"-Alias,
// "@me" wird dort woertlich als Nutzer-UUID geparst und der Server antwortet
// 400 {"code":"uuid","message":"invalid UUID length: 3"} - der Endpunkt gibt
// nie Kontofelder her, ohne die eigene UUID vorher woanders zu kennen (siehe
// docs/autodarts-api.md, Abschnitt zu diesem Befund).
//
// Der Zugriffstoken selbst ist ein JWT (Keycloak-Form) und traegt die
// gesuchten Felder bereits als Claims - eigener Test (protokollierte
// Feldnamen, siehe kontoNameLaden unten): iss, sub, aud, exp, iat, azp,
// email, email_verified, preferred_username, name, given_name, family_name,
// picture, scope, realm_access. Kein Netzaufruf noetig - der Token liegt
// (nach einer Anmeldung oder einer stillen Erneuerung) ohnehin schon im
// Hauptprozess vor.
//
// Eigene Datei statt Teil von oauth.ts: zugriffsToken() dort ist bereits
// exportiert und wird hier nur aufgerufen, keine Ringabhaengigkeit noetig
// (anders als bei einem REST-Aufruf ueber rest.ts, das seinerseits von
// oauth.ts importiert - siehe Kommentar an NichtAngemeldetFehler in fehler.ts
// fuer das gleiche Muster).

import { zugriffsToken } from './oauth'
import { feldUebersicht, protokollieren } from './diagnose'

// Reihenfolge der Kandidatenfelder: das erste nicht-leere Textfeld gewinnt.
// "name" (Keycloak: voller Anzeigename) deckt den ueblichen Fall ab; die
// anderen sind Rueckfallebenen, falls ein Konto "name" einmal nicht setzt.
const NAMENSFELDER = ['name', 'userName', 'displayName', 'email', 'preferred_username'] as const

/**
 * Reine Extraktion des Anzeigenamens aus einer Kontoantwort unbekannter
 * Form: sucht NAMENSFELDER der Reihe nach und liefert das erste, das ein
 * nicht-leerer String ist. Liefert null bei einem Nicht-Objekt, bei null,
 * bei einem Feld mit falschem Typ (z.B. einer Zahl) oder wenn kein
 * Kandidatenfeld etwas Brauchbares enthaelt - der Aufrufer zeigt dann "Name
 * unbekannt" an, statt etwas zu erfinden.
 */
export function nameAusKonto(antwort: unknown): string | null {
  if (typeof antwort !== 'object' || antwort === null) return null
  const objekt = antwort as Record<string, unknown>
  for (const feld of NAMENSFELDER) {
    const wert = objekt[feld]
    if (typeof wert === 'string' && wert.trim() !== '') return wert
  }
  return null
}

/** Ergebnis von anmeldung:status (siehe src/main/ipc.ts) - kontoName ist nur bei angemeldet:true je nicht-null. */
export type AnmeldungsStatus = { angemeldet: boolean; kontoName: string | null }

/**
 * Dekodiert (ohne Signaturpruefung - die ist hier nicht das Ziel, der Token
 * kommt ohnehin nur aus der eigenen, gerade erst erfolgreichen Anmeldung
 * bzw. Erneuerung) die Nutzlast eines JWT. Liefert null bei einem Token ohne
 * die ueblichen drei Punkt-getrennten Teile oder mit unlesbarer Nutzlast -
 * kein Grund zum Abbruch, nur ein weiteres "Name unbekannt".
 */
function zugriffstokenNutzlast(token: string): unknown {
  const teile = token.split('.')
  if (teile.length !== 3) return null
  try {
    return JSON.parse(Buffer.from(teile[1]!, 'base64url').toString('utf-8'))
  } catch {
    return null
  }
}

// Im Speicher gehalten, nicht in der verschluesselten Ablage - ein
// Anzeigename ist kein Geheimnis, muss aber trotzdem bei jeder neuen
// Anmeldung neu ermittelt und bei jeder Abmeldung verworfen werden (siehe
// kontoNameVerwerfen). kontoNameFertig unterscheidet "noch nie versucht" von
// "versucht, aber ohne Ergebnis geblieben" - ohne diese Unterscheidung wuerde
// ein gescheiterter erster Versuch bei jedem weiteren anmeldung:status erneut
// zugriffsToken() aufrufen, obwohl "einmal ermitteln" verlangt ist.
let kontoName: string | null = null
let kontoNameFertig = false
// Single-Flight, gleiches Muster wie laufendeAnmeldung/laufendeErneuerung in
// oauth.ts: zwei kurz hintereinander eintreffende anmeldung:status-Aufrufe
// (z.B. der anmeldenAusloesen()-Aufruf im Control-Fenster direkt gefolgt vom
// naechsten Render) sollen sich denselben zugriffsToken()-Aufruf teilen -
// zugriffsToken() erneuert bei Bedarf ueber das Netz und hat selbst schon
// ein Single-Flight fuer die Erneuerung, aber nicht fuer einen bereits
// gueltigen, zwischengespeicherten Token, den es sofort synchron zurueckgibt.
let ladeVorgang: Promise<void> | null = null

/**
 * Ermittelt - beim allerersten Aufruf nach einer Anmeldung - einmalig den
 * Anzeigenamen aus den Claims des aktuellen Zugriffstokens (siehe Kommentar
 * am Dateianfang) und merkt ihn sich im Hauptprozess. Jeder weitere Aufruf
 * liefert nur noch den zwischengespeicherten Wert zurueck, ohne erneut zu
 * dekodieren. Scheitert die Ermittlung (zugriffsToken() wirft z.B. bei
 * fehlgeschlagener Erneuerung, oder der Token traegt keine brauchbaren
 * Claims), bleibt kontoName null - das kippt nie die Anmeldung selbst, der
 * Aufrufer (anmeldung:status in src/main/ipc.ts) zeigt dann "Kontoname nicht
 * abrufbar" an.
 */
export async function kontoNameLaden(): Promise<string | null> {
  if (kontoNameFertig) return kontoName
  if (!ladeVorgang) {
    ladeVorgang = (async () => {
      try {
        const token = await zugriffsToken()
        const nutzlast = zugriffstokenNutzlast(token)
        void protokollieren(`Zugriffstoken-Nutzlast, Felder: ${feldUebersicht(nutzlast)}`)
        kontoName = nameAusKonto(nutzlast)
      } catch (fehler) {
        void protokollieren(`Kontoname konnte nicht ermittelt werden: ${fehler instanceof Error ? fehler.message : String(fehler)}`)
        kontoName = null
      } finally {
        kontoNameFertig = true
        ladeVorgang = null
      }
    })()
  }
  await ladeVorgang
  return kontoName
}

/**
 * Verwirft den zwischengespeicherten Kontonamen - beim Abmelden aufrufen
 * (der Name gehoert dann zu keinem angemeldeten Konto mehr) und direkt nach
 * einer neuen erfolgreichen Anmeldung (der naechste anmeldung:status-Aufruf
 * soll frisch abfragen statt den Namen eines moeglicherweise anderen, vorher
 * angemeldeten Kontos weiterzureichen).
 */
export function kontoNameVerwerfen(): void {
  kontoName = null
  kontoNameFertig = false
  ladeVorgang = null
}
