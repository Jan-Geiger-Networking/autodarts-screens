import { describe, expect, it } from 'vitest'
import { folienFuer } from './matchtagFolien'
import {
  ergebnisUebernehmen,
  matchtagStarten,
  spielerSchluessel,
  spielplanErzeugen,
  RUHENDER_MATCHTAG,
  type MatchErgebnis,
  type Matchtag,
} from '../../shared/matchtag'

const JETZT = '2026-09-11T20:00:00.000Z'

function matchtagMit(namen: string[]): Matchtag {
  const spieler = namen.map((name) => ({ id: spielerSchluessel(name), name, warmupAverage: null }))
  return {
    ...matchtagStarten('Test', JETZT),
    phase: 'spielplan',
    spieler,
    paarungen: spielplanErzeugen(spieler),
  }
}

function partieGewinnen(matchtag: Matchtag, sieger: string, verlierer: string, nr: number): Matchtag {
  const ergebnis: MatchErgebnis = {
    matchId: `m${nr}`,
    spieler: [
      { id: spielerSchluessel(sieger), name: sieger, legs: 3, average: 70, count180: 1, highestFinish: null },
      { id: spielerSchluessel(verlierer), name: verlierer, legs: 1, average: 60, count180: 0, highestFinish: null },
    ],
    siegerId: spielerSchluessel(sieger),
  }
  return ergebnisUebernehmen(matchtag, ergebnis, JETZT)
}

describe('folienFuer', () => {
  it('zeigt ohne Matchtag gar nichts', () => {
    expect(folienFuer(RUHENDER_MATCHTAG)).toEqual([])
  })

  it('zeigt waehrend der Aufwaermrunde nur deren Folie - es gibt noch keinen Spielplan', () => {
    expect(folienFuer(matchtagStarten('Abend', JETZT))).toEqual(['aufwaermen'])
  })

  it('laesst die Statistik weg, solange keine Partie gespielt ist', () => {
    expect(folienFuer(matchtagMit(['A', 'B', 'C', 'D']))).toEqual(['jetzt', 'tabelle', 'spielplan'])
  })

  it('nimmt die Statistik auf, sobald eine Partie gespielt ist', () => {
    const m = partieGewinnen(matchtagMit(['A', 'B', 'C', 'D']), 'A', 'B', 1)
    expect(folienFuer(m)).toEqual(['jetzt', 'tabelle', 'spielplan', 'statistik'])
  })

  it('beginnt bei einem entschiedenen Matchtag mit dem Sieger und laesst "jetzt" weg', () => {
    const m = partieGewinnen(matchtagMit(['A', 'B']), 'A', 'B', 1)
    expect(m.phase).toBe('beendet')
    const folien = folienFuer(m)
    expect(folien[0]).toBe('sieger')
    expect(folien).not.toContain('jetzt')
  })

  it('faellt notfalls auf die Tabelle zurueck statt auf einen leeren Bildschirm', () => {
    // Ein Matchtag ohne Spieler und ohne Partien - kann nur durch eine von
    // Hand bearbeitete Datei entstehen, darf aber nicht zu Schwarz fuehren.
    expect(folienFuer({ ...RUHENDER_MATCHTAG, phase: 'laeuft' })).toEqual(['tabelle'])
  })
})
