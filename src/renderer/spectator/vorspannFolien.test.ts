import { describe, expect, it } from 'vitest'
import {
  KONTAKT,
  LEISTUNGEN,
  PARTNER,
  SIGNAL_HALTEN_MS,
  SIGNAL_LAGE,
  TAKT_MS,
  VORSPANN_FOLIEN,
  haltenMsVon,
  lageVon,
} from './vorspannFolien'

describe('Vorspann-Folien', () => {
  it('fuehrt die acht Leistungen im freigegebenen Wortlaut und in fester Reihenfolge', () => {
    expect(LEISTUNGEN.map((l) => [l.zeilen, l.unterzeile ?? null])).toEqual([
      [['Netzwerk', 'infrastruktur'], null],
      [['Glasfaser'], 'Internetanbindung'],
      [['Video', 'überwachung'], null],
      [['Hosting'], 'Betrieb auf eigener Infrastruktur in deutschen Rechenzentren'],
      [['Monitoring'], 'Cloudflare Zero Trust · SSH Bastion'],
      [['Backup'], null],
      [['Support und', 'Störungsannahme'], null],
      [['Windows-', 'Lizenzen'], null],
    ])
  })

  it('setzt nach jeder Leistung die Zwischenfolie', () => {
    expect(VORSPANN_FOLIEN).toHaveLength(16)
    VORSPANN_FOLIEN.forEach((folie, i) => {
      expect(folie.art, `Folie ${i}`).toBe(i % 2 === 0 ? 'leistung' : 'signal')
    })
  })

  it('bebildert genau Netzwerkinfrastruktur, Glasfaser und Hosting', () => {
    expect(LEISTUNGEN.filter((l) => l.foto !== undefined).map((l) => [l.zeilen[0], l.foto])).toEqual([
      ['Netzwerk', 'patchpanel'],
      ['Glasfaser', 'switch'],
      ['Hosting', 'server'],
    ])
  })

  it('laesst Leistungen 6,5 s und die Zwischenfolie 2,4 s stehen', () => {
    expect(TAKT_MS).toBe(6500)
    expect(SIGNAL_HALTEN_MS).toBe(2400)
    expect(haltenMsVon(LEISTUNGEN[0]!)).toBe(6500)
    expect(haltenMsVon({ art: 'signal' })).toBe(2400)
  })

  it('gibt jeder Leistung eine eigene Lage des Verlaufs', () => {
    const lagen = new Set(LEISTUNGEN.map((l) => JSON.stringify(l.lage)))
    expect(lagen.size).toBe(8)
    expect(lageVon({ art: 'signal' })).toEqual(SIGNAL_LAGE)
    expect(lageVon(LEISTUNGEN[3]!)).toEqual(LEISTUNGEN[3]!.lage)
  })

  it('fuehrt Partner und Kontakt unveraendert', () => {
    expect(PARTNER).toEqual(['Cisco', 'Juniper', 'TP-Link', 'Ubiquiti', 'Backblaze'])
    expect(KONTAKT).toBe('jgnet.eu · hey@bsbnet.eu · +49 5222 9179070')
  })
})
