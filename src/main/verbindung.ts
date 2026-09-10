// Verwaltet die einzige Autodarts-Verbindung dieses Prozesses. Ausgelagert
// aus index.ts, weil sowohl der Start (index.ts) als auch die Anmelde- und
// Abmelde-Kanaele (ipc.ts) sie brauchen: nach einer erfolgreichen Anmeldung
// zur Laufzeit muss sich die Anwendung verbinden, ohne dass ein Neustart
// noetig ist, und nach dem Abmelden muss sie sich wieder trennen.

import { isAbsolute, resolve } from 'node:path'
import { verbindungszustandVerteilen } from './fenster'
import { istAngemeldet } from '../autodarts/oauth'
import { verbinden, type Verbindung } from '../autodarts/websocket'
import { protokollieren } from '../autodarts/diagnose'

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

/**
 * Macht einen relativen AD_AUFZEICHNEN-Pfad relativ zum tatsaechlichen
 * Arbeitsverzeichnis des Prozesses statt implizit irgendwo anders zu landen.
 * Der Herausgeber gibt in docs/UEBERGABE.md einen relativen Pfad an
 * (`docs\fixtures\match.jsonl`) und erwartet ihn dort im Projektverzeichnis.
 */
function aufzeichnungspfadNormalisieren(): void {
  const pfad = process.env.AD_AUFZEICHNEN
  if (pfad && !isAbsolute(pfad)) {
    process.env.AD_AUFZEICHNEN = resolve(process.cwd(), pfad)
  }
}

async function verbindungAufbauen(): Promise<void> {
  const wiedergabe = process.env.AD_WIEDERGABE

  if (!wiedergabe) {
    if (!(await istAngemeldet())) {
      verbindungszustandVerteilen('nichtAngemeldet')
      return
    }
    aufzeichnungspfadNormalisieren()
  }

  void protokollieren('Verbindungsaufbau gestartet')
  try {
    aktiveVerbindung = await verbinden(
      () => {
        // Adapter fehlt absichtlich (siehe docs/UEBERGABE.md) - das
        // Rohereignis geht bislang nirgendwo hin, ausser in eine laufende
        // Aufzeichnung (die verbinden() selbst schreibt, siehe websocket.ts).
      },
      (zustand) => verbindungszustandVerteilen(zustand),
    )
    void protokollieren('Verbindung aufgebaut')
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
  if (aktiveVerbindung) return
  if (!laufenderVerbindungsversuch) {
    laufenderVerbindungsversuch = verbindungAufbauen().finally(() => {
      laufenderVerbindungsversuch = null
    })
  }
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
