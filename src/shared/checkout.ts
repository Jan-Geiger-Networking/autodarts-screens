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
// BULL (50) ist absichtlich NICHT dabei: es ist zwar ein haeufiges Finish,
// aber nur dort, wo es der einzige Weg ist (z.B. Rest 170, 167, 50) — als
// gleichwertige Alternative zu einem "normalen" Doppel wird es in der Praxis
// nicht gegen z.B. D20 gegeneinander abgewogen.
//
// Zielkonflikt bei der D20-Sonderpriorisierung (siehe finalRang unten):
// Reale Checkout-Praxis kennt zwei konkurrierende Daumenregeln, die sich
// nicht beide gleichzeitig abbilden lassen:
//   1. D20 pauschal bevorzugen (aktuelle Wahl hier) — es ist das mit Abstand
//      meistgeuebte Doppel.
//   2. Die "gerade bleibt gerade"-Kette D16 -> D8 -> D4 -> D2 bevorzugen —
//      bei diesen Doppeln sind beide Nachbarfelder auf der Scheibe gerade
//      (z.B. D16 hat 8 und 8 als Nachbarn), ein Fehlwurf hinterlaesst also
//      wieder eine gerade, potenziell ausmachbare Zahl. D20 hat die Nachbarn
//      1 und 5 (ungerade) — ein Fehlwurf dort kann in eine ungerade,
//      schlechtere Situation fuehren.
// Beispiele, wo beide Regeln auseinanderlaufen: Rest 48 liefert hier
// ['8','D20'], manche Checkout-Tabellen empfehlen stattdessen '16','D16'.
// Rest 56 liefert hier ['16','D20'], die Alternative waere 'T8','D16'.
// Beide Wege sind gueltige Checkouts; welche Daumenregel gelten soll, ist
// eine Geschmacksfrage der Darts-Praxis und keine hier zu entscheidende
// Frage. Wer die Vorliebe umstellen will: finalRang unten ist die einzige
// Stelle, die angepasst werden muss.
const BEVORZUGTE_DOPPEL = new Set(['D20', 'D16', 'D18', 'D12', 'D10', 'D8', 'D4', 'D2'])

type Kandidat = { weg: string[]; stufe: number; aufbau: number }

function kandidaten(rest: number, darts: number): Kandidat[] {
  const gefunden: Kandidat[] = []

  // hatDoppelAufbau: ob einer der Darts VOR dem Finish selbst ein Doppel war.
  // Ein Doppel ist im Aufbau schlechter als ein Single/Treble gleichen Werts,
  // weil kein Spieler im Aufbau bewusst auf ein Doppel zielt (das Doppelfeld
  // ist schmaler und wird nur zum Ausmachen anvisiert) — daher Strafzuschlag
  // auf die Stufe statt reiner Aufbau-Summe. Zwei Belegfaelle, was ohne die
  // Strafe passieren wuerde (stufe dann nur aus finalRang, hoechster Aufbau
  // entscheidet):
  //   Rest 60: gewinnt D20+D10 (D20 als Aufbau-Doppel, Aufbau 40) gegen die
  //   tatsaechlich gaengige Route 20+D20 (Aufbau 20), weil beide auf einem
  //   BEVORZUGTE_DOPPEL-Mitglied enden und der hoehere Aufbau vorgezogen wird.
  //   Rest 141: gewinnt T17+BULL+D20 (BULL als Aufbau-Doppel, Finish auf dem
  //   bevorzugten D20, finalRang 0) gegen die tatsaechlich gaengige Route
  //   T20+T19+D12 (finalRang 1), weil das Finish-Doppel vor dem Aufbau
  //   verglichen wird und D20 jedes andere Doppel schlaegt, egal wie hoch
  //   dessen eigener Aufbau ist.
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
 * Regel 1: Rest ist bereits ausmachbar -> `null`.
 * Regel 2: es gibt einen Wurf, der einen ausmachbaren (nicht-bogey) Rest
 * im Bereich 2..170 hinterlaesst -> der erste in FELDER-Reihenfolge.
 * Regel 3: sonst -> 'T20', der hoechste Scoring-Wurf.
 *
 * Regel 3 greift nicht erst "ab einer festen Grenze". Ab Rest 231 kann kein
 * einzelner Wurf (hoechster Feldwert T20 = 60) den Rest ueberhaupt unter die
 * checkoutWeg-Obergrenze 170 druecken (230 - 60 = 170 ist die letzte so
 * erreichbare Zahl), aber schon darunter scheitert Regel 2 an sieben
 * einzelnen Resten, weil jeder moegliche Wurf entweder eine Bogey-Zahl oder
 * einen Rest ausserhalb 2..170 hinterlaesst: 219, 222, 223, 225, 226, 228,
 * 229. Beispiel 219: die einzigen Felder, die ueberhaupt unter 171 bringen,
 * sind T17, BULL, T18, T19 und T20 — sie hinterlassen 168, 169, 165, 162
 * und 159, allesamt Bogey-Zahlen. Regel 3 liefert dort ebenfalls 'T20'.
 */
export function setupWurf(rest: number): string | null {
  if (checkoutWeg(rest) !== null) return null
  for (const f of FELDER) {
    const uebrig = rest - f.wert
    if (uebrig >= 2 && checkoutWeg(uebrig) !== null) return f.name
  }
  return 'T20'
}
