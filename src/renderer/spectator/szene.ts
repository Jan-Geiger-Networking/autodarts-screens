// Reine Ableitung der Zuschauer-Szene aus MatchState. Siehe Abschnitt 8 der
// Spec (docs/superpowers/specs/2026-09-09-autodarts-dual-screen-design.md)
// fuer die Szenen-Tabelle. Absichtlich frei von React und Timern: nur diese
// Funktion entscheidet, WAS als naechstes zu zeigen ist, WANN es wie lange
// sichtbar bleibt, entscheidet App.tsx.

import type { MatchEvent, MatchState } from '../../shared/typen'

export type BasisSzene = 'idle' | 'bullOff' | 'intro' | 'scoreboard'

export type Ueberlagerung =
  | { art: 'playerChange'; seq: number; zuSpielerId: string }
  | { art: 'bigMoment'; seq: number; anlass: 'oneEighty' | 'highFinish'; spielerId: string }
  | { art: 'miss'; seq: number; spielerId: string }
  | { art: 'legWin'; seq: number; spielerId: string }
  | { art: 'matchWin'; seq: number; spielerId: string }

export type SzenenErgebnis = {
  basis: BasisSzene
  /** Neu ausgeloest in diesem Aufruf; null wenn kein frisches Ereignis vorliegt. */
  ueberlagerung: Ueberlagerung | null
  /** Dem naechsten Aufruf als zuletztVerarbeiteteSeq mitgeben. */
  verarbeiteteSeq: number
}

// Dauer jeder Ueberlagerung in Millisekunden, aus der Szenen-Tabelle in
// Abschnitt 8. matchWin fuehrt danach nicht zwangslaeufig zurueck in idle:
// das haengt vom phase-Feld ab, das ausschliesslich der Hauptprozess setzt
// (siehe Report - bewusst nicht hier nachgebildet, das waere aussen vor
// unserem Arbeitsbereich liegende Logik).
export const UEBERLAGERUNG_DAUER_MS: Record<Ueberlagerung['art'], number> = {
  playerChange: 2500,
  // Kurz - der Wurf ist daneben gegangen, das muss man sehen, aber nicht
  // ausgiebig ("die miss aber schnell weg gehen").
  miss: 1400,
  bigMoment: 3500,
  legWin: 4000,
  matchWin: 12000,
}

export function ermittleBasis(zustand: MatchState): BasisSzene {
  if (zustand.phase === 'idle' || zustand.players.length === 0) return 'idle'
  // Die Anfangsermittlung hat keinen Spielstand - sie bekommt ein eigenes
  // Bild, sonst stuende dort ein Scoreboard mit zweimal 501.
  if (zustand.phase === 'bullOff') return 'bullOff'
  if (zustand.phase === 'intro') return 'intro'
  return 'scoreboard'
}

function ueberlagerungAusEreignis(ereignis: MatchEvent): Ueberlagerung | null {
  switch (ereignis.kind) {
    case 'playerChange':
      return { art: 'playerChange', seq: ereignis.seq, zuSpielerId: ereignis.toPlayerId }
    case 'oneEighty':
      return { art: 'bigMoment', seq: ereignis.seq, anlass: 'oneEighty', spielerId: ereignis.playerId }
    case 'miss':
      return { art: 'miss', seq: ereignis.seq, spielerId: ereignis.playerId }
    case 'highFinish':
      return { art: 'bigMoment', seq: ereignis.seq, anlass: 'highFinish', spielerId: ereignis.playerId }
    case 'legWon':
      return { art: 'legWin', seq: ereignis.seq, spielerId: ereignis.playerId }
    case 'matchWon':
      return { art: 'matchWin', seq: ereignis.seq, spielerId: ereignis.playerId }
    case 'throw':
      return null
  }
}

/**
 * `zuletztVerarbeiteteSeq` ist die zuletzt von diesem Aufrufer verarbeitete
 * `lastEvent.seq`. Eine Ueberlagerung loest genau dann aus, wenn die Nummer
 * eine ANDERE ist - so laeuft eine Einblendung genau einmal, auch wenn
 * derselbe MatchState mehrfach durch diese Funktion laeuft (React-Re-Render,
 * unveraenderte IPC-Nachricht, ...).
 *
 * Ausdruecklich "andere" und nicht "hoehere": der Zaehler beginnt bei jedem
 * neuen Match wieder bei 1, weil der Ruhezustand lastEvent: null traegt
 * (siehe RUHEZUSTAND in adapter.ts). Ein Bildschirm, der ueber einen ganzen
 * Abend offen bleibt, hat dann noch die hohe Nummer des vorigen Matches
 * gemerkt - mit "hoeher" waere ab dem ZWEITEN Match keine einzige
 * Einblendung mehr gekommen, weder 180 noch gewonnenes Leg. Genau das war
 * gemeldet. Eine kleinere Nummer heisst nicht "alt", sondern "neue
 * Zaehlung".
 */
export function szeneAusZustand(zustand: MatchState, zuletztVerarbeiteteSeq: number): SzenenErgebnis {
  const basis = ermittleBasis(zustand)
  const ereignis = zustand.lastEvent

  if (!ereignis || ereignis.seq === zuletztVerarbeiteteSeq) {
    return { basis, ueberlagerung: null, verarbeiteteSeq: zuletztVerarbeiteteSeq }
  }

  return { basis, ueberlagerung: ueberlagerungAusEreignis(ereignis), verarbeiteteSeq: ereignis.seq }
}
