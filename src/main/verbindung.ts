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

// Laeuft nach dem Ende eines Matches und setzt beide Bildschirme danach auf
// den Ruhezustand zurueck - sonst bliebe der Endstand bis zum naechsten Match
// stehen, und die Spielpause auf dem Zuschauer-Screen kaeme nie wieder
// (gemeldet: "wenn das match vorbei ist dann kommt nicht der bildschirm mit
// der werbung"). Wird verworfen, sobald wieder ein Match laeuft.
let ruhezustandTimer: ReturnType<typeof setTimeout> | null = null

/** Wie lange der Endstand nach dem Match stehen bleibt, bevor die Spielpause
 * uebernimmt. Lang genug zum Anstossen, kurz genug, dass niemand davorsteht
 * und sich fragt, ob die Anwendung haengt. */
const ENDSTAND_STEHEN_LASSEN_MS = 30_000

// Wachhund gegen ein Match, das einfach verstummt: wird es auf der Scheibe
// mit "Exit" beendet oder bricht der Kanal weg, kommt kein letztes
// "finished" mehr. Der Board-Kanal meldet das Ende zwar meistens (siehe
// istMatchEnde in adapter.ts), aber dessen Ereignisnamen sind unbelegt -
// dieser Wachhund haengt an gar keiner Annahme und greift immer.
let stilleTimer: ReturnType<typeof setTimeout> | null = null

/** Wie lange ohne jede Zustandsmeldung gewartet wird, bevor die Anzeige in
 * die Spielpause zurueckfaellt. Grosszuegig: eine echte Aufnahme dauert
 * Sekunden, fuenf Minuten Stille bedeuten, dass nichts mehr kommt. */
const STILLE_BIS_RUHEZUSTAND_MS = 5 * 60_000

// Vollstaendige Rohereignisse im Diagnoseprotokoll - je EINES pro Bauart.
// Ohne Mitschnitt ist das die einzige Quelle fuer die tatsaechlichen
// Feldnamen INNERHALB des Zustands (players, turns, stats, scores, state).
//
// Die Bauart ist "type|variant": ein Match im Bull-off, ein Cricket-Match und
// ein normales X01-Match unterscheiden sich genau dort. Ein einziges Beispiel
// je Programmlauf haette immer nur die erste Bauart erwischt - und damit nie
// die Ermittlung des Anfangsspielers, nach der der Herausgeber gefragt hat.
const rohbeispieleProtokolliert = new Set<string>()
/** Obergrenze fuer die Zahl der Beispiele, damit das Protokoll lesbar bleibt. */
const ROHBEISPIELE_HOECHSTENS = 6
/** Obergrenze je Beispiel. */
const ROHBEISPIEL_MAX_ZEICHEN = 12_000

/** Bauart eines Rohereignisses: "type|variant" der Nutzlast, sonst "unbekannt". */
function bauart(roh: unknown): string {
  if (typeof roh !== 'object' || roh === null) return 'unbekannt'
  const umschlag = roh as Record<string, unknown>
  const nutz = (typeof umschlag.data === 'object' && umschlag.data !== null ? umschlag.data : umschlag) as Record<
    string,
    unknown
  >
  const typ = typeof nutz.type === 'string' ? nutz.type : 'ohne-type'
  const variante = typeof nutz.variant === 'string' ? nutz.variant : 'ohne-variant'
  return `${typ}|${variante}`
}

function rohbeispielProtokollieren(roh: unknown): void {
  if (rohbeispieleProtokolliert.size >= ROHBEISPIELE_HOECHSTENS) return
  const art = bauart(roh)
  if (rohbeispieleProtokolliert.has(art)) return
  rohbeispieleProtokolliert.add(art)
  try {
    const text = JSON.stringify(roh)
    void protokollieren(
      `Rohereignis [${art}] (einmalig je Bauart, gekuerzt auf ${ROHBEISPIEL_MAX_ZEICHEN} Zeichen): ${text.slice(0, ROHBEISPIEL_MAX_ZEICHEN)}`,
    )
  } catch (fehler) {
    void protokollieren(`Rohereignis liess sich nicht serialisieren: ${fehler instanceof Error ? fehler.message : String(fehler)}`)
  }
}

/**
 * Verteilt einen neuen Zustand und regelt den Uebergang zurueck in den
 * Ruhezustand: Endet ein Match, bleibt der Endstand ENDSTAND_STEHEN_LASSEN_MS
 * stehen, danach uebernimmt die Spielpause. Beginnt vorher ein neues Match,
 * wird der Ruecksprung verworfen.
 */
function zustandUebernehmen(neu: MatchState): void {
  matchZustand = neu
  zustandVerteilen(neu)
  stilleUeberwachen(neu)

  if (neu.phase === 'finished') {
    if (ruhezustandTimer === null) {
      ruhezustandTimer = setTimeout(() => {
        ruhezustandTimer = null
        void protokollieren('Match beendet, zurueck in den Ruhezustand (Spielpause)')
        matchZustand = RUHEZUSTAND
        zustandVerteilen(RUHEZUSTAND)
      }, ENDSTAND_STEHEN_LASSEN_MS)
      ruhezustandTimer.unref?.()
    }
    return
  }

  if (ruhezustandTimer !== null) {
    clearTimeout(ruhezustandTimer)
    ruhezustandTimer = null
  }
}

/**
 * Startet den Wachhund neu, solange ein Match angezeigt wird, und schaltet
 * ihn im Ruhezustand ab - dort gibt es nichts zu ueberwachen.
 */
function stilleUeberwachen(neu: MatchState): void {
  if (stilleTimer !== null) {
    clearTimeout(stilleTimer)
    stilleTimer = null
  }
  if (neu.phase === 'idle') return

  stilleTimer = setTimeout(() => {
    stilleTimer = null
    void protokollieren(
      `Seit ${STILLE_BIS_RUHEZUSTAND_MS / 60_000} Minuten keine Zustandsmeldung mehr - zurueck in den Ruhezustand (Spielpause)`,
    )
    matchZustand = RUHEZUSTAND
    zustandVerteilen(RUHEZUSTAND)
  }, STILLE_BIS_RUHEZUSTAND_MS)
  stilleTimer.unref?.()
}

/**
 * Ob gerade ein Match laeuft. Einzige Frage, die von aussen an den
 * Match-Zustand gestellt wird (aktualisierung.ts): eine Aktualisierung darf
 * nie mitten in einem Spiel installiert werden, weil der Neustart beiden
 * Bildschirmen den Stand nimmt.
 *
 * 'idle' heisst, es laeuft nichts; 'finished' heisst, das Match ist vorbei
 * und der Endstand bleibt nur noch stehen - beide sind ein guter Moment. Die
 * Phasen dazwischen ('intro', 'playing', 'legBreak') sind es nicht.
 */
export function matchLaeuft(): boolean {
  return matchZustand.phase !== 'idle' && matchZustand.phase !== 'finished'
}

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
    // Ausdruecklich protokolliert: eine von aussen gesetzte Variable hat
    // Vorrang und schreibt woandershin als erwartet. Genau das war der Fall,
    // als nach einem echten Match kein Mitschnitt unter mitschnitte/ lag -
    // ohne diese Zeile war im Protokoll nicht zu sehen, wohin stattdessen
    // geschrieben wurde.
    void protokollieren(`Aufzeichnung nach vorgegebenem Pfad: ${process.env.AD_AUFZEICHNEN}`)
    return
  }
  process.env.AD_AUFZEICHNEN = await standardAufzeichnungspfad()
  void protokollieren(`Aufzeichnung nach: ${process.env.AD_AUFZEICHNEN}`)
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
          rohbeispielProtokollieren(roh)
          zustandUebernehmen(anwenden(matchZustand, roh))
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
