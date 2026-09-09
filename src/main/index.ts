import { app } from 'electron'
import { isAbsolute, resolve } from 'node:path'
import { fensterOeffnen, konfigurationAktualisieren, verbindungszustandVerteilen, zustandVerteilen } from './fenster'
import { ipcRegistrieren } from './ipc'
import { konfigurationLesen } from './konfiguration'
import { checkoutWeg, setupWurf } from '../shared/checkout'
import type { MatchState, Player, Segment } from '../shared/typen'
import { istAngemeldet } from '../autodarts/oauth'
import { verbinden, type Verbindung } from '../autodarts/websocket'

/**
 * Verschickt ohne Netz und ohne laufenden Adapter einen realistisch gefuellten,
 * synthetischen MatchState - aktiviert ueber AD_TESTZUSTAND=1. Kein
 * Wegwerf-Code: taugt weiterhin zum Entwickeln von Layout und Zahlen am
 * Player-Screen, unabhaengig vom Adapter, der Rohereignisse noch nicht in
 * MatchState uebersetzt (der fehlt absichtlich, siehe docs/UEBERGABE.md).
 * Wiederholt alle 3 Sekunden mit einem neuen Wurf, damit sich am
 * Player-Screen tatsaechlich etwas veraendert (nicht nur ein einmaliger
 * statischer Zustand).
 */
function testZustandStarten(): void {
  const spieler: Player[] = [
    { id: 'p1', autodartsName: 'testspieler_eins', displayName: 'Anna' },
    { id: 'p2', autodartsName: 'testspieler_zwei', displayName: 'Ben' },
  ]
  const wurf: Segment[] = [
    { name: 'T20', value: 20, multiplier: 3 },
    { name: 'T20', value: 20, multiplier: 3 },
    { name: '5', value: 5, multiplier: 1 },
  ]
  const summe = wurf.reduce((s, d) => s + d.value * d.multiplier, 0)

  let restAktiv = 501
  let sequenz = 0

  const naechsterZustand = (): MatchState => {
    sequenz += 1
    const neuerRest = restAktiv - summe
    // Rest 1 oder darunter ist beim x01 ohne gueltiges Doppel ein Bust bzw.
    // ein Wert, den checkoutWeg/setupWurf nicht mehr sinnvoll behandeln -
    // fuer diesen Entwicklungs-Fixture reicht es, dann wieder von vorn zu
    // beginnen, statt Bust- oder Leg-Ende-Logik nachzubilden.
    restAktiv = neuerRest <= 1 ? 501 : neuerRest
    const weg = checkoutWeg(restAktiv, 3)

    return {
      phase: 'playing',
      matchId: 'test-zustand',
      variant: 'x01',
      startScore: 501,
      players: spieler,
      scores: [
        {
          playerId: 'p1',
          remaining: restAktiv,
          legs: 1,
          sets: 0,
          average3: 78.4,
          checkoutAttempts: 1,
          checkoutHits: 0,
          count180: 1,
          highestFinish: null,
        },
        {
          playerId: 'p2',
          remaining: 241,
          legs: 0,
          sets: 0,
          average3: 65.1,
          checkoutAttempts: 0,
          checkoutHits: 0,
          count180: 0,
          highestFinish: null,
        },
      ],
      activePlayerId: 'p1',
      currentThrow: wurf,
      currentThrowTotal: summe,
      bust: false,
      checkout: weg,
      checkoutHint: weg ? null : setupWurf(restAktiv),
      legHistory: [],
      lastEvent: { seq: sequenz, kind: 'throw' },
    }
  }

  setTimeout(() => zustandVerteilen(naechsterZustand()), 800)
  setInterval(() => zustandVerteilen(naechsterZustand()), 3000)
}

// Die einzige offene Verbindung dieses Prozesses - gehalten, um sie beim
// Beenden der Anwendung sauber zu schliessen (siehe app.on('before-quit')
// unten). Bleibt null, wenn nie verbunden wurde (keine Anmeldung, kein
// AD_WIEDERGABE, oder der Aufbau ist gescheitert).
let aktiveVerbindung: Verbindung | null = null

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

/**
 * Baut - wenn sinnvoll - die Verbindung zu Autodarts auf und haengt das
 * Control-Fenster an ihren Verbindungszustand. Rohereignisse laufen bislang
 * ins Leere: der Adapter zu MatchState fehlt absichtlich und braucht einen
 * echten Mitschnitt (docs/UEBERGABE.md, Schritt 3) - der Zweck dieser
 * Verdrahtung ist zunaechst, dass AD_AUFZEICHNEN ueberhaupt einen Mitschnitt
 * erzeugt.
 *
 * "Sinnvoll" heisst: bei AD_WIEDERGABE immer (verbinden() fordert dort kein
 * Token an und oeffnet keine echte Verbindung), sonst nur mit vorliegender
 * Anmeldung - ohne sie wuerde die Anwendung mit einem Anmeldefenster
 * ueberfallen, das es noch gar nicht gibt (siehe ipc.ts). Scheitert der
 * Aufbau trotzdem (Netzwerk, Server), bleibt die Anwendung im Ruhezustand
 * statt abzubrechen.
 */
async function liveVerbindungStarten(): Promise<void> {
  const wiedergabe = process.env.AD_WIEDERGABE

  if (!wiedergabe) {
    if (!(await istAngemeldet())) {
      verbindungszustandVerteilen('nichtAngemeldet')
      return
    }
    aufzeichnungspfadNormalisieren()
  }

  try {
    aktiveVerbindung = await verbinden(
      () => {
        // Adapter fehlt absichtlich (siehe docs/UEBERGABE.md) - das
        // Rohereignis geht bislang nirgendwo hin, ausser in eine laufende
        // Aufzeichnung (die verbinden() selbst schreibt, siehe websocket.ts).
      },
      (zustand) => verbindungszustandVerteilen(zustand),
    )
  } catch (fehler) {
    console.error('Autodarts-Verbindung konnte nicht aufgebaut werden, bleibe im Ruhezustand:', fehler)
  }
}

app.whenReady().then(async () => {
  ipcRegistrieren()
  konfigurationAktualisieren(await konfigurationLesen())
  const controlFenster = fensterOeffnen('control')

  if (process.env.AD_TESTZUSTAND === '1') {
    fensterOeffnen('player')
    testZustandStarten()
    return
  }

  // Erst verbinden, wenn das Control-Fenster seinen Inhalt geladen hat (der
  // beiVerbindungszustand()-Listener im Renderer ist dann registriert) -
  // sonst koennte die allererste Zustandsmeldung (z.B. "nichtAngemeldet")
  // ungesehen verschwinden, weil Electron IPC-Nachrichten nicht zwischenspeichert.
  controlFenster.webContents.once('did-finish-load', () => {
    void liveVerbindungStarten()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Schliesst eine offene Verbindung und wartet auf das saubere Beenden einer
// laufenden Aufzeichnung, bevor der Prozess tatsaechlich endet - sonst
// fehlten die letzten Zeilen, weil der WriteStream sein "finish" nie
// abwarten durfte. preventDefault() plus erneutes app.quit() danach ist das
// uebliche Electron-Muster fuer asynchrones Aufraeumen beim Beenden.
let wirdBeendet = false
app.on('before-quit', (ereignis) => {
  if (wirdBeendet || !aktiveVerbindung) return
  wirdBeendet = true
  ereignis.preventDefault()
  aktiveVerbindung.schliessen().finally(() => app.quit())
})
