import { describe, expect, it } from 'vitest'
import {
  aufwaermenUebernehmen,
  ergebnisAusZustand,
  ergebnisUebernehmen,
  letztesErgebnisZuruecknehmen,
  matchtagEinlesen,
  matchtagStarten,
  naechstePaarung,
  offenePaarungen,
  RUHENDER_MATCHTAG,
  spielerSchluessel,
  spielplanErzeugen,
  tabelle,
  type MatchErgebnis,
  type Matchtag,
  type MatchtagSpieler,
} from './matchtag'
import type { MatchState, Player, PlayerScore } from './typen'

const JETZT = '2026-09-11T20:00:00.000Z'

function spieler(...namen: string[]): MatchtagSpieler[] {
  return namen.map((name, index) => ({
    id: spielerSchluessel(name),
    name,
    warmupAverage: 60 - index,
  }))
}

/** Jede Paarung als "a|b" mit sortierten Seiten - Vergleich unabhaengig von links/rechts. */
function paare(matchtag: Matchtag): string[] {
  return matchtag.paarungen.map((p) => [p.aId, p.bId].sort().join('|'))
}

function matchtagMit(namen: string[]): Matchtag {
  const liste = spieler(...namen)
  return {
    ...matchtagStarten('Test', JETZT),
    phase: 'spielplan',
    spieler: liste,
    paarungen: spielplanErzeugen(liste),
  }
}

/** Traegt ein Ergebnis so ein, als waere es aus einem Autodarts-Match gekommen. */
function partieGewinnen(matchtag: Matchtag, sieger: string, verlierer: string, legs: [number, number], nr: number) {
  const ergebnis: MatchErgebnis = {
    matchId: `m${nr}`,
    spieler: [
      { id: spielerSchluessel(sieger), name: sieger, legs: legs[0], average: null },
      { id: spielerSchluessel(verlierer), name: verlierer, legs: legs[1], average: null },
    ],
    siegerId: spielerSchluessel(sieger),
  }
  return ergebnisUebernehmen(matchtag, ergebnis, `2026-09-11T20:${String(nr % 60).padStart(2, '0')}:00.000Z`)
}

// ---------------------------------------------------------------------

describe('spielerSchluessel', () => {
  it('macht aus demselben Namen dieselbe Kennung, egal wie geschrieben', () => {
    expect(spielerSchluessel('  Jan Geiger ')).toBe(spielerSchluessel('jan   geiger'))
  })
})

describe('spielplanErzeugen', () => {
  it('laesst bei gerader Zahl jeden genau einmal gegen jeden spielen', () => {
    const plan = spielplanErzeugen(spieler('A', 'B', 'C', 'D'))
    expect(plan).toHaveLength(6)
    expect(new Set(plan.map((p) => [p.aId, p.bId].sort().join('|'))).size).toBe(6)
  })

  it('laesst bei ungerader Zahl jeden genau einmal gegen jeden spielen', () => {
    // 5 Spieler: 10 Partien, in jeder Runde setzt genau einer aus.
    const plan = spielplanErzeugen(spieler('A', 'B', 'C', 'D', 'E'))
    expect(plan).toHaveLength(10)
    expect(new Set(plan.map((p) => [p.aId, p.bId].sort().join('|'))).size).toBe(10)
    const runden = new Set(plan.map((p) => p.runde))
    expect(runden.size).toBe(5)
    for (const runde of runden) {
      const inRunde = plan.filter((p) => p.runde === runde)
      expect(inRunde).toHaveLength(2)
      // Niemand spielt in derselben Runde zweimal.
      const beteiligte = inRunde.flatMap((p) => [p.aId, p.bId])
      expect(new Set(beteiligte).size).toBe(beteiligte.length)
    }
  })

  it('spielt niemanden gegen sich selbst', () => {
    for (const anzahl of [2, 3, 4, 5, 6, 7, 8]) {
      const namen = Array.from({ length: anzahl }, (_, i) => `S${i}`)
      for (const p of spielplanErzeugen(spieler(...namen))) {
        expect(p.aId).not.toBe(p.bId)
      }
    }
  })

  it('ergibt bei zwei Spielern genau eine Partie und bei weniger keine', () => {
    expect(spielplanErzeugen(spieler('A', 'B'))).toHaveLength(1)
    expect(spielplanErzeugen(spieler('A'))).toHaveLength(0)
    expect(spielplanErzeugen([])).toHaveLength(0)
  })

  it('vergibt eindeutige Kennungen', () => {
    const plan = spielplanErzeugen(spieler('A', 'B', 'C', 'D', 'E', 'F'))
    expect(new Set(plan.map((p) => p.id)).size).toBe(plan.length)
  })
})

describe('tabelle', () => {
  it('gibt einen Punkt je Sieg und zaehlt die Legs beiden Seiten richtig zu', () => {
    let m = matchtagMit(['A', 'B', 'C', 'D'])
    m = partieGewinnen(m, 'A', 'B', [3, 1], 1)
    const zeilen = tabelle(m)
    const a = zeilen.find((z) => z.spieler.name === 'A')!
    const b = zeilen.find((z) => z.spieler.name === 'B')!
    expect(a.punkte).toBe(1)
    expect(a.legsFuer).toBe(3)
    expect(a.legsGegen).toBe(1)
    expect(a.legDifferenz).toBe(2)
    expect(b.punkte).toBe(0)
    expect(b.legsFuer).toBe(1)
    expect(b.legsGegen).toBe(3)
  })

  it('sortiert nach Punkten, bei Gleichstand nach Legdifferenz', () => {
    let m = matchtagMit(['A', 'B', 'C', 'D'])
    m = partieGewinnen(m, 'A', 'B', [3, 2], 1)
    m = partieGewinnen(m, 'C', 'D', [3, 0], 2)
    const zeilen = tabelle(m)
    expect(zeilen[0]!.spieler.name).toBe('C')
    expect(zeilen[1]!.spieler.name).toBe('A')
  })

  it('vergibt bei gleicher Punktzahl denselben Platz und meldet den Gleichstand', () => {
    let m = matchtagMit(['A', 'B', 'C', 'D'])
    m = partieGewinnen(m, 'A', 'B', [3, 1], 1)
    m = partieGewinnen(m, 'C', 'D', [3, 1], 2)
    const zeilen = tabelle(m)
    expect(zeilen[0]!.platz).toBe(1)
    expect(zeilen[1]!.platz).toBe(1)
    expect(zeilen[0]!.gleichstand).toBe(true)
    expect(zeilen[2]!.platz).toBe(3)
  })
})

describe('ergebnisAusZustand', () => {
  const basis = (phase: MatchState['phase'], legs: [number, number]): MatchState => {
    const players: Player[] = [
      { id: 'p1', autodartsName: 'Anna', displayName: 'Anna' },
      { id: 'p2', autodartsName: 'Bert', displayName: 'Bert' },
    ]
    const scores: PlayerScore[] = players.map((p, index) => ({
      playerId: p.id,
      remaining: 0,
      legs: legs[index]!,
      sets: 0,
      average3: 70 - index,
      checkoutAttempts: 0,
      checkoutHits: 0,
      count180: 0,
      highestFinish: null,
      legAverage: null,
      legDarts: null,
      bullAbstand: null,
      dartsGesamt: 0,
      punkteGesamt: 0,
    }))
    return {
      phase,
      matchId: 'match-1',
      variant: 'x01',
      variantName: 'X01',
      startScore: 501,
      players,
      scores,
      activePlayerId: 'p1',
      currentThrow: [],
      currentThrowTotal: 0,
      bust: false,
      checkout: null,
      checkoutHint: null,
      legHistory: [],
      lastEvent: null,
    }
  }

  it('liefert nichts, solange das Match nicht beendet ist', () => {
    expect(ergebnisAusZustand(basis('playing', [2, 1]))).toBeNull()
  })

  it('nennt den Spieler mit den meisten Legs als Sieger', () => {
    const ergebnis = ergebnisAusZustand(basis('finished', [3, 1]))
    expect(ergebnis?.siegerId).toBe(spielerSchluessel('Anna'))
    expect(ergebnis?.spieler.map((s) => s.legs)).toEqual([3, 1])
  })

  it('nennt bei Gleichstand keinen Sieger - ein Abbruch darf nichts werten', () => {
    expect(ergebnisAusZustand(basis('finished', [2, 2]))?.siegerId).toBeNull()
  })
})

describe('aufwaermenUebernehmen', () => {
  const aufwaermen: MatchErgebnis = {
    matchId: 'warm-1',
    spieler: [
      { id: spielerSchluessel('Anna'), name: 'Anna', legs: 0, average: 55 },
      { id: spielerSchluessel('Bert'), name: 'Bert', legs: 0, average: 71 },
      { id: spielerSchluessel('Cem'), name: 'Cem', legs: 0, average: 63 },
    ],
    siegerId: null,
  }

  it('uebernimmt die Spielerliste und setzt nach Aufwaerm-Average', () => {
    const m = aufwaermenUebernehmen(matchtagStarten('Abend', JETZT), aufwaermen)
    expect(m.phase).toBe('spielplan')
    expect(m.spieler.map((s) => s.name)).toEqual(['Bert', 'Cem', 'Anna'])
    expect(m.aufwaermMatchId).toBe('warm-1')
  })

  it('erzeugt daraus den vollstaendigen Spielplan', () => {
    const m = aufwaermenUebernehmen(matchtagStarten('Abend', JETZT), aufwaermen)
    expect(m.paarungen).toHaveLength(3)
    expect(new Set(paare(m)).size).toBe(3)
  })

  it('bleibt im Aufwaermen, wenn weniger als zwei Spieler dabei waren', () => {
    const einer: MatchErgebnis = { ...aufwaermen, spieler: [aufwaermen.spieler[0]!] }
    expect(aufwaermenUebernehmen(matchtagStarten('Abend', JETZT), einer).phase).toBe('aufwaermen')
  })

  it('wertet nur, solange die Aufwaermrunde erwartet wird', () => {
    const laufend = matchtagMit(['A', 'B'])
    expect(aufwaermenUebernehmen(laufend, aufwaermen)).toBe(laufend)
  })

  it('nimmt ein beendetes Match als Aufwaermrunde, sobald der Matchtag laeuft', () => {
    // Der Weg, den der Dienst geht: ergebnisUebernehmen leitet im Aufwaermen
    // an aufwaermenUebernehmen weiter.
    const m = ergebnisUebernehmen(matchtagStarten('Abend', JETZT), aufwaermen, JETZT)
    expect(m.phase).toBe('spielplan')
    expect(m.spieler).toHaveLength(3)
  })
})

describe('ergebnisUebernehmen', () => {
  it('findet die Paarung ueber die Namen, unabhaengig von der Seite', () => {
    let m = matchtagMit(['A', 'B', 'C', 'D'])
    m = partieGewinnen(m, 'B', 'A', [3, 0], 1)
    const eingetragen = m.paarungen.find((p) => p.siegerId !== null)!
    expect(eingetragen.siegerId).toBe(spielerSchluessel('B'))
    // Die Legs stehen auf der Seite, auf der der Spieler im Plan steht.
    const legsVonB = eingetragen.aId === spielerSchluessel('B') ? eingetragen.legsA : eingetragen.legsB
    expect(legsVonB).toBe(3)
  })

  it('wertet dieselbe Match-Kennung nie zweimal', () => {
    let m = matchtagMit(['A', 'B', 'C', 'D'])
    m = partieGewinnen(m, 'A', 'B', [3, 1], 1)
    expect(partieGewinnen(m, 'A', 'B', [3, 1], 1)).toBe(m)
  })

  it('laesst alles unveraendert, wenn die Paarung nicht im Plan steht', () => {
    const m = matchtagMit(['A', 'B', 'C', 'D'])
    const fremd: MatchErgebnis = {
      matchId: 'x',
      spieler: [
        { id: spielerSchluessel('A'), name: 'A', legs: 3, average: null },
        { id: spielerSchluessel('Gast'), name: 'Gast', legs: 1, average: null },
      ],
      siegerId: spielerSchluessel('A'),
    }
    expect(ergebnisUebernehmen(m, fremd, JETZT)).toBe(m)
  })

  it('wertet ein Match ohne Sieger nicht', () => {
    const m = matchtagMit(['A', 'B'])
    const abgebrochen: MatchErgebnis = {
      matchId: 'x',
      spieler: [
        { id: spielerSchluessel('A'), name: 'A', legs: 1, average: null },
        { id: spielerSchluessel('B'), name: 'B', legs: 1, average: null },
      ],
      siegerId: null,
    }
    expect(ergebnisUebernehmen(m, abgebrochen, JETZT)).toBe(m)
  })

  it('wertet ein Match mit mehr als zwei Spielern nicht', () => {
    const m = matchtagMit(['A', 'B', 'C'])
    const zuViele: MatchErgebnis = {
      matchId: 'x',
      spieler: ['A', 'B', 'C'].map((name) => ({
        id: spielerSchluessel(name),
        name,
        legs: name === 'A' ? 3 : 0,
        average: null,
      })),
      siegerId: spielerSchluessel('A'),
    }
    expect(ergebnisUebernehmen(m, zuViele, JETZT)).toBe(m)
  })
})

describe('Abschluss und Stechen', () => {
  it('laesst den Matchtag laufen, solange Partien offen sind', () => {
    let m = matchtagMit(['A', 'B', 'C', 'D'])
    m = partieGewinnen(m, 'A', 'B', [3, 0], 1)
    expect(m.phase).toBe('laeuft')
    expect(offenePaarungen(m).length).toBeGreaterThan(0)
  })

  it('kuert einen alleinigen Ersten', () => {
    let m = matchtagMit(['A', 'B'])
    m = partieGewinnen(m, 'A', 'B', [3, 0], 1)
    expect(m.phase).toBe('beendet')
    expect(m.siegerId).toBe(spielerSchluessel('A'))
  })

  it('setzt bei Punktgleichheit an der Spitze ein Stechen nur unter den Gleichauf-Spielern an', () => {
    // Ringschluss: jeder gewinnt genau eine Partie gegen den naechsten und
    // verliert gegen den uebernaechsten - alle landen bei 2 Punkten? Nein:
    // hier gezielt so ausgespielt, dass alle vier je zwei Siege haben.
    let m = matchtagMit(['A', 'B', 'C', 'D'])
    let n = 1
    for (const [sieger, verlierer] of [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'D'],
      ['D', 'A'],
      ['A', 'C'],
      ['B', 'D'],
    ] as [string, string][]) {
      m = partieGewinnen(m, sieger, verlierer, [3, 2], n++)
    }
    const stand = tabelle(m)
    expect(m.phase).toBe('stechen')
    expect(m.stechenRunde).toBe(1)

    const spitzenIds = stand.filter((z) => z.punkte === stand[0]!.punkte).map((z) => z.spieler.id)
    const stechen = m.paarungen.filter((p) => p.runde < 0)
    expect(stechen.length).toBeGreaterThan(0)
    for (const p of stechen) {
      expect(spitzenIds).toContain(p.aId)
      expect(spitzenIds).toContain(p.bId)
    }
  })

  it('kuert nach einem ausgespielten Stechen einen Sieger oder sticht erneut', () => {
    let m = matchtagMit(['A', 'B', 'C', 'D'])
    let n = 1
    for (const [sieger, verlierer] of [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'D'],
      ['D', 'A'],
      ['A', 'C'],
      ['B', 'D'],
    ] as [string, string][]) {
      m = partieGewinnen(m, sieger, verlierer, [3, 2], n++)
    }
    // Das Stechen ausspielen: die zuerst genannte Seite gewinnt jeweils.
    for (const p of m.paarungen.filter((x) => x.runde < 0)) {
      const a = m.spieler.find((s) => s.id === p.aId)!
      const b = m.spieler.find((s) => s.id === p.bId)!
      m = partieGewinnen(m, a.name, b.name, [3, 0], n++)
    }
    expect(['beendet', 'stechen']).toContain(m.phase)
    if (m.phase === 'beendet') expect(m.siegerId).not.toBeNull()
  })
})

describe('letztesErgebnisZuruecknehmen', () => {
  it('macht die zuletzt gewertete Partie wieder offen', () => {
    let m = matchtagMit(['A', 'B', 'C', 'D'])
    m = partieGewinnen(m, 'A', 'B', [3, 1], 1)
    m = partieGewinnen(m, 'C', 'D', [3, 1], 2)
    const offenVorher = offenePaarungen(m).length
    const zurueck = letztesErgebnisZuruecknehmen(m)
    expect(offenePaarungen(zurueck).length).toBe(offenVorher + 1)
    expect(tabelle(zurueck).reduce((summe, z) => summe + z.punkte, 0)).toBe(1)
  })

  it('setzt zurueck auf den Spielplan, wenn nichts mehr gewertet ist', () => {
    let m = matchtagMit(['A', 'B', 'C', 'D'])
    m = partieGewinnen(m, 'A', 'B', [3, 1], 1)
    expect(letztesErgebnisZuruecknehmen(m).phase).toBe('spielplan')
  })

  it('macht ohne gewertete Partie nichts', () => {
    const m = matchtagMit(['A', 'B'])
    expect(letztesErgebnisZuruecknehmen(m)).toBe(m)
  })
})

describe('naechstePaarung', () => {
  it('nennt die erste offene Partie in Spielplanreihenfolge', () => {
    let m = matchtagMit(['A', 'B', 'C', 'D'])
    const erste = m.paarungen[0]!
    expect(naechstePaarung(m)?.id).toBe(erste.id)
    m = partieGewinnen(
      m,
      m.spieler.find((s) => s.id === erste.aId)!.name,
      m.spieler.find((s) => s.id === erste.bId)!.name,
      [3, 0],
      1,
    )
    expect(naechstePaarung(m)?.id).toBe(m.paarungen[1]!.id)
  })

  it('nennt nichts mehr, wenn alles gespielt ist', () => {
    let m = matchtagMit(['A', 'B'])
    m = partieGewinnen(m, 'A', 'B', [3, 0], 1)
    expect(naechstePaarung(m)).toBeNull()
  })
})

describe('matchtagEinlesen', () => {
  it('verwirft einen Stand mit anderer Version', () => {
    expect(matchtagEinlesen({ version: 99, phase: 'laeuft' })).toEqual(RUHENDER_MATCHTAG)
  })

  it('verwirft Unsinn statt zu raten', () => {
    expect(matchtagEinlesen(null)).toEqual(RUHENDER_MATCHTAG)
    expect(matchtagEinlesen('kein Objekt')).toEqual(RUHENDER_MATCHTAG)
    expect(matchtagEinlesen([])).toEqual(RUHENDER_MATCHTAG)
  })

  it('liest einen gespeicherten Stand vollstaendig zurueck', () => {
    let m = matchtagMit(['A', 'B', 'C', 'D'])
    m = partieGewinnen(m, 'A', 'B', [3, 1], 1)
    expect(matchtagEinlesen(JSON.parse(JSON.stringify(m)))).toEqual(m)
  })

  it('wirft einzelne kaputte Eintraege weg, ohne den Rest zu verlieren', () => {
    const m = matchtagMit(['A', 'B'])
    const roh = JSON.parse(JSON.stringify(m)) as { spieler: unknown[]; paarungen: unknown[] }
    roh.spieler.push({ name: 'ohne Kennung' })
    roh.paarungen.push({ id: 'kaputt' })
    const zurueck = matchtagEinlesen(roh)
    expect(zurueck.spieler).toHaveLength(2)
    expect(zurueck.paarungen).toHaveLength(1)
  })
})
