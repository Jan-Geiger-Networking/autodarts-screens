// Kleine, reine Anzeige-Helfer. Rechnen nichts Fachliches aus (das kommt
// vollstaendig aus MatchState), formatieren nur, was schon dasteht.

import type { PlayerScore } from '../../shared/typen'

/** Erste Buchstaben von Vor- und Nachname, z.B. "Jan Geiger" -> "JG". */
export function initialen(anzeigename: string): string {
  const teile = anzeigename.trim().split(/\s+/).filter(Boolean)
  if (teile.length === 0) return '?'
  if (teile.length === 1) return (teile[0] ?? '').slice(0, 2).toUpperCase()
  return `${teile[0]?.[0] ?? ''}${teile[teile.length - 1]?.[0] ?? ''}`.toUpperCase()
}

/** "–" ohne Versuche statt einer irrefuehrenden 0% oder NaN%. */
export function checkoutQuote(score: PlayerScore): string {
  if (score.checkoutAttempts === 0) return '–'
  return `${Math.round((score.checkoutHits / score.checkoutAttempts) * 100)}%`
}

export function averageAnzeige(average: number | null): string {
  return average === null ? '–' : average.toFixed(1)
}

export function finishAnzeige(finish: number | null): string {
  return finish === null ? '–' : `${finish}`
}
