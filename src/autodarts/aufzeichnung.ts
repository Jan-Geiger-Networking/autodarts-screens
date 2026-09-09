// Zeichnet rohe Match-Ereignisse verlustfrei als JSON-Lines auf und spielt sie
// spaeter wieder ab. Das Rohereignis wird nicht interpretiert, nicht
// umgeformt und nicht gefiltert - es ist die einzige Quelle der Wahrheit
// ueber das Autodarts-API-Schema, solange kein eigenes Format feststeht.

import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { createReadStream } from 'node:fs'
import { dirname } from 'node:path'

// Eine erfolgreich serialisierte Zeile traegt "daten", eine Zeile zu einem
// Ereignis, das sich nicht serialisieren liess (z.B. zyklisches Objekt oder
// BigInt), traegt stattdessen "fehler". Die Wiedergabe erkennt Letzteres am
// Fehlen von "daten" und behandelt es wie eine uebersprungene Zeile.
type Zeile = { t: number; daten: unknown } | { t: number; fehler: string }

// Es laeuft je Prozess hoechstens eine Aufzeichnung. aufzeichnungBeenden()
// braucht daher keinen Parameter, um zu wissen, welcher Stream gemeint ist.
let laufenderStream: WriteStream | undefined

/**
 * Startet eine neue Aufzeichnung und liefert die Schreibfunktion fuer Ereignisse.
 * Wirft, wenn bereits eine Aufzeichnung laeuft: ein zweiter Start ohne
 * vorheriges aufzeichnungBeenden() wuerde sonst stillschweigend den ersten,
 * noch offenen Stream verlieren - der wird dann nie geschlossen, sein
 * "finish" nie abgewartet, und die erste Aufzeichnung haette keine Garantie,
 * vollstaendig auf der Platte zu landen. Das ist ein Programmierfehler des
 * Aufrufers und soll auffallen statt sich selbst zu "heilen".
 */
export function aufzeichnungStarten(pfad: string): (roh: unknown) => void {
  if (laufenderStream) {
    throw new Error(
      'Es laeuft bereits eine Aufzeichnung. Zuerst aufzeichnungBeenden() aufrufen.',
    )
  }

  mkdirSync(dirname(pfad), { recursive: true })
  const stream = createWriteStream(pfad)
  laufenderStream = stream
  const start = Date.now()

  return (roh: unknown) => {
    const t = Date.now() - start
    let text: string
    try {
      const zeile: Zeile = { t, daten: roh }
      text = JSON.stringify(zeile)
    } catch (fehler) {
      // Sehr unwahrscheinlich, da Rohereignisse aus JSON.parse eines
      // WebSocket-Frames stammen - aber wenn es passiert (zyklisches Objekt,
      // BigInt), soll die Aufzeichnung weiterlaufen statt mitten im Match
      // alles Folgende zu verlieren.
      const meldung = fehler instanceof Error ? fehler.message : String(fehler)
      console.warn(
        `Aufzeichnung: Ereignis bei t=${t} liess sich nicht serialisieren (${meldung}); schreibe Fehlermarkierung statt Rohereignis.`,
      )
      const ersatz: Zeile = { t, fehler: meldung }
      text = JSON.stringify(ersatz)
    }
    stream.write(`${text}\n`)
  }
}

/**
 * Schliesst die laufende Aufzeichnung und wartet, bis der WriteStream alles
 * gepufferte tatsaechlich auf die Platte geschrieben hat (Ereignis "finish").
 * Ohne dieses Warten koennte ein direkt anschliessendes Lesen der Datei eine
 * unvollstaendige Aufzeichnung sehen.
 */
export function aufzeichnungBeenden(): Promise<void> {
  const stream = laufenderStream
  laufenderStream = undefined
  if (!stream) return Promise.resolve()

  return new Promise((resolve, reject) => {
    stream.once('error', reject)
    stream.end(() => resolve())
  })
}

const warten = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** Ergebnis einer Wiedergabe: wie viele Zeilen tatsaechlich Ereignisse geliefert haben. */
export type Wiedergabeergebnis = { abgespielt: number; uebersprungen: number }

/**
 * Spielt eine Aufzeichnung ab und ruft beiEreignis fuer jedes gueltige
 * Rohereignis in Aufzeichnungsreihenfolge auf. tempo === 0 spielt ohne jede
 * Wartezeit ab (fuer Tests), tempo === 1 haelt die urspruenglichen Abstaende
 * ein, andere Werte stauchen bzw. strecken die Abstaende entsprechend.
 *
 * Eine beschaedigte Zeile (z.B. durch einen Absturz mitten im Match
 * abgeschnitten) oder eine Fehlermarkierung aus der Aufzeichnung (siehe
 * Zeile-Typ) wird uebersprungen statt die Wiedergabe abzubrechen - eine
 * Warnung mit Zeilennummer landet auf console.warn. Der Rueckgabewert zeigt,
 * ob die Aufzeichnung vollstaendig war.
 */
export async function wiedergeben(
  pfad: string,
  beiEreignis: (roh: unknown) => void,
  tempo = 1,
): Promise<Wiedergabeergebnis> {
  const zeilen = createInterface({ input: createReadStream(pfad, 'utf8') })

  let vorherigeZeit: number | undefined
  let abgespielt = 0
  let uebersprungen = 0
  let zeilennummer = 0

  for await (const zeile of zeilen) {
    zeilennummer += 1
    if (zeile.trim() === '') continue

    let eintrag: Zeile
    try {
      eintrag = JSON.parse(zeile) as Zeile
    } catch {
      console.warn(`Wiedergabe: Zeile ${zeilennummer} ist beschaedigt und wird uebersprungen.`)
      uebersprungen += 1
      continue
    }

    if (tempo !== 0 && vorherigeZeit !== undefined) {
      const abstand = (eintrag.t - vorherigeZeit) / tempo
      if (abstand > 0) await warten(abstand)
    }
    vorherigeZeit = eintrag.t

    if (eintrag === null || typeof eintrag !== 'object' || !('daten' in eintrag)) {
      console.warn(
        `Wiedergabe: Zeile ${zeilennummer} enthaelt kein Ereignis (Aufzeichnungsfehler) und wird uebersprungen.`,
      )
      uebersprungen += 1
      continue
    }

    beiEreignis(eintrag.daten)
    abgespielt += 1
  }

  return { abgespielt, uebersprungen }
}
