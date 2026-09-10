// Verwaltet die einzige Autodarts-Verbindung dieses Prozesses. Ausgelagert
// aus index.ts, weil sowohl der Start (index.ts) als auch die Anmelde- und
// Abmelde-Kanaele (ipc.ts) sie brauchen: nach einer erfolgreichen Anmeldung
// zur Laufzeit muss sich die Anwendung verbinden, ohne dass ein Neustart
// noetig ist, und nach dem Abmelden muss sie sich wieder trennen.

import { isAbsolute, resolve } from 'node:path'
import { verbindungszustandVerteilen, zustandVerteilen } from './fenster'
import { konfigurationLesen } from './konfiguration'
import { istAngemeldet } from '../autodarts/oauth'
import { boardThema, KANAL_BOARDS, verbinden, type Verbindung } from '../autodarts/websocket'
import { standardAufzeichnungspfad } from '../autodarts/aufzeichnung'
import { protokollieren } from '../autodarts/diagnose'
import { anwenden, RUHEZUSTAND } from '../autodarts/adapter'
import type { MatchState } from '../shared/typen'

// Die einzige offene Verbindung dieses Prozesses - gehalten, um sie beim
// Beenden der Anwendung oder nach einer Abmeldung sauber zu schliessen.
// Bleibt null, wenn nie verbunden wurde (keine Anmeldung, kein
// AD_WIEDERGABE, oder der Aufbau ist gescheitert).
let aktiveVerbindung: Verbindung | null = null

// Haelt einen laufenden Verbindungsversuch fest, damit ein zweiter Aufruf
// von verbindungStarten() (z.B. der Start-Hook in index.ts und ein
// unmittelbar danach erfolgreicher Anmeldeversuch) nicht eine zweite
// Verbindung neben der ersten aufbaut. Gleiches Single-Flight-Muster wie
// laufendeAnmeldung in oauth.ts.
let laufenderVerbindungsversuch: Promise<void> | null = null

// Letzter per anwenden() abgeleiteter MatchState - lebt hier statt in
// adapter.ts, weil anwenden() rein bleiben soll (Eingabe/Ausgabe, kein
// eigenes Gedaechtnis). Ueberlebt eine Wiederverbindung bewusst: ein
// Abbruch mitten im Match soll den Player-/Zuschauer-Screen nicht auf den
// Ruhezustand zuruecksetzen, solange kein neues Match beginnt.
let matchZustand: MatchState = RUHEZUSTAND

/**
 * Sorgt dafuer, dass AD_AUFZEICHNEN vor dem Verbindungsaufbau immer einen
 * nutzbaren, absoluten Pfad enthaelt - egal ob der Herausgeber ihn selbst
 * gesetzt hat oder nicht. websocket.ts liest die Variable danach unveraendert
 * wie bisher (siehe echteVerbindung() dort).
 *
 * - Ist sie gesetzt (ausdrueckliche Wahl, hat Vorrang), wird nur ein
 *   relativer Pfad gegen das tatsaechliche Arbeitsverzeichnis des Prozesses
 *   aufgeloest statt implizit irgendwo anders zu landen (siehe
 *   docs/UEBERGABE.md, relativer Pfad `docs\fixtures\match.jsonl`).
 * - Ist sie NICHT gesetzt - der Normalfall, wenn die Anwendung ueber die
 *   Verknuepfung ohne Umgebungsvariablen startet - wird sie hier mit einem
 *   Standardpfad unter app.getPath('userData')/mitschnitte/ belegt (siehe
 *   standardAufzeichnungspfad() in aufzeichnung.ts). Ohne einen echten
 *   Mitschnitt kennt niemand das tatsaechliche Ereignis-Schema (siehe
 *   docs/UEBERGABE.md) - und der Herausgeber startet nie mit gesetzten
 *   Umgebungsvariablen, ein rein optionales Aufzeichnen waere also nie aktiv.
 */
async function aufzeichnungspfadSicherstellen(): Promise<void> {
  const pfad = process.env.AD_AUFZEICHNEN
  if (pfad) {
    if (!isAbsolute(pfad)) process.env.AD_AUFZEICHNEN = resolve(process.cwd(), pfad)
    return
  }
  process.env.AD_AUFZEICHNEN = await standardAufzeichnungspfad()
}

async function verbindungAufbauen(): Promise<void> {
  const wiedergabe = process.env.AD_WIEDERGABE

  if (!wiedergabe) {
    if (!(await istAngemeldet())) {
      void protokollieren('Verbindungsaufbau abgebrochen: keine Anmeldung vorhanden')
      verbindungszustandVerteilen('nichtAngemeldet')
      return
    }
    try {
      await aufzeichnungspfadSicherstellen()
    } catch (fehler) {
      // Die Anzeige des Matches ist wichtiger als die Aufzeichnung (gleiche
      // Haltung wie in aufzeichnung.ts bei einem Stream-Fehler): schlaegt
      // schon die Pfadermittlung fehl, bleibt AD_AUFZEICHNEN diesmal einfach
      // unbelegt statt den Verbindungsaufbau abzubrechen.
      void protokollieren(
        `Aufzeichnungspfad liess sich nicht ermitteln, Aufzeichnung bleibt diesmal aus: ${fehler instanceof Error ? fehler.message : String(fehler)}`,
      )
    }
  }

  void protokollieren('Verbindungsaufbau gestartet')
  try {
    aktiveVerbindung = await verbinden(
      (roh) => {
        // Ein Fehler im Adapter darf die Verbindung nie abreissen lassen
        // (Spec Abschnitt 14): fangen, protokollieren, letzten bekannten
        // Zustand behalten. anwenden() selbst wirft nach eigenem Anspruch
        // nie (unerwartete Formen fuehren zu Vorgabewerten statt zu
        // Exceptions) - dieses catch ist trotzdem die letzte Verteidigungs-
        // linie gegen einen Fehler, den anwenden() nicht vorhergesehen hat.
        try {
          matchZustand = anwenden(matchZustand, roh)
          zustandVerteilen(matchZustand)
        } catch (fehler) {
          void protokollieren(
            `Adapter-Fehler, letzter bekannter Zustand bleibt erhalten: ${fehler instanceof Error ? fehler.message : String(fehler)}`,
          )
          console.error('Adapter konnte Rohereignis nicht verarbeiten, behalte letzten Zustand:', fehler)
        }
      },
      (zustand) => verbindungszustandVerteilen(zustand),
    )
    void protokollieren('Verbindung aufgebaut')

    // Ohne Board-Kennung kann die Anwendung kein Match finden - es gibt
    // keinen anderen Weg, an ein laufendes Match heranzukommen, als den
    // Board-Kanal zu abonnieren. Im Wiedergabefall (AD_WIEDERGABE) gibt es
    // ohnehin keine echte Verbindung, die etwas abonnieren koennte (siehe
    // wiedergabeVerbindung in websocket.ts), deshalb hier ausgelassen.
    if (!wiedergabe) {
      const konfiguration = await konfigurationLesen()
      if (konfiguration.boardId) {
        aktiveVerbindung.abonnieren(KANAL_BOARDS, boardThema(konfiguration.boardId))
        void protokollieren(`Board abonniert: ${KANAL_BOARDS}/${boardThema(konfiguration.boardId)}`)
      } else {
        void protokollieren(
          'Kein Board-Abonnement: keine Board-Kennung in der Konfiguration - ohne sie kann die Anwendung kein Match finden. Board-Kennung im Control-Fenster setzen.',
        )
      }
    }
  } catch (fehler) {
    void protokollieren(`Verbindungsaufbau fehlgeschlagen: ${fehler instanceof Error ? fehler.message : String(fehler)}`)
    console.error('Autodarts-Verbindung konnte nicht aufgebaut werden, bleibe im Ruhezustand:', fehler)
  }
}

/**
 * Baut - wenn sinnvoll - die Verbindung zu Autodarts auf und haengt das
 * Control-Fenster an ihren Verbindungszustand. Aufrufer: index.ts beim
 * Start (nach dem Laden des Control-Fensters) und ipc.ts nach einer
 * erfolgreichen Anmeldung zur Laufzeit.
 *
 * "Sinnvoll" heisst: bei AD_WIEDERGABE immer (verbinden() fordert dort kein
 * Token an und oeffnet keine echte Verbindung), sonst nur mit vorliegender
 * Anmeldung - ohne sie wuerde die Anwendung mit einem Anmeldefenster
 * ueberfallen. Scheitert der Aufbau trotzdem (Netzwerk, Server), bleibt die
 * Anwendung im Ruhezustand statt abzubrechen.
 *
 * Ist bereits eine Verbindung aktiv oder ein Aufbau im Gange, tut ein
 * weiterer Aufruf nichts - es soll nie eine zweite Verbindung neben einer
 * bestehenden entstehen.
 */
export async function verbindungStarten(): Promise<void> {
  // Beide fruehen Ausstiege werden protokolliert: ohne das ist ein
  // ausbleibender Verbindungsaufbau im Diagnoseprotokoll nicht von einem nie
  // erfolgten Aufruf zu unterscheiden - genau daran hing die Suche nach dem
  // Fehler "nach der Anmeldung passiert nichts".
  if (aktiveVerbindung) {
    void protokollieren('Verbindungsaufbau uebersprungen: bereits verbunden')
    return
  }
  if (laufenderVerbindungsversuch) {
    void protokollieren('Verbindungsaufbau uebersprungen: Versuch laeuft bereits')
    return laufenderVerbindungsversuch
  }
  void protokollieren('Verbindungsaufbau angefordert')
  laufenderVerbindungsversuch = verbindungAufbauen().finally(() => {
    laufenderVerbindungsversuch = null
  })
  return laufenderVerbindungsversuch
}

/**
 * Schliesst eine offene Verbindung (falls vorhanden) und wartet auf das
 * saubere Beenden einer laufenden Aufzeichnung - siehe
 * Verbindung.schliessen() in websocket.ts. Aufrufer: index.ts beim Beenden
 * der Anwendung und ipc.ts nach dem Abmelden. Tut nichts, wenn ohnehin keine
 * Verbindung aktiv ist (z.B. weil nie eine Anmeldung vorlag).
 */
export async function verbindungBeenden(): Promise<void> {
  const verbindung = aktiveVerbindung
  aktiveVerbindung = null
  if (verbindung) await verbindung.schliessen()
}
