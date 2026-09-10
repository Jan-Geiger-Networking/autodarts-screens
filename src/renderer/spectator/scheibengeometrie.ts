// Geometrie der Dartscheibe: rechnet einen geworfenen Dart auf eine Position
// um. Rein und ohne React, damit sie ohne Bildschirm pruefbar ist - dieselbe
// Trennung wie zwischen szene.ts und App.tsx.
//
// Die Scheibe hat keinen Koordinaten-Zulieferer: das Rohereignis von
// Autodarts enthaelt nach heutigem Kenntnisstand nur den getroffenen Sektor
// (Zahl und Faktor), keinen Auftreffpunkt. Angezeigt wird deshalb die Mitte
// des getroffenen Feldes, leicht gestreut, damit drei Darts im selben Feld
// nebeneinander liegen statt uebereinander. Das beantwortet die Frage "wo
// ging der Wurf hin" so genau, wie die Daten es zulassen - und erfindet
// keinen Auftreffpunkt, den niemand gemessen hat.

import type { Segment } from '../../shared/typen'

/** Sektoren im Uhrzeigersinn, beginnend oben. Reihenfolge einer normgerechten Scheibe. */
export const SEKTOREN = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5] as const

/** Winkel eines Sektors in Grad. */
export const SEKTOR_WINKEL = 360 / SEKTOREN.length

// Radien in Prozent des Aussenradius (Doppelring aussen = 100), aus den
// Massen einer Turnierscheibe: Bull 6,35 mm, Single-Bull 15,9 mm,
// Triple-Ring 99-107 mm, Doppel-Ring 162-170 mm, jeweils geteilt durch 170.
export const RADIUS = {
  bull: 3.7,
  bullAussen: 9.4,
  tripleInnen: 58.2,
  tripleAussen: 62.9,
  doppelInnen: 95.3,
  doppelAussen: 100,
} as const

export type Punkt = { x: number; y: number }

/** Index eines Sektors im Ring; -1, wenn die Zahl kein Sektor ist (0, 25). */
export function sektorIndex(zahl: number): number {
  return SEKTOREN.indexOf(zahl as (typeof SEKTOREN)[number])
}

/**
 * Mittelwinkel eines Sektors in Grad, gemessen wie in SVG ueblich: 0 zeigt
 * nach rechts, positive Werte drehen im Uhrzeigersinn. Sektor 20 steht oben,
 * also bei -90.
 */
export function sektorWinkel(zahl: number): number {
  const index = sektorIndex(zahl)
  return index === -1 ? -90 : -90 + index * SEKTOR_WINKEL
}

/** Mittlerer Radius des Rings, den ein Dart mit diesem Faktor getroffen hat. */
function ringRadius(segment: Segment): number {
  if (segment.value === 25) return segment.multiplier === 2 ? 0 : (RADIUS.bull + RADIUS.bullAussen) / 2
  if (segment.multiplier === 3) return (RADIUS.tripleInnen + RADIUS.tripleAussen) / 2
  if (segment.multiplier === 2) return (RADIUS.doppelInnen + RADIUS.doppelAussen) / 2
  // Einfachfeld: es gibt zwei davon (innen und aussen). Das aeussere ist das
  // groessere und das, was man ueblicherweise trifft.
  return (RADIUS.tripleAussen + RADIUS.doppelInnen) / 2
}

/**
 * Position eines Darts auf der Scheibe, in Prozent vom Mittelpunkt aus
 * (-100 bis 100 in beiden Richtungen). `index` ist der wievielte Dart des
 * Zuges - er bestimmt die Streuung, damit drei Darts im selben Feld
 * nebeneinander liegen. Die Streuung ist fest je Index, nicht zufaellig:
 * derselbe Wurf sieht bei jedem Neuzeichnen gleich aus, statt zu springen.
 */
export function dartPosition(segment: Segment, index: number): Punkt {
  const streuungWinkel = [-4.5, 0, 4.5][index % 3] ?? 0
  const streuungRadius = [-3, 2, -1][index % 3] ?? 0

  // Im Bull gibt es keinen Sektor, in dem sich streuen liesse - dort wird die
  // Streuung zu einem kleinen Versatz um den Mittelpunkt.
  if (segment.value === 25 && segment.multiplier === 2) {
    return { x: streuungWinkel * 0.35, y: streuungRadius * 0.5 }
  }

  const grad = sektorWinkel(segment.value) + streuungWinkel
  const radius = Math.max(0, ringRadius(segment) + streuungRadius)
  const bogen = (grad * Math.PI) / 180
  return { x: Math.cos(bogen) * radius, y: Math.sin(bogen) * radius }
}
