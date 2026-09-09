// Zeichnet rohe Match-Ereignisse verlustfrei als JSON-Lines auf und spielt sie
// spaeter wieder ab. Das Rohereignis wird nicht interpretiert, nicht
// umgeformt und nicht gefiltert - es ist die einzige Quelle der Wahrheit
// ueber das Autodarts-API-Schema, solange kein eigenes Format feststeht.

import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { createReadStream } from 'node:fs'
import { dirname } from 'node:path'

type Zeile = { t: number; daten: unknown }

// Es laeuft je Prozess hoechstens eine Aufzeichnung. aufzeichnungBeenden()
// braucht daher keinen Parameter, um zu wissen, welcher Stream gemeint ist.
let laufenderStream: WriteStream | undefined

/** Startet eine neue Aufzeichnung und liefert die Schreibfunktion fuer Ereignisse. */
export function aufzeichnungStarten(pfad: string): (roh: unknown) => void {
  mkdirSync(dirname(pfad), { recursive: true })
  const stream = createWriteStream(pfad)
  laufenderStream = stream
  const start = Date.now()

  return (roh: unknown) => {
    const zeile: Zeile = { t: Date.now() - start, daten: roh }
    stream.write(`${JSON.stringify(zeile)}\n`)
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

/**
 * Spielt eine Aufzeichnung ab und ruft beiEreignis fuer jedes Rohereignis in
 * Aufzeichnungsreihenfolge auf. tempo === 0 spielt ohne jede Wartezeit ab
 * (fuer Tests), tempo === 1 haelt die urspruenglichen Abstaende ein, andere
 * Werte stauchen bzw. strecken die Abstaende entsprechend.
 */
export async function wiedergeben(
  pfad: string,
  beiEreignis: (roh: unknown) => void,
  tempo = 1,
): Promise<void> {
  const zeilen = createInterface({ input: createReadStream(pfad, 'utf8') })

  let vorherigeZeit: number | undefined
  for await (const zeile of zeilen) {
    if (zeile.trim() === '') continue
    const eintrag = JSON.parse(zeile) as Zeile

    if (tempo !== 0 && vorherigeZeit !== undefined) {
      const abstand = (eintrag.t - vorherigeZeit) / tempo
      if (abstand > 0) await warten(abstand)
    }
    vorherigeZeit = eintrag.t

    beiEreignis(eintrag.daten)
  }
}
