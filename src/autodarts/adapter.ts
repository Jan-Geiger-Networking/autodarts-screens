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

import { MATCH_ABO_ZWECKE } from './websocket'
import { protokollieren } from './diagnose'
import { checkoutWeg, setupWurf } from '../shared/checkout'
import type { LegEntry, MatchEvent, MatchState, Player, PlayerScore, Segment } from '../shared/typen'

export const RUHEZUSTAND: MatchState = {
  phase: 'idle',
  matchId: null,
  variant: 'x01',
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
  einmaligProtokollieren(
    schluessel,
    `${schluessel}: keines der erwarteten Felder [${felder.join(', ')}] gefunden, vorhandene Felder: [${Object.keys(o).join(', ')}] - Vorgabewert verwendet.`,
  )
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
  einmaligProtokollieren(
    schluessel,
    `${schluessel}: keines der erwarteten Felder [${felder.join(', ')}] gefunden, vorhandene Felder: [${Object.keys(o).join(', ')}] - Vorgabewert verwendet.`,
  )
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
  if (name === 'BULL') return { name, value: 25, multiplier: 2 }
  const multiplikator: 1 | 2 | 3 = name.startsWith('T') ? 3 : name.startsWith('D') ? 2 : 1
  const zifferText = multiplikator === 1 ? name : name.slice(1)
  const zahl = Number(zifferText)
  return { name, value: Number.isFinite(zahl) ? zahl : 0, multiplier: multiplikator }
}

function segmentAusEintrag(eintrag: unknown, schluessel: string): Segment | null {
  const name = ersterText(eintrag, ['name', 'segment', 'field'], schluessel)
  return name === null ? null : segmentAusName(name)
}

/**
 * Darts des aktuellen Zugs eines Spielers aus `turns[spielerIndex]` - Form
 * unbestaetigt (kein Mitschnitt mit Werten), zwei plausible Varianten
 * gegeneinander abgewogen: entweder ist der Wert direkt die Liste der in
 * diesem Zug bisher geworfenen Darts, oder eine Liste vergangener Zuege,
 * deren letztes Element wiederum diese Liste ist. Deckt beide ab, indem
 * geprueft wird, ob das letzte Element selbst ein Array ist. Liefert []
 * statt zu raten, wenn keine der beiden Formen passt - lieber ein leerer
 * Wurf-Anzeigebereich als erfundene Dartnamen.
 */
export function dartsAusTurns(turnsFuerSpieler: unknown, schluessel: string): Segment[] {
  if (!Array.isArray(turnsFuerSpieler) || turnsFuerSpieler.length === 0) return []
  const letztes = turnsFuerSpieler[turnsFuerSpieler.length - 1]
  const wurf = Array.isArray(letztes) ? letztes : turnsFuerSpieler
  return wurf
    .slice(0, 3)
    .map((eintrag, i) => segmentAusEintrag(eintrag, `${schluessel}-dart-${i}`))
    .filter((s): s is Segment => s !== null)
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
type Einordnung = { art: 'state'; nutz: Record<string, unknown> } | { art: 'ignoriert' } | { art: 'unbekannt' }

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
    if (zweck !== 'state') {
      return { art: ZWECKE_IGNORIERT.has(zweck) ? 'ignoriert' : 'unbekannt' }
    }
    const nutz = objekt(o.data) ?? o
    return istMatchZustandsForm(nutz) ? { art: 'state', nutz } : { art: 'unbekannt' }
  }

  return istMatchZustandsForm(o) ? { art: 'state', nutz: o } : { art: 'unbekannt' }
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
  const turnsRoh = nachIndex(nutz.turns)
  const currentThrow = aktiverIndex !== null ? dartsAusTurns(turnsRoh[aktiverIndex], `turns[${aktiverIndex}]`) : []

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

  let phase: MatchState['phase']
  if (matchBeendet) phase = 'finished'
  else if (legBeendet) phase = 'legBreak'
  else if (istNeuesMatch) phase = 'intro'
  else phase = 'playing'

  const legGewinnerId = legGeradeGewonnen
    ? ((typeof nutz.gameWinner === 'number' ? effektivePlayers[nutz.gameWinner]?.id : undefined) ?? activePlayerId)
    : null
  const matchGewinnerId = matchGeradeGewonnen
    ? ((typeof nutz.winner === 'number' ? effektivePlayers[nutz.winner]?.id : undefined) ?? activePlayerId)
    : null

  // ---- Punktestand je Spieler -----------------------------------------
  const gameScoresRoh = nachIndex(nutz.gameScores)
  const statsRoh = nachIndex(nutz.stats)

  const scores: PlayerScore[] = effektivePlayers.map((spieler, index) => {
    // Bei einem neuen Match zaehlt kein vorheriger Wert - sonst wuerden
    // Legs/Sets/Statistiken des VORHERIGEN Matches in das neue hinueber-
    // gerettet, nur weil zufaellig derselbe Index (p0/p1) wiederverwendet wird.
    const vorheriger = istNeuesMatch ? undefined : zustand.scores.find((s) => s.playerId === spieler.id)

    const restRoh = ersteZahl(gameScoresRoh[index], ['remaining', 'score', 'value', 'points'], `gameScores[${index}]`)
    const remaining = restRoh === null ? (vorheriger?.remaining ?? startScore) : Math.max(0, restRoh)

    // Legs werden NICHT aus einem geratenen Feld gelesen, sondern aus dem
    // Vergleich mit dem vorherigen Zustand hochgezaehlt (siehe legGewinnerId
    // oben) - dadurch zwangslaeufig monoton und ohne Annahme ueber einen
    // Feldnamen, den kein Mitschnitt bestaetigt.
    const legsBisher = vorheriger?.legs ?? 0
    const legs = legGewinnerId === spieler.id ? legsBisher + 1 : legsBisher

    // Sets: anders als Legs gibt es kein top-level Feld, aus dessen
    // Aenderung sich ein "Set gerade gewonnen" ableiten liesse (nur
    // finished/gameFinished, keine eigene Set-Ende-Kennung) - bleibt darum
    // ein geratener Feldzugriff, der bei den meisten Matches (ein einzelnes
    // Set, siehe "Best of 11" im Beispiel) ohnehin bei 0 bleibt.
    const setsRoh = ersteZahl(spielerRoh[index], ['setsWon', 'sets', 'setCount'], `players[${index}].setsWon`)
    const sets = setsRoh ?? vorheriger?.sets ?? 0

    const statsEintrag = statsRoh[index]
    const average3 = ersteZahl(statsEintrag, ['average', 'avg', 'threeDartAverage', 'average3'], `stats[${index}].average`) ?? vorheriger?.average3 ?? null
    const checkoutAttempts =
      ersteZahl(statsEintrag, ['checkoutAttempts', 'coAttempts'], `stats[${index}].checkoutAttempts`) ?? vorheriger?.checkoutAttempts ?? 0
    const checkoutHits = ersteZahl(statsEintrag, ['checkoutHits', 'coHits', 'checkouts'], `stats[${index}].checkoutHits`) ?? vorheriger?.checkoutHits ?? 0
    const count180 = ersteZahl(statsEintrag, ['count180', 'oneEighties', 'oneEightys'], `stats[${index}].count180`) ?? vorheriger?.count180 ?? 0
    const highestFinish =
      ersteZahl(statsEintrag, ['highestFinish', 'highFinish', 'bestFinish'], `stats[${index}].highestFinish`) ?? vorheriger?.highestFinish ?? null

    return { playerId: spieler.id, remaining, legs, sets, average3, checkoutAttempts, checkoutHits, count180, highestFinish }
  })

  const restAktiv = scores.find((s) => s.playerId === activePlayerId)?.remaining ?? startScore

  // ---- Leg-Verlauf ------------------------------------------------
  // Neuer Eintrag nur, wenn der Zug abgeschlossen ist (3 Darts, Bust, oder
  // dieser Wurf beendet Leg/Match - auch mit weniger als 3 Darts moeglich).
  // Ohne diese Bedingung wuerde ein Ereignis-je-Dart-Betrieb (siehe
  // Dateikopf, .game-events feuert einzeln) denselben Zug mehrfach als
  // separate Eintraege fuehren.
  const zugAbgeschlossen = legBeendet || matchBeendet || bust || currentThrow.length >= 3
  const legGeradeVorbei = zustand.phase === 'legBreak' || zustand.phase === 'finished'
  const legHistoryBasis = istNeuesMatch || legGeradeVorbei ? [] : zustand.legHistory
  const legHistory: LegEntry[] =
    activePlayerId && zugAbgeschlossen
      ? [...legHistoryBasis, { playerId: activePlayerId, darts: currentThrow, scored: bust ? 0 : currentThrowTotal, remainingAfter: restAktiv, bust }]
      : legHistoryBasis

  // ---- Ereignis -----------------------------------------------------
  // seq zaehlt einen Zaehler IM ZUSTAND hoch, nicht das Rohereignis (siehe
  // Aufgabenstellung) - jeder anwenden()-Aufruf mit einer .state-
  // Momentaufnahme erhoeht ihn um genau 1.
  const seq = (zustand.lastEvent?.seq ?? 0) + 1
  const spielerWechsel = activePlayerId !== null && zustand.activePlayerId !== null && activePlayerId !== zustand.activePlayerId

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
