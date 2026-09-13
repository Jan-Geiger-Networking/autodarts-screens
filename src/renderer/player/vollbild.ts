// Was im Layout "JGN Optimized" gerade den ganzen Monitor einnimmt.
//
// Abgeleitet aus dem Spielstand, nicht aus einem Ereignis: die Anzeige soll
// stehen, SOLANGE die Pfeile stecken, und genau das bildet der Zustand ab.
// Belegt aus einem Board-Mitschnitt vom 11.09.2026: nach dem dritten Pfeil
// (oder dem Bust, oder dem Siegpfeil eines Legs) bleibt die Momentaufnahme
// unveraendert, bis das Brett "Takeout finished" meldet - erst dann kommt
// der naechste Spieler bzw. das naechste Leg.

import type { MatchState } from '../../shared/typen'

export type Vollbild =
  | { art: 'aufnahme'; spielerId: string; punkte: number; bust: boolean }
  | { art: 'leg' | 'match'; spielerId: string; finish: number | null }

export function vollbildAus(zustand: MatchState): Vollbild | null {
  if (zustand.phase === 'legBreak' || zustand.phase === 'finished') {
    // Der Sieger steht auf 0. Der aktive Spieler ist nur die Rueckfallebene,
    // falls ein Modus keinen Rest fuehrt.
    const spielerId = zustand.scores.find((s) => s.remaining === 0)?.playerId ?? zustand.activePlayerId
    if (!spielerId) return null
    return {
      art: zustand.phase === 'finished' ? 'match' : 'leg',
      spielerId,
      finish: zustand.currentThrowTotal > 0 ? zustand.currentThrowTotal : null,
    }
  }

  if (zustand.phase !== 'playing' || !zustand.activePlayerId) return null
  if (!zustand.bust && zustand.currentThrow.length < 3) return null
  return {
    art: 'aufnahme',
    spielerId: zustand.activePlayerId,
    punkte: zustand.bust ? 0 : zustand.currentThrowTotal,
    bust: zustand.bust,
  }
}
