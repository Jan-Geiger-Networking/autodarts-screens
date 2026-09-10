// Welche Folien der Matchtag-Pausenbildschirm hergibt und in welcher
// Reihenfolge. Eigene Datei statt in Matchtag.tsx, damit sie ohne React und
// ohne Bilddateien pruefbar ist - dieselbe Trennung wie zwischen szene.ts und
// App.tsx.

import { naechstePaarung, statistiken, type Matchtag } from '../../shared/matchtag'

export type FolienArt = 'jetzt' | 'tabelle' | 'spielplan' | 'statistik' | 'aufwaermen' | 'sieger'

/**
 * Eine Folie ohne Inhalt wird weggelassen statt leer gezeigt: ein Spielplan
 * ohne Partien und eine Statistik ohne gespielte Partie sagen nichts. Bleibt
 * gar nichts uebrig, steht wenigstens die Tabelle - sie ist auch mit lauter
 * Nullen eine Aussage ("es hat noch niemand gespielt").
 */
export function folienFuer(matchtag: Matchtag): FolienArt[] {
  if (matchtag.phase === 'aus') return []
  if (matchtag.phase === 'aufwaermen') return ['aufwaermen']

  const folien: FolienArt[] = []
  if (matchtag.phase === 'beendet') folien.push('sieger')
  else if (naechstePaarung(matchtag)) folien.push('jetzt')
  if (matchtag.spieler.length > 0) folien.push('tabelle')
  if (matchtag.paarungen.length > 0) folien.push('spielplan')
  if (statistiken(matchtag).gespielt > 0) folien.push('statistik')
  return folien.length > 0 ? folien : ['tabelle']
}
