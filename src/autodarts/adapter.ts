// Adapter-Schicht (Spec Abschnitt 5.4/6): einzige Stelle, die Autodarts-
// Feldnamen kennt und sie in MatchState uebersetzt. anwenden() ist rein -
// gleiche Eingabe liefert immer dieselbe Ausgabe, der uebergebene Zustand
// wird nie veraendert - bis auf das Diagnoseprotokoll (siehe
// einmaligProtokollieren), das den Rueckgabewert nicht beeinflusst.
//
// Belegtes Schema (2026-09-10, aus einem laufenden Match des Herausgebers,
// siehe docs/UEBERGABE.md): auf Kanal autodarts.matches, Thema
// "<matchId>.state", kommt bei jedem Wurf eine VOLLSTAENDIGE Momentaufnahme
// mit diesen Feldern der obersten Ebene: createdAt, finished, gameFinished,
// gameScores, gameWinner, hasReferee, host, id, leg, legs, player, players,
// round, scores, set, settings, skippedPlayers, state, stats, turnBusted,
// turnScore, turns, type, variant, winner. Kein Delta - playerChange,
// oneEighty usw. werden hier aus dem Vergleich mit dem vorherigen Zustand
// abgeleitet, nicht aus einem Feld (das ist der Kern dieser Datei).
//
// Ebenfalls belegt (siehe websocket.ts, MATCH_ABO_ZWECKE): fuer ein Match
// werden mehrere Themen abonniert, nicht nur .state - laut Fund im
// offiziellen Web-Client (use-game-*.js) laufen einzelne Wurf-Ereignisse
// (game_on/game_shot/turn_start/turn_end/throw/killer_*) ueber
// .game-events, waehrend .state die vollstaendige Momentaufnahme bleibt, aus
// der sich der gesamte Anzeigezustand ableiten laesst. .events wird vom
// echten Client nie benutzt. anwenden() wertet ausschliesslich .state aus;
// alle anderen bekannten Themen (siehe ZWECKE_IGNORIERT) werden bewusst
// unveraendert durchgereicht - kein Verwerfen, keine Warnung je Wurf. Nur
// ein wirklich unerwartetes Ereignis (weder .state-Form noch ein bekanntes
// anderes Thema) wird einmalig protokolliert.
//
// Was in players/turns/gameScores/stats/settings tatsaechlich steckt, ist
// durch keinen echten Mitschnitt bestaetigt (siehe adapter-report.md fuer die
// vollstaendige Liste der Annahmen). Jede Annahme ist unten einzeln
// kommentiert und ueber eine kleine, eigene Zugriffsfunktion isoliert, die
// bei unerwarteter Form auf einen Vorgabewert zurueckfaellt statt zu werfen.

import { BOARD_BEGINN_WERTE, MATCH_ABO_ZWECKE } from './websocket'
import { protokollieren } from './diagnose'
import { checkoutWeg, setupWurf } from '../shared/checkout'
import type { LegEntry, MatchEvent, MatchState, Player, PlayerScore, Segment } from '../shared/typen'

export const RUHEZUSTAND: MatchState = {
  phase: 'idle',
  matchId: null,
  variant: 'x01',
  variantName: '',
  startScore: 501,
  players: [],
  scores: [],
  activePlayerId: null,
  currentThrow: [],
  currentThrowTotal: 0,
  bust: false,
  checkout: null,
  checkoutHint: null,
  legHistory: [],
  lastEvent: null,
}

// ---------------------------------------------------------------------
// Generische, defensive Zugriffshilfen - jede einzeln getestet
// (adapter.test.ts). Sie sind der einzige Ort, an dem eine unerwartete Form
// zu einem Vorgabewert statt zu einer Exception fuehrt.
// ---------------------------------------------------------------------

function objekt(wert: unknown): Record<string, unknown> | null {
  return typeof wert === 'object' && wert !== null ? (wert as Record<string, unknown>) : null
}

/**
 * Normalisiert ein durch Index verschluesseltes Feld - Array oder Objekt mit
 * rein numerischen Schluesseln ("0","1",...) - in eine nach Index sortierte
 * Liste. Das belegte Schema nennt players/gameScores/turns/stats als
 * "object", nicht als Array - ob Autodarts sie tatsaechlich als
 * {"0":...,"1":...} oder als Array liefert, ist ungeklaert (kein
 * Mitschnitt mit Werten). Deckt beide Formen ab, damit diese Entscheidung
 * an keiner Aufrufstelle eine Rolle spielt.
 */
export function nachIndex(wert: unknown): unknown[] {
  if (Array.isArray(wert)) return wert
  const o = objekt(wert)
  if (!o) return []
  return Object.keys(o)
    .filter((schluessel) => /^\d+$/.test(schluessel))
    .sort((a, b) => Number(a) - Number(b))
    .map((schluessel) => o[schluessel])
}

// Jeder Schluessel wird hoechstens einmal je Prozesslaufzeit protokolliert -
// sonst waere das Diagnoseprotokoll bei jedem Wurf mit derselben Zeile
// geflutet (ausdrueckliche Vorgabe der Aufgabenstellung). Modulweit statt
// pro anwenden()-Aufruf, damit "einmal" auch tatsaechlich einmal heisst.
const gewarnteSchluessel = new Set<string>()

/** Nur fuer Tests: setzt die "schon gewarnt"-Merkliste zurueck. */
export function diagnoseWarnungenZuruecksetzen(): void {
  gewarnteSchluessel.clear()
}

/** Obergrenze je Sonde, damit das Protokoll lesbar bleibt. */
const SONDE_MAX_ZEICHEN = 2500

/**
 * Schreibt den Inhalt eines Feldes einmalig ins Diagnoseprotokoll, sobald er
 * nicht mehr leer ist. Gedacht fuer die Felder, deren innere Form kein
 * Mitschnitt belegt - eine Feldnamenliste allein reicht dort nicht, weil die
 * Namen erst eine Ebene tiefer stehen.
 */
function feldSonde(name: string, wert: unknown): void {
  if (wert === null || wert === undefined) return
  if (typeof wert === 'object' && Object.keys(wert as object).length === 0) return
  try {
    const text = JSON.stringify(wert)
    if (text === undefined || text === '{}' || text === '[]') return
    einmaligProtokollieren(`sonde-${name}`, `Feld "${name}" enthaelt: ${text.slice(0, SONDE_MAX_ZEICHEN)}`)
  } catch {
    // Ein nicht serialisierbares Feld ist kein Grund, den Adapter zu stoeren.
  }
}

function einmaligProtokollieren(schluessel: string, meldung: string): void {
  if (gewarnteSchluessel.has(schluessel)) return
  gewarnteSchluessel.add(schluessel)
  void protokollieren(`Adapter: ${meldung}`)
}

/**
 * Zahl direkt, oder aus dem ersten passenden Feld eines Objekts. `wert`
 * selbst als Zahl (z.B. gameScores["0"] === 501) deckt die wahrscheinlichere
 * Form ab, ein Objekt mit Kandidatenfeld die Alternative. Protokolliert
 * einmalig, wenn ein Objekt vorliegt, aber keines der Kandidatenfelder passt
 * - das sind genau die Feldnamen, die ein echter Mitschnitt noch bestaetigen
 * muss.
 */
export function ersteZahl(wert: unknown, felder: readonly string[], schluessel: string): number | null {
  if (typeof wert === 'number' && Number.isFinite(wert)) return wert
  const o = objekt(wert)
  if (!o) return null
  for (const feld of felder) {
    const kandidat = o[feld]
    if (typeof kandidat === 'number' && Number.isFinite(kandidat)) return kandidat
  }
  // Leerer Schluessel heisst: das Feld fehlt bekanntermassen haeufig, ohne
  // dass etwas kaputt ist (bullDistance gibt es nur bei der
  // Anfangsermittlung). Solche Faelle nicht protokollieren - sonst gehen die
  // echten Ueberraschungen im Rauschen unter.
  if (schluessel !== '') {
    einmaligProtokollieren(
      schluessel,
      `${schluessel}: keines der erwarteten Felder [${felder.join(', ')}] gefunden, vorhandene Felder: [${Object.keys(o).join(', ')}] - Vorgabewert verwendet.`,
    )
  }
  return null
}

/** Text direkt, oder aus dem ersten passenden Feld eines Objekts. Siehe ersteZahl. */
export function ersterText(wert: unknown, felder: readonly string[], schluessel: string): string | null {
  if (typeof wert === 'string' && wert.length > 0) return wert
  const o = objekt(wert)
  if (!o) return null
  for (const feld of felder) {
    const kandidat = o[feld]
    if (typeof kandidat === 'string' && kandidat.length > 0) return kandidat
  }
  if (schluessel !== '') {
    einmaligProtokollieren(
      schluessel,
      `${schluessel}: keines der erwarteten Felder [${felder.join(', ')}] gefunden, vorhandene Felder: [${Object.keys(o).join(', ')}] - Vorgabewert verwendet.`,
    )
  }
  return null
}

/**
 * Leitet Punktwert und Multiplikator aus einem Feldnamen wie "T20"/"D16"/
 * "25"/"BULL" ab - dieselbe Regel wie segmentAusName() in
 * src/renderer/spectator/vorfuehrung.ts (dort nicht importiert, weil
 * src/autodarts/ nicht von src/renderer/ abhaengen soll - siehe
 * Projektgrenzen in der Aufgabenstellung).
 */
export function segmentAusName(name: string): Segment {
  if (name === 'BULL' || name === 'DB') return { name, value: 25, multiplier: 2 }
  if (name === 'SB') return { name, value: 25, multiplier: 1 }
  const multiplikator: 1 | 2 | 3 = name.startsWith('T') ? 3 : name.startsWith('D') ? 2 : 1
  // Fuehrenden Buchstaben immer abschneiden, auch bei einfachen Feldern:
  // schreibt der Server "S20" statt "20", ergaebe Number('S20') sonst NaN und
  // damit den Wert 0 - ein Dart, der auf keinem Feld liegt.
  const zifferText = /^[SDT]/.test(name) ? name.slice(1) : name
  const zahl = Number(zifferText)
  return { name, value: Number.isFinite(zahl) ? zahl : 0, multiplier: multiplikator }
}

/**
 * Faktor je "bed" - die Ringbezeichnung, die Autodarts in einem Segment
 * mitschickt. Werte belegt aus dem Quelltext des offiziellen Web-Clients
 * (use-game-*.js, boardSegmentKey/highlightForSegment).
 */
const FAKTOR_JE_BED: Record<string, 1 | 2 | 3> = {
  Single: 1,
  SingleInner: 1,
  SingleOuter: 1,
  Double: 2,
  Triple: 3,
}

/** Name eines Feldes in der Schreibweise, die dieses Projekt durchgehend benutzt. */
function feldName(zahl: number, faktor: 1 | 2 | 3): string {
  if (zahl === 25) return faktor === 2 ? 'BULL' : '25'
  if (faktor === 3) return `T${zahl}`
  if (faktor === 2) return `D${zahl}`
  return String(zahl)
}

/** Auftreffpunkt aus einem Wurf, wenn er einen hat. */
function koordinatenAus(wurf: Record<string, unknown>): { x: number; y: number } | undefined {
  const c = objekt(wurf.coords)
  if (!c) return undefined
  const x = typeof c.x === 'number' ? c.x : null
  const y = typeof c.y === 'number' ? c.y : null
  if (x === null || y === null || !Number.isFinite(x) || !Number.isFinite(y)) return undefined
  return { x, y }
}

/**
 * Ein Segment aus einem einzelnen Wurf. Vorrang hat die Form, die Autodarts
 * tatsaechlich schickt - `segment: { number, bed }` -, weil sie eindeutig ist;
 * nur wenn die fehlt, wird auf einen Namen wie "T20" zurueckgegriffen.
 *
 * `bed: "Outside"` ist ein Wurf neben die Scheibe: er zaehlt null und
 * bekommt keinen Auftreffpunkt auf dem Feldraster, wohl aber seine
 * gemessenen Koordinaten - dort liegt er tatsaechlich.
 */
export function segmentAusWurf(eintrag: unknown, schluessel: string): Segment | null {
  const wurf = objekt(eintrag)
  if (!wurf) return null

  const seg = objekt(wurf.segment)
  const koordinaten = koordinatenAus(wurf)

  if (seg) {
    const bed = typeof seg.bed === 'string' ? seg.bed : null
    const zahl = typeof seg.number === 'number' ? seg.number : null
    if (bed !== null && zahl !== null) {
      const faktor = FAKTOR_JE_BED[bed] ?? 1
      const ausserhalb = bed === 'Outside' || zahl === 0
      return {
        name: ausserhalb ? 'Miss' : feldName(zahl, faktor),
        value: ausserhalb ? 0 : zahl,
        multiplier: faktor,
        ...(koordinaten ? { koordinaten } : {}),
      }
    }
    // Kein bed/number, aber vielleicht ein Name im Segment selbst.
    const name = ersterText(seg, ['name'], schluessel === '' ? '' : `${schluessel}-segment`)
    if (name !== null) return { ...segmentAusName(name), ...(koordinaten ? { koordinaten } : {}) }
  }

  const name = ersterText(wurf, ['name', 'segment', 'field'], schluessel)
  return name === null ? null : { ...segmentAusName(name), ...(koordinaten ? { koordinaten } : {}) }
}

/**
 * Die Darts des laufenden Zuges.
 *
 * `turns` ist eine FLACHE Liste der Zuege dieses Legs - der laufende Zug ist
 * der letzte Eintrag, nicht der mit dem Index des Spielers. Belegt aus dem
 * Quelltext des offiziellen Web-Clients: dort steht woertlich
 * `t.turns[t.turns.length-1]`. Bis 0.1.0-beta.8 wurde nach Spielerindex
 * gegriffen; deshalb blieb die Liste leer, auf der Scheibe erschien kein
 * Pfeil, und die Wurfleiste blieb unbeschriftet.
 */
export function dartsAusZug(turns: unknown, schluessel: string): Segment[] {
  const zuege = nachIndex(turns)
  if (zuege.length === 0) return []

  const wuerfeVon = (zug: unknown): Segment[] => {
    const o = objekt(zug)
    if (!o) return []
    return nachIndex(o.throws)
      .slice(0, 3)
      .map((eintrag, i) => segmentAusWurf(eintrag, `${schluessel}-wurf-${i}`))
      .filter((s): s is Segment => s !== null)
  }

  // Der laufende Zug ist der letzte Eintrag. Sobald eine Aufnahme fertig ist,
  // haengt Autodarts den naechsten, noch leeren Zug an - dann waere die
  // Scheibe schlagartig leer, obwohl die drei Darts noch stecken. In dem Fall
  // gilt der Zug davor: es ist derselbe, den auch die Wurfleiste zeigt.
  const letzte = wuerfeVon(zuege[zuege.length - 1])
  if (letzte.length > 0) return letzte
  return zuege.length >= 2 ? wuerfeVon(zuege[zuege.length - 2]) : []
}

// ---------------------------------------------------------------------
// Themen-Einordnung: .state ist die einzige Quelle, aus der anwenden()
// einen neuen Zustand ableitet (siehe Dateikopf). Alles andere wird bewusst
// unveraendert durchgereicht.
// ---------------------------------------------------------------------

// Themen ausser .state, die fuer ein Match oder ein Board bekanntermassen
// ankommen koennen (siehe websocket.ts, MATCH_ABO_ZWECKE, plus "matches" fuer
// den Board-Kanal-Heartbeat) - keine Warnung, einfach ignorieren. Aus
// MATCH_ABO_ZWECKE abgeleitet statt eigens gepflegt, damit beide Listen nicht
// auseinanderlaufen koennen.
const ZWECKE_IGNORIERT = new Set<string>([...MATCH_ABO_ZWECKE.filter((z) => z !== 'state'), 'matches'])

function istMatchZustandsForm(o: Record<string, unknown>): boolean {
  // Die drei Felder, die laut belegtem Schema immer vorhanden und immer
  // Zeichenketten sind - zusammen ein robustes Erkennungsmerkmal fuer "das
  // ist eine .state-Momentaufnahme", ohne selbst geraten zu sein.
  return typeof o.id === 'string' && typeof o.variant === 'string' && typeof o.type === 'string'
}

// Drei eigene Varianten statt art: 'ignoriert' | 'unbekannt' in einer - nur
// so kann TypeScript den 'state'-Fall unten sauber auf `nutz` verengen.
type Einordnung =
  | { art: 'state'; nutz: Record<string, unknown> }
  | { art: 'board'; nutz: Record<string, unknown> }
  | { art: 'ignoriert' }
  | { art: 'unbekannt' }

/**
 * Ordnet ein Rohereignis einem von drei Faellen zu:
 * - 'state': eine .state-Momentaufnahme, entpackt aus einem etwaigen
 *   {channel,topic,data}-Umschlag (Websocket-Nachricht) oder direkt, falls
 *   keiner vorliegt (die REST-Antwort von matchZustandNeuLaden() in
 *   websocket.ts kommt ohne Umschlag).
 * - 'ignoriert': ein bekanntes, fuer den Adapter (noch) nicht ausgewertetes
 *   Thema (Board-Heartbeat, .game-events, .events, .corrections, .referee,
 *   .challenge) - anwenden() laesst den Zustand unangetastet, ohne das zu
 *   protokollieren.
 * - 'unbekannt': weder noch - wird einmalig protokolliert.
 */
function einordnen(roh: unknown): Einordnung {
  const o = objekt(roh)
  if (!o) return { art: 'unbekannt' }

  const topic = typeof o.topic === 'string' ? o.topic : null
  if (topic) {
    const zweck = topic.slice(topic.lastIndexOf('.') + 1)
    if (zweck === 'matches') {
      // Der Board-Kanal meldet Beginn UND Ende eines Matches. Bis 0.1.0-beta.5
      // wurde er nur zum Abonnieren benutzt und danach verworfen - deshalb
      // blieb der Endstand stehen, wenn das Match auf der Scheibe mit "Exit"
      // beendet wurde: der Zustandskanal verstummt einfach, ohne ein letztes
      // "finished".
      return { art: 'board', nutz: objekt(o.data) ?? o }
    }
    if (zweck !== 'state') {
      return { art: ZWECKE_IGNORIERT.has(zweck) ? 'ignoriert' : 'unbekannt' }
    }
    const nutz = objekt(o.data) ?? o
    return istMatchZustandsForm(nutz) ? { art: 'state', nutz } : { art: 'unbekannt' }
  }

  return istMatchZustandsForm(o) ? { art: 'state', nutz: o } : { art: 'unbekannt' }
}

/**
 * Sagt, ob ein Board-Ereignis das Ende eines Matches meint. Die bekannten
 * Werte stehen in BOARD_BEGINN_WERTE (siehe websocket.ts); der Wortlaut wird
 * beim ersten Mal protokolliert.
 */
export function istMatchEnde(nutz: Record<string, unknown>): boolean {
  const wert = typeof nutz.event === 'string' ? nutz.event.toLowerCase() : null
  if (wert === null) return false
  einmaligProtokollieren(
    `board-ereignis-${wert}`,
    `Board-Ereignis "${wert}" gewertet als ${BOARD_BEGINN_WERTE.has(wert) ? 'Beginn' : 'Ende'} eines Matches.`,
  )
  return !BOARD_BEGINN_WERTE.has(wert)
}

/**
 * Wer gewonnen hat.
 *
 * Autodarts fuehrt dafuer einen Spielerindex (winner fuer das Match,
 * gameWinner fuer das Leg), setzt ihn aber NICHT in jeder Momentaufnahme:
 * solange nichts entschieden ist, steht dort -1, und -1 kann auch noch in der
 * ersten Momentaufnahme mit finished=true stehen. Ein Index von -1 traf
 * effektivePlayers[-1] - also undefined - und fiel auf den gerade aktiven
 * Spieler zurueck. Der ist nach dem entscheidenden Wurf aber schon der
 * naechste: gemeldet wurde "Bot Level 1 hat das Match gewonnen", obwohl der
 * Herausgeber gewonnen hatte.
 *
 * Deshalb drei Stufen: der gemeldete Index, wenn er auf einen Spieler zeigt;
 * sonst der Spieler, dessen Restpunktzahl auf 0 steht (und nur, wenn das
 * genau einer ist); erst zuletzt der aktive Spieler.
 */
function gewinnerId(
  index: unknown,
  nutz: Record<string, unknown>,
  players: readonly Player[],
  activePlayerId: string | null,
): string | null {
  if (typeof index === 'number' && Number.isInteger(index) && index >= 0) {
    const ueberIndex = players[index]?.id
    if (ueberIndex) return ueberIndex
  }

  const punkte = nachIndex(nutz.gameScores)
  const ausgespielt = players.filter((_, i) => ersteZahl(punkte[i], ['remaining', 'score', 'value', 'points'], '') === 0)
  if (ausgespielt.length === 1) return ausgespielt[0]!.id

  return activePlayerId
}

/** Ob zwei Wurflisten denselben Stand meinen (gleiche Laenge, gleiche Felder). */
function gleicheWurfliste(a: readonly Segment[], b: readonly Segment[]): boolean {
  return a.length === b.length && a.every((dart, index) => dart.name === b[index]?.name)
}

function istX01(variant: string): boolean {
  const v = variant.toLowerCase()
  return v === 'x01' || v.includes('x01')
}

// ---------------------------------------------------------------------
// anwenden()
// ---------------------------------------------------------------------

/**
 * Uebersetzt ein rohes Autodarts-Ereignis in den naechsten MatchState. Rein:
 * `zustand` wird nie veraendert, dieselbe Eingabe liefert immer dieselbe
 * Ausgabe (bis auf das Diagnoseprotokoll, siehe einmaligProtokollieren).
 * Wirft nie - eine unerwartete Form fuehrt zu einem Vorgabewert oder zum
 * unveraenderten `zustand`, nie zu einer Exception (Spec Abschnitt 14: ein
 * Anzeigefehler darf ein laufendes Match nie unterbrechen). Ereignisse, die
 * nicht zu einer .state-Momentaufnahme gehoeren, werden unveraendert
 * durchgereicht (siehe einordnen()).
 */
export function anwenden(zustand: MatchState, roh: unknown): MatchState {
  const eingeordnet = einordnen(roh)
  if (eingeordnet.art === 'ignoriert') return zustand
  if (eingeordnet.art === 'board') {
    const beginnId = typeof eingeordnet.nutz.id === 'string' ? eingeordnet.nutz.id : null
    if (!istMatchEnde(eingeordnet.nutz)) {
      // Ein Beginn schaltet die Spielpause sofort ab, statt auf die erste
      // .state-Momentaufnahme zu warten. Die kommt bei einer
      // Anfangsermittlung erst mit dem ersten Dart - bis dahin stand der
      // Zuschauer-Screen noch in der Werbeschleife, obwohl die Runde laengst
      // gestartet war.
      //
      // Nur aus dem Ruhezustand heraus: laeuft schon ein Match, wuerde eine
      // zweite Startmeldung sonst den Spielstand wegwerfen.
      if (zustand.phase !== 'idle') return zustand
      return { ...RUHEZUSTAND, phase: 'starting', matchId: beginnId }
    }
    // Ein Ende-Ereignis gilt nur fuer das Match, das gerade laeuft. Autodarts
    // raeumt aeltere Matches nachtraeglich weg ("delete") - ein solches
    // Ereignis darf die Anzeige eines laufenden Matches nicht abschalten.
    if (beginnId !== null && zustand.matchId !== null && beginnId !== zustand.matchId) return zustand
    return RUHEZUSTAND
  }
  if (eingeordnet.art === 'unbekannt') {
    const o = objekt(roh)
    einmaligProtokollieren(
      'unbekanntes-ereignis',
      `Rohereignis ist weder eine .state-Momentaufnahme noch eines der bekannten, bewusst uebersprungenen Themen (${[...ZWECKE_IGNORIERT].join(', ')}) - Zustand unveraendert. ${o ? `Vorhandene Top-Level-Felder: [${Object.keys(o).join(', ')}]` : `typeof roh: ${typeof roh}`}`,
    )
    return zustand
  }
  const nutz = eingeordnet.nutz

  const matchId = typeof nutz.id === 'string' ? nutz.id : zustand.matchId
  const variantRoh = typeof nutz.variant === 'string' ? nutz.variant : ''
  const variant: MatchState['variant'] = istX01(variantRoh) ? 'x01' : 'other'
  const variantName = variantRoh !== '' ? variantRoh : zustand.variantName
  // Neues Match erkannt: matchId weicht vom vorherigen Zustand ab. Grundlage
  // fuer den Ruecksetz-auf-0-Fall unten (Legs/Sets/legHistory) und fuer die
  // intro-Phase - beides aus dem Vergleich abgeleitet, nicht aus einem
  // eigenen "neues Match"-Feld (das es laut belegtem Schema nicht gibt).
  const istNeuesMatch = matchId !== zustand.matchId

  const startScore =
    variant === 'x01'
      ? (ersteZahl(nutz.settings, ['baseScore', 'startScore', 'score'], 'settings.startScore') ?? 501)
      : zustand.startScore

  // ---- Spieler ----------------------------------------------------
  const spielerRoh = nachIndex(nutz.players)
  const players: Player[] = spielerRoh.map((eintrag, index) => {
    const name = ersterText(eintrag, ['name', 'displayName', 'username', 'cricketName'], `players[${index}].name`) ?? `Spieler ${index + 1}`
    // Kein bestaetigtes id-Feld - Index-basierte Kennung ist eine bewusste
    // Entscheidung (stabil, solange die Spielerreihenfolge sich waehrend
    // eines Matches nicht aendert), kein geratenes Feld, deshalb ohne
    // Warnung. Ein echtes id-Feld hat Vorrang, falls vorhanden.
    const id = ersterText(eintrag, ['id', 'playerId', 'uuid'], `players[${index}].id-unbenutzt`) ?? `p${index}`
    return { id, autodartsName: name, displayName: name }
  })
  // Autodarts liefert vermutlich keine Spielerliste, solange kein Match
  // laeuft - dann die vorherige stehen lassen (ausser bei einem echten
  // Matchwechsel, wo eine leere Liste ohnehin nur ein leeres Match waere).
  const effektivePlayers = players.length > 0 ? players : istNeuesMatch ? [] : zustand.players

  const aktiverIndex = typeof nutz.player === 'number' ? nutz.player : null
  const activePlayerId = aktiverIndex !== null ? (effektivePlayers[aktiverIndex]?.id ?? zustand.activePlayerId) : zustand.activePlayerId

  // ---- Wurf des aktiven Spielers -----------------------------------
  const currentThrowTotal = typeof nutz.turnScore === 'number' ? nutz.turnScore : 0
  const bust = nutz.turnBusted === true
  const currentThrow = dartsAusZug(nutz.turns, 'turns')

  // ---- Leg-/Matchende, Phase ----------------------------------------
  const matchBeendet = nutz.finished === true
  const legBeendet = nutz.gameFinished === true
  // Ein Leg gilt hier als GERADE (in diesem Aufruf) gewonnen, wenn es jetzt
  // beendet ist, es im vorherigen Zustand aber weder beendet noch das Match
  // schon vorbei war - sonst wuerde jede weitere Momentaufnahme waehrend der
  // Leg-Pause (gameFinished bleibt vermutlich true, bis das naechste Leg
  // beginnt) den Sieg-Zaehler erneut erhoehen.
  const legGeradeGewonnen = legBeendet && zustand.phase !== 'legBreak' && zustand.phase !== 'finished'
  const matchGeradeGewonnen = matchBeendet && zustand.phase !== 'finished'

  // Die Anfangsermittlung laeuft bei Autodarts als eigener Modus: das Match
  // traegt dann die Variante "Bull-off" (belegt im Quelltext des Web-Clients,
  // Variant.BullOff). Jeder wirft einen Dart, wer naeher am Bull liegt,
  // beginnt - der Abstand steht je Spieler in stats[i].legStats.bullDistance.
  const istBullOff = variantRoh.toLowerCase().replace(/[^a-z]/g, '') === 'bulloff'

  let phase: MatchState['phase']
  if (istBullOff && !matchBeendet) phase = 'bullOff'
  else if (matchBeendet) phase = 'finished'
  else if (legBeendet) phase = 'legBreak'
  else if (istNeuesMatch) phase = 'intro'
  else phase = 'playing'

  const legGewinnerId = legGeradeGewonnen ? gewinnerId(nutz.gameWinner, nutz, effektivePlayers, activePlayerId) : null
  const matchGewinnerId = matchGeradeGewonnen ? gewinnerId(nutz.winner, nutz, effektivePlayers, activePlayerId) : null

  // Gezielte Sonden fuer die drei Felder, deren innere Form bis heute
  // unbelegt ist. Je einmal pro Programmlauf, und erst wenn tatsaechlich
  // etwas drinsteht - am Anfang eines Matches sind sie leer und sagen
  // nichts. Ohne diese Zeilen bleibt die Wurfliste (turns) Ratesache, und
  // die Anfangsermittlung per Bull-off (state) laesst sich nicht bauen.
  feldSonde('turns', nutz.turns)
  feldSonde('stats', nutz.stats)
  feldSonde('state', nutz.state)

  // ---- Abgeschlossene Aufnahme ---------------------------------------
  //
  // Woran erkennt man, dass eine Aufnahme fertig ist? Bis 0.1.0-beta.7 an der
  // Zahl der Darts in der Wurfliste - und genau daran ist es gescheitert:
  // laesst sich turns[] nicht lesen (die Feldform ist unbestaetigt, siehe
  // dartsAusTurns), bleibt die Liste leer, keine Aufnahme gilt je als fertig,
  // und Average, 180er und Leg-Verlauf bleiben dauerhaft auf 0. Gemeldet:
  // "ich hatte 2 180er und er hat 0 gezeigt".
  //
  // Der verlaessliche Weg braucht die Wurfliste gar nicht: eine Aufnahme ist
  // vorbei, wenn der naechste Spieler an der Reihe ist. Dann traegt der
  // VORHERIGE Zustand die Endpunktzahl dieser Aufnahme (turnScore), und der
  // vorherige aktive Spieler ist derjenige, dem sie gehoert. Beide Felder -
  // player und turnScore - sind aus einem echten Protokoll belegt.
  // Der zweite Fall ist das Ende eines Legs oder Matches: dort wechselt
  // niemand mehr, die letzte Aufnahme steht im AKTUELLEN Ereignis.
  const spielerWechsel = activePlayerId !== null && zustand.activePlayerId !== null && activePlayerId !== zustand.activePlayerId

  type Abschluss = { playerId: string; punkte: number; darts: number; bust: boolean }
  let abschluss: Abschluss | null = null
  if (spielerWechsel && zustand.activePlayerId) {
    abschluss = {
      playerId: zustand.activePlayerId,
      punkte: zustand.bust ? 0 : zustand.currentThrowTotal,
      darts: zustand.currentThrow.length > 0 ? zustand.currentThrow.length : 3,
      bust: zustand.bust,
    }
  } else if ((legGeradeGewonnen || matchGeradeGewonnen) && activePlayerId) {
    abschluss = {
      playerId: legGewinnerId ?? matchGewinnerId ?? activePlayerId,
      punkte: bust ? 0 : currentThrowTotal,
      darts: currentThrow.length > 0 ? currentThrow.length : 3,
      bust,
    }
  }

  if (abschluss && currentThrow.length === 0 && zustand.currentThrow.length === 0) {
    einmaligProtokollieren(
      'darts-je-zug-geschaetzt',
      'Wurfliste leer, fuer die Statistik wird mit drei Darts je Aufnahme gerechnet.',
    )
  }

  // ---- Punktestand je Spieler -----------------------------------------
  const gameScoresRoh = nachIndex(nutz.gameScores)
  const statsRoh = nachIndex(nutz.stats)
  // Der Server fuehrt Legs und Saetze selbst mit (top-level "scores", nicht zu
  // verwechseln mit "gameScores", das den Restpunktestand traegt). Diese Zahl
  // hat Vorrang vor jeder eigenen Ableitung: eine selbst gezaehlte Zahl kann
  // doppelt zaehlen, wenn dieselbe Momentaufnahme zweimal ankommt (Wieder-
  // verbindung, erneutes Abonnement) - genau das war zu sehen, als nach einem
  // gewonnenen Leg 0:2 statt 0:1 stand.
  const punkteRoh = nachIndex(nutz.scores)

  const scores: PlayerScore[] = effektivePlayers.map((spieler, index) => {
    // Bei einem neuen Match zaehlt kein vorheriger Wert - sonst wuerden
    // Legs/Sets/Statistiken des VORHERIGEN Matches in das neue hinueber-
    // gerettet, nur weil zufaellig derselbe Index (p0/p1) wiederverwendet wird.
    const vorheriger = istNeuesMatch ? undefined : zustand.scores.find((s) => s.playerId === spieler.id)

    const restRoh = ersteZahl(gameScoresRoh[index], ['remaining', 'score', 'value', 'points'], `gameScores[${index}]`)
    const remaining = restRoh === null ? (vorheriger?.remaining ?? startScore) : Math.max(0, restRoh)

    // Zuerst die Zahl des Servers, erst danach die eigene Ableitung. Fehlt
    // das Feld, meldet ersteZahl das einmalig im Diagnoseprotokoll - dann ist
    // im Protokoll nachlesbar, warum wieder gezaehlt wird, statt dass es
    // unbemerkt bleibt.
    const legsRoh = ersteZahl(punkteRoh[index], ['legs', 'legsWon', 'legCount'], `scores[${index}].legs`)
    const legsBisher = vorheriger?.legs ?? 0
    const legs = legsRoh ?? (legGewinnerId === spieler.id ? legsBisher + 1 : legsBisher)

    // Saetze: gleiche Reihenfolge, gleiche Quelle. Fuer sie gibt es keine
    // eigene Ableitung - es gibt kein erkanntes Signal fuer das Ende eines
    // Satzes -, deshalb bleibt ohne Serverzahl der letzte bekannte Stand.
    const setsRoh = ersteZahl(punkteRoh[index], ['sets', 'setsWon', 'setCount'], `scores[${index}].sets`)
    const sets = setsRoh ?? vorheriger?.sets ?? 0

    // Die Statistik kommt vom Server, wenn er sie liefert - und er tut es:
    // stats[i] traegt legStats und matchStats, jeweils mit average,
    // dartsThrown und (waehrend der Anfangsermittlung) bullDistance. Belegt
    // im Quelltext des Autodarts-Web-Clients ("f.legStats.average",
    // "f.matchStats.average"). Bis 0.1.0-beta.9 wurde eine Ebene zu flach
    // gesucht (stats[i].average) - deshalb griff immer die eigene Rechnung,
    // und die hinkte der Anzeige von Autodarts eine Aufnahme hinterher.
    //
    // Die eigene Rechnung bleibt als Rueckfall: sie ist besser als eine
    // leere Anzeige, wenn der Server einmal nichts schickt.
    const statsEintrag = statsRoh[index]
    const legStats = objekt(objekt(statsEintrag)?.legStats)
    const matchStats = objekt(objekt(statsEintrag)?.matchStats)

    const legAverage = ersteZahl(legStats, ['average'], `stats[${index}].legStats.average`)
    const legDarts = ersteZahl(legStats, ['dartsThrown'], `stats[${index}].legStats.dartsThrown`)
    // Beides gibt es nur waehrend der Anfangsermittlung; im laufenden X01
    // fehlt es planmaessig. Deshalb ohne Protokolleintrag nachfragen.
    const bullAbstand = ersteZahl(legStats, ['bullDistance'], '')
    const bullWurf = legStats ? (segmentAusWurf(legStats, '') ?? undefined) : undefined
    // Umgekehrte Sonde: taucht bullDistance auf, laeuft gerade eine
    // Anfangsermittlung. Einmal je Lauf protokolliert, samt Variante und
    // dem, was die Phasenerkennung daraus gemacht hat. Damit steht im
    // Protokoll, ob Autodarts die Anfangsermittlung als eigene Variante
    // "Bull-off" fuehrt oder innerhalb des laufenden X01 - davon haengt ab,
    // woran die Anzeige sie erkennen muss. Bisher lag dazu kein einziger
    // echter Mitschnitt vor.
    if (bullAbstand !== null) {
      einmaligProtokollieren(
        'bulldistance-gefunden',
        `stats[].legStats.bullDistance vorhanden (Variante "${variantRoh}") - Anfangsermittlung laeuft, Phasenerkennung greift ${istBullOff ? 'bereits' : 'NICHT'}.`,
      )
    }
    // Gezaehlt wird genau die eine Aufnahme, die mit diesem Ereignis fertig
    // geworden ist - und die gehoert nicht zwangslaeufig dem Spieler, der
    // JETZT am Wurf ist (siehe Abschluss oben).
    const zaehlt = abschluss?.playerId === spieler.id
    const punkteDesZugs = abschluss?.punkte ?? 0

    const dartsGesamt = (vorheriger?.dartsGesamt ?? 0) + (zaehlt ? (abschluss?.darts ?? 0) : 0)
    const punkteGesamt = (vorheriger?.punkteGesamt ?? 0) + (zaehlt ? punkteDesZugs : 0)

    const average3 =
      ersteZahl(matchStats, ['average'], `stats[${index}].matchStats.average`) ??
      (dartsGesamt > 0 ? (punkteGesamt / dartsGesamt) * 3 : null)

    // Ein Finishversuch: die Aufnahme BEGANN mit einem Rest, der sich mit drei
    // Darts ausmachen laesst. 170 ist der hoechste solche Rest, unter 2 ist
    // keiner mehr moeglich.
    //
    // Der Rest vor der Aufnahme laesst sich nicht aus der vorherigen
    // Momentaufnahme lesen - die enthaelt die Darts dieser Aufnahme schon.
    // Er ergibt sich aus dem Rest DANACH plus den erzielten Punkten. Ohne
    // diese Rechnung wurde eine Aufnahme, die von 501 auf 40 fuehrte,
    // faelschlich als Finishversuch gezaehlt.
    const restVorZug = remaining + punkteDesZugs
    const versuch = zaehlt && restVorZug >= 2 && restVorZug <= 170
    // matchStats fuehrt beides: `checkouts` sind die Finishversuche,
    // `checkoutsHit` die getroffenen (daneben steht `checkoutPercent`, die
    // Quote aus beiden). Beide Namen stammen aus einem echten Protokoll vom
    // 10.09.2026, nicht aus einer Vermutung. Bis 0.1.0-beta.11 wurde
    // `checkouts` faelschlich als Treffer gelesen und die Versuche selbst
    // gezaehlt - die Quote war damit doppelt falsch.
    const checkoutAttempts =
      ersteZahl(matchStats, ['checkouts'], `stats[${index}].matchStats.checkouts`) ??
      (vorheriger?.checkoutAttempts ?? 0) + (versuch ? 1 : 0)
    const checkoutHits =
      ersteZahl(matchStats, ['checkoutsHit'], `stats[${index}].matchStats.checkoutsHit`) ??
      (vorheriger?.checkoutHits ?? 0) + (zaehlt && remaining === 0 ? 1 : 0)
    const count180 =
      ersteZahl(matchStats, ['total180'], `stats[${index}].matchStats.total180`) ??
      (vorheriger?.count180 ?? 0) + (zaehlt && punkteDesZugs === 180 ? 1 : 0)

    const finishJetzt = zaehlt && remaining === 0 ? punkteDesZugs : 0
    // Das hoechste Finish fuehrt matchStats NICHT (die Felder sind: average,
    // averageUntil170, checkoutPercent, checkoutPoints, checkoutPointsAverage,
    // checkouts, checkoutsHit, dartsThrown, dartsUntil170, first9Average,
    // first9Score, less60, plus60/100/140/170, score, scoreUntil170,
    // total180). Es bleibt deshalb selbst gezaehlt.
    const highestFinish =
      finishJetzt > (vorheriger?.highestFinish ?? 0) ? finishJetzt : (vorheriger?.highestFinish ?? null)

    return {
      playerId: spieler.id,
      remaining,
      legs,
      sets,
      average3,
      checkoutAttempts,
      checkoutHits,
      count180,
      highestFinish,
      dartsGesamt: ersteZahl(matchStats, ['dartsThrown'], `stats[${index}].matchStats.dartsThrown`) ?? dartsGesamt,
      // Diese fuenf fuehrt nur der Server - ohne ihn bleiben sie leer, statt
      // aus dem eigenen Verlauf geschaetzt zu werden. Ein geschaetzter
      // First-9-Average waere schlechter als gar keiner.
      first9Average: ersteZahl(matchStats, ['first9Average'], ''),
      plus60: ersteZahl(matchStats, ['plus60'], '') ?? 0,
      plus100: ersteZahl(matchStats, ['plus100'], '') ?? 0,
      plus140: ersteZahl(matchStats, ['plus140'], '') ?? 0,
      checkoutProzent: ersteZahl(matchStats, ['checkoutPercent'], ''),
      punkteGesamt,
      legAverage,
      legDarts,
      bullAbstand,
      ...(bullWurf ? { bullWurf } : {}),
    }
  })

  const restAktiv = scores.find((s) => s.playerId === activePlayerId)?.remaining ?? startScore

  // ---- Leg-Verlauf ------------------------------------------------
  // Neuer Eintrag nur, wenn der Zug abgeschlossen ist (3 Darts, Bust, oder
  // dieser Wurf beendet Leg/Match - auch mit weniger als 3 Darts moeglich).
  // Ohne diese Bedingung wuerde ein Ereignis-je-Dart-Betrieb (siehe
  // Dateikopf, .game-events feuert einzeln) denselben Zug mehrfach als
  // separate Eintraege fuehren.
  const legGeradeVorbei = zustand.phase === 'legBreak' || zustand.phase === 'finished'
  const legHistoryBasis = istNeuesMatch || legGeradeVorbei ? [] : zustand.legHistory
  const legHistory: LegEntry[] = abschluss
    ? [
        ...legHistoryBasis,
        {
          playerId: abschluss.playerId,
          // Die Darts der abgeschlossenen Aufnahme: beim Spielerwechsel
          // stehen sie im vorherigen Zustand, beim Leg-Ende im aktuellen.
          darts: spielerWechsel ? zustand.currentThrow : currentThrow,
          scored: abschluss.punkte,
          remainingAfter:
            scores.find((s) => s.playerId === abschluss.playerId)?.remaining ?? restAktiv,
          bust: abschluss.bust,
        },
      ]
    : legHistoryBasis

  // ---- Ereignis -----------------------------------------------------
  // seq zaehlt einen Zaehler IM ZUSTAND hoch, nicht das Rohereignis (siehe
  // Aufgabenstellung) - jeder anwenden()-Aufruf mit einer .state-
  // Momentaufnahme erhoeht ihn um genau 1.
  const seq = (zustand.lastEvent?.seq ?? 0) + 1

  // Ein Dart ausserhalb der Scheibe. Ausgeloest wird nur, wenn sich die
  // Wurfliste seit der letzten Momentaufnahme tatsaechlich geaendert hat -
  // Autodarts schickt zu einem Wurf mehrere Momentaufnahmen kurz
  // hintereinander, und ohne diesen Vergleich liefe die Einblendung mehrfach
  // fuer denselben Dart. Der Vergleich ueber die Namen statt ueber die
  // Laenge allein: der erste Dart einer neuen Aufnahme verkuerzt die Liste
  // (3 -> 1), waere also ueber die Laenge nicht als neu zu erkennen.
  const letzterDart = currentThrow[currentThrow.length - 1]
  const neuerDart = !gleicheWurfliste(currentThrow, zustand.currentThrow)
  const missGeworfen = letzterDart?.value === 0 && neuerDart
  const bullseyeGeworfen = letzterDart?.value === 25 && letzterDart.multiplier === 2 && neuerDart

  let ereignis: MatchEvent
  if (matchGeradeGewonnen) {
    ereignis = { seq, kind: 'matchWon', playerId: matchGewinnerId ?? activePlayerId ?? '' }
  } else if (legGeradeGewonnen) {
    // "highFinish" statt "legWon", wenn der Finish-Wurf mindestens 100 Punkte
    // war (Aufgabenstellung: "ein gewonnenes Leg mit einem Rest ab 100
    // zusaetzlich highFinish") - MatchEvent traegt nur eine Art gleichzeitig,
    // highFinish ist hier die spezifischere und geht vor.
    ereignis =
      currentThrowTotal >= 100 && !bust
        ? { seq, kind: 'highFinish', playerId: legGewinnerId ?? activePlayerId ?? '', score: currentThrowTotal }
        : { seq, kind: 'legWon', playerId: legGewinnerId ?? activePlayerId ?? '' }
  } else if (currentThrowTotal === 180 && !bust) {
    ereignis = { seq, kind: 'oneEighty', playerId: activePlayerId ?? '' }
  } else if (bullseyeGeworfen) {
    ereignis = { seq, kind: 'bullseye', playerId: activePlayerId ?? '' }
  } else if (missGeworfen) {
    ereignis = { seq, kind: 'miss', playerId: activePlayerId ?? '' }
  } else if (spielerWechsel) {
    ereignis = { seq, kind: 'playerChange', toPlayerId: activePlayerId as string }
  } else {
    ereignis = { seq, kind: 'throw' }
  }

  // ---- Checkout / Checkout-Hinweis - selbst berechnet, nicht aus der API ----
  let checkout: string[] | null = null
  let checkoutHint: string | null = null
  if (variant === 'x01' && restAktiv > 0) {
    const dartsUebrig = Math.max(1, Math.min(3, 3 - currentThrow.length)) as 1 | 2 | 3
    const weg = checkoutWeg(restAktiv, dartsUebrig)
    if (weg) checkout = weg
    else checkoutHint = setupWurf(restAktiv)
  }

  return {
    phase,
    matchId,
    variant,
    variantName,
    startScore,
    players: effektivePlayers,
    scores,
    activePlayerId,
    currentThrow,
    currentThrowTotal,
    bust,
    checkout,
    checkoutHint,
    legHistory,
    lastEvent: ereignis,
  }
}
