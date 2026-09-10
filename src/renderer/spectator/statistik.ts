// Zahlen, die sich aus dem Verlauf des laufenden Legs ableiten lassen -
// zusaetzlich zu den Werten, die Autodarts selbst je Spieler liefert
// (Average, Checkout-Quote, 180er, hoechstes Finish in PlayerScore).
//
// Bewusst nur aus legHistory abgeleitet: das ist der einzige Verlauf, den der
// Zustand mitfuehrt, und er beginnt mit jedem Leg neu. Diese Werte heissen
// deshalb im Screen ausdruecklich "dieses Leg" - sie als Match-Statistik
// auszugeben waere falsch.

import type { LegEntry } from '../../shared/typen'

export type LegStatistik = {
  /** Geworfene Darts in diesem Leg. */
  darts: number
  /** Abgeschlossene Aufnahmen (Zuege) in diesem Leg. */
  aufnahmen: number
  /** Durchschnitt je Aufnahme, null solange keine Aufnahme vorliegt. */
  schnitt: number | null
  /** Hoechste Aufnahme in diesem Leg, null solange keine vorliegt. */
  beste: number | null
  /** Aufnahmen mit 100 Punkten oder mehr. */
  ueber100: number
  /** Aufnahmen mit 140 Punkten oder mehr. */
  ueber140: number
  /** Aufnahmen, die im Bust endeten. */
  busts: number
}

export const LEER: LegStatistik = {
  darts: 0,
  aufnahmen: 0,
  schnitt: null,
  beste: null,
  ueber100: 0,
  ueber140: 0,
  busts: 0,
}

/**
 * Wertet den Verlauf des laufenden Legs fuer einen Spieler aus. Ein Bust
 * zaehlt als Aufnahme mit 0 Punkten (so wird auch gerechnet: die Darts sind
 * geworfen, die Punkte zaehlen nicht) und geht damit in den Schnitt ein.
 */
export function legStatistik(legHistory: readonly LegEntry[], spielerId: string | null): LegStatistik {
  if (spielerId === null) return LEER
  const eigene = legHistory.filter((e) => e.playerId === spielerId)
  if (eigene.length === 0) return LEER

  let darts = 0
  let summe = 0
  let beste = 0
  let ueber100 = 0
  let ueber140 = 0
  let busts = 0

  for (const eintrag of eigene) {
    darts += eintrag.darts.length
    summe += eintrag.scored
    if (eintrag.scored > beste) beste = eintrag.scored
    if (eintrag.scored >= 100) ueber100 += 1
    if (eintrag.scored >= 140) ueber140 += 1
    if (eintrag.bust) busts += 1
  }

  return {
    darts,
    aufnahmen: eigene.length,
    schnitt: summe / eigene.length,
    beste,
    ueber100,
    ueber140,
    busts,
  }
}
