import { describe, expect, it } from 'vitest'
import { kennungEinlesen, passendenMonitorWaehlen, type MonitorBeschreibung } from './monitorAuswahl'

const tv: MonitorBeschreibung = { id: 111, label: '\\\\.\\DISPLAY2', breite: 3840, hoehe: 2160, skalierung: 1.5 }
const arbeit: MonitorBeschreibung = { id: 222, label: '\\\\.\\DISPLAY1', breite: 1920, hoehe: 1080, skalierung: 1 }

describe('passendenMonitorWaehlen', () => {
  it('findet den unveraenderten Monitor', () => {
    expect(passendenMonitorWaehlen(tv, [arbeit, tv])).toBe(tv)
  })

  it('findet ihn wieder, wenn Windows eine neue Kennung vergeben hat', () => {
    // Genau der Fall nach einem Neustart: gleicher Anschluss, gleiche
    // Aufloesung, andere id.
    const neu = { ...tv, id: 999 }
    expect(passendenMonitorWaehlen(tv, [arbeit, neu])).toBe(neu)
  })

  it('findet ihn, wenn nur die Skalierung geaendert wurde', () => {
    const neu = { ...tv, id: 999, skalierung: 1 }
    expect(passendenMonitorWaehlen(tv, [arbeit, neu])).toBe(neu)
  })

  it('findet ihn ueber den Anschluss, wenn der Fernseher eine andere Aufloesung meldet', () => {
    // Kommt beim Einschalten vor: der Fernseher meldet erst 1920x1080 und
    // stellt danach auf 4K um.
    const notaufloesung = { ...tv, id: 999, breite: 1920, hoehe: 1080, skalierung: 1 }
    expect(passendenMonitorWaehlen(tv, [notaufloesung])).toBe(notaufloesung)
  })

  it('findet ihn ueber Aufloesung und Skalierung, wenn er umgesteckt wurde', () => {
    const umgesteckt = { ...tv, id: 999, label: '\\\\.\\DISPLAY4' }
    expect(passendenMonitorWaehlen(tv, [arbeit, umgesteckt])).toBe(umgesteckt)
  })

  it('meldet nichts, wenn der Monitor gar nicht da ist', () => {
    expect(passendenMonitorWaehlen(tv, [arbeit])).toBeNull()
  })

  it('meldet nichts, wenn zwei gleiche Monitore in Frage kommen', () => {
    // Zwei baugleiche Fernseher an verschiedenen Anschluessen: raten waere
    // schlimmer als warten - der Player-Screen laege sonst zufaellig richtig
    // oder falsch.
    const einer = { ...tv, id: 1, label: '\\\\.\\DISPLAY7' }
    const anderer = { ...tv, id: 2, label: '\\\\.\\DISPLAY8' }
    expect(passendenMonitorWaehlen(tv, [einer, anderer])).toBeNull()
  })

  it('meldet nichts ohne gespeicherte Kennung oder ohne angeschlossene Monitore', () => {
    expect(passendenMonitorWaehlen(null, [tv])).toBeNull()
    expect(passendenMonitorWaehlen(tv, [])).toBeNull()
  })

  it('nimmt eine leere Beschriftung nicht als Treffer', () => {
    // Unter manchen Systemen ist label leer. Dann duerfen nicht alle
    // Monitore auf einmal "derselbe Anschluss" sein.
    const ohneLabel = { ...tv, label: '' }
    const andererOhneLabel = { ...arbeit, label: '' }
    expect(passendenMonitorWaehlen(ohneLabel, [andererOhneLabel])).toBeNull()
  })
})

describe('kennungEinlesen', () => {
  it('liest eine vollstaendige Kennung', () => {
    expect(kennungEinlesen({ ...tv })).toEqual(tv)
  })

  it('verwirft eine halbe Kennung - sie fuehrt zu falschen Treffern', () => {
    expect(kennungEinlesen({ id: 1, label: 'x', breite: 1920 })).toBeNull()
    expect(kennungEinlesen({ ...tv, skalierung: 'gross' })).toBeNull()
    expect(kennungEinlesen({ ...tv, id: 1.5 })).toBeNull()
    expect(kennungEinlesen(null)).toBeNull()
    expect(kennungEinlesen([])).toBeNull()
    expect(kennungEinlesen('DISPLAY1')).toBeNull()
  })
})
