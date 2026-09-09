type Feld = { name: string; wert: number; doppel: boolean }

// Reihenfolge steuert, welcher von mehreren gueltigen Wegen gewaehlt wird.
const FELDER: Feld[] = (() => {
  const zahlen = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
  const f: Feld[] = []
  for (const n of zahlen) f.push({ name: `T${n}`, wert: n * 3, doppel: false })
  for (const n of zahlen) f.push({ name: `${n}`, wert: n, doppel: false })
  f.push({ name: '25', wert: 25, doppel: false })
  for (const n of zahlen) f.push({ name: `D${n}`, wert: n * 2, doppel: true })
  f.push({ name: 'BULL', wert: 50, doppel: true })
  return f
})()

const DOPPEL = FELDER.filter((f) => f.doppel)

// Doppel, die Spieler tatsaechlich anvisieren. Alles andere ist zweite Wahl.
const BEVORZUGTE_DOPPEL = new Set(['D20', 'D16', 'D18', 'D12', 'D10', 'D8', 'D4', 'D2'])

type Kandidat = { weg: string[]; stufe: number; aufbau: number }

function kandidaten(rest: number, darts: number): Kandidat[] {
  const gefunden: Kandidat[] = []

  // hatDoppelAufbau: ob einer der Darts VOR dem Finish selbst ein Doppel war.
  // Ein Doppel ist im Aufbau schlechter als ein Single/Treble gleichen Werts,
  // weil kein Spieler im Aufbau bewusst auf ein Doppel zielt (das Doppelfeld
  // ist schmaler und wird nur zum Ausmachen anvisiert) — daher Strafzuschlag
  // auf die Stufe statt reiner Aufbau-Summe. Ohne die Strafe gewinnt bei
  // Rest 141 die Route T17+BULL+D20 (BULL als Aufbau-Doppel, Finish auf dem
  // bevorzugten D20) gegen die tatsaechlich gaengige Route T20+T19+D12,
  // weil das Finish-Doppel vor dem Aufbau verglichen wird. Weitere Faelle
  // mit konkreten Zahlen stehen im Task-6-Report.
  const suchen = (
    offen: number,
    uebrig: number,
    weg: string[],
    aufbau: number,
    hatDoppelAufbau: boolean,
  ) => {
    for (const d of DOPPEL) {
      if (d.wert === offen) {
        // finalRang: D20 ist das mit Abstand meistgenutzte Finish (rang 0),
        // die uebrigen ueblichen Doppel folgen (rang 1), alles andere zuletzt.
        const finalRang = d.name === 'D20' ? 0 : BEVORZUGTE_DOPPEL.has(d.name) ? 1 : 2
        gefunden.push({
          weg: [...weg, d.name],
          stufe: (hatDoppelAufbau ? 3 : 0) + finalRang,
          aufbau,
        })
      }
    }
    if (uebrig <= 1) return
    for (const f of FELDER) {
      if (f.wert < offen) {
        suchen(offen - f.wert, uebrig - 1, [...weg, f.name], aufbau + f.wert, hatDoppelAufbau || f.doppel)
      }
    }
  }

  suchen(rest, darts, [], 0, false)
  return gefunden
}

/**
 * Gaengiger Weg, den Rest mit hoechstens `dartsUebrig` Darts auf einem Doppel
 * zu beenden. `null`, wenn es keinen gibt.
 *
 * ponytail: erschoepfende Suche ueber hoechstens drei Darts, im schlimmsten
 * Fall rund 62^2 Kombinationen. Billiger als eine gepflegte Tabelle, und die
 * Vorlieben unten sind damit eine Stellschraube statt 170 Handeintraegen.
 */
export function checkoutWeg(rest: number, dartsUebrig: 1 | 2 | 3 = 3): string[] | null {
  if (!Number.isInteger(rest) || rest < 2 || rest > 170) return null
  const alle = kandidaten(rest, dartsUebrig)
  if (alle.length === 0) return null
  alle.sort(
    (a, b) => a.weg.length - b.weg.length || a.stufe - b.stufe || b.aufbau - a.aufbau,
  )
  return alle[0]!.weg
}

export const BOGEY_ZAHLEN: ReadonlySet<number> = new Set(
  Array.from({ length: 169 }, (_, i) => i + 2).filter((r) => checkoutWeg(r) === null),
)

/**
 * Wurf, der einen nicht ausmachbaren Rest in einen ausmachbaren verwandelt.
 * `null`, wenn der Rest bereits ausmachbar ist. Ab Rest 231 kann kein
 * einzelner Wurf (hoechster Feldwert T20 = 60) den Rest unter die
 * checkoutWeg-Obergrenze 170 druecken (230 - 60 = 170 ist die letzte
 * erreichbare Zahl) — dann ist die richtige Empfehlung schlicht der
 * hoechste Scoring-Wurf, T20.
 */
export function setupWurf(rest: number): string | null {
  if (checkoutWeg(rest) !== null) return null
  for (const f of FELDER) {
    const uebrig = rest - f.wert
    if (uebrig >= 2 && checkoutWeg(uebrig) !== null) return f.name
  }
  return 'T20'
}
