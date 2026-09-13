// Die Folien des Vorspanns: Wortlaut, Reihenfolge, Standzeiten, Bebilderung.
//
// Wortlaut der Leistungsfolien stammt ausschliesslich aus der
// Anbieterkennzeichnung des Herausgebers und den Geschaeftsfeldern seiner
// eigenen Website (jgnet.eu) - keine Werbeversprechen, keine Zahlen, nichts
// hinzuerfunden. QInfo und WindowsTools bleiben aussen vor
// (erklaerungsbeduerftig ohne Kontext), Downtimes ist eine Statusseite und
// keine Leistung.
//
// Eigene Datei ohne Bild-Importe, damit Wortlaut und Zuordnung ohne Vite
// pruefbar sind - dieselbe Trennung wie matchtagFolien.ts und Matchtag.tsx.
// Die Bilddateien ordnet Vorspann.tsx den Foto-Schluesseln zu.

import type { VerlaufLage } from './KinoBuehne'

/** Standzeit einer Leistungsfolie. */
export const TAKT_MS = 6500
/** Kurzer Atemzug der Zwischenfolie zwischen zwei Leistungen. */
export const SIGNAL_HALTEN_MS = 2400

/** Schriftstufe nach laengster Zeile, von Hand vergeben. */
export type Groesse = 'riesig' | 'gross' | 'kompakt'
export type FotoSchluessel = 'patchpanel' | 'switch' | 'server'

export type Leistungsfolie = {
  art: 'leistung'
  /** 1-2 Zeilen; lange Woerter brechen von Hand an einer sinnvollen Stelle um. */
  zeilen: string[]
  groesse: Groesse
  unterzeile?: string
  /** Ohne Foto steht die Folie auf dem Verlauf der Buehne. */
  foto?: FotoSchluessel
  /** Wo der Verlauf auf dieser Folie sitzt - je Folie anders. */
  lage: VerlaufLage
}

/** Die Zwischenfolie traegt keine eigenen Daten - ihr Inhalt ist immer derselbe. */
export type Signalfolie = { art: 'signal' }

export type VorspannFolie = Leistungsfolie | Signalfolie

export const LEISTUNGEN: Leistungsfolie[] = [
  {
    art: 'leistung',
    zeilen: ['Netzwerk', 'infrastruktur'],
    groesse: 'kompakt',
    foto: 'patchpanel',
    lage: { centerX: -0.2, centerY: 0.1, blendAngle: 0 },
  },
  {
    art: 'leistung',
    zeilen: ['Glasfaser'],
    groesse: 'gross',
    unterzeile: 'Internetanbindung',
    foto: 'switch',
    lage: { centerX: 0.2, centerY: -0.1, blendAngle: 35 },
  },
  {
    art: 'leistung',
    zeilen: ['Video', 'überwachung'],
    groesse: 'gross',
    lage: { centerX: -0.25, centerY: -0.15, blendAngle: 70 },
  },
  {
    art: 'leistung',
    zeilen: ['Hosting'],
    groesse: 'riesig',
    unterzeile: 'Betrieb auf eigener Infrastruktur in deutschen Rechenzentren',
    foto: 'server',
    lage: { centerX: 0.15, centerY: 0.2, blendAngle: 110 },
  },
  {
    art: 'leistung',
    zeilen: ['Monitoring'],
    groesse: 'gross',
    unterzeile: 'Cloudflare Zero Trust · SSH Bastion',
    lage: { centerX: 0.3, centerY: 0.05, blendAngle: 150 },
  },
  {
    art: 'leistung',
    zeilen: ['Backup'],
    groesse: 'riesig',
    lage: { centerX: -0.1, centerY: 0.25, blendAngle: 200 },
  },
  {
    art: 'leistung',
    zeilen: ['Support und', 'Störungsannahme'],
    groesse: 'kompakt',
    lage: { centerX: 0.05, centerY: -0.25, blendAngle: 250 },
  },
  {
    art: 'leistung',
    zeilen: ['Windows-', 'Lizenzen'],
    groesse: 'gross',
    lage: { centerX: -0.3, centerY: 0, blendAngle: 300 },
  },
]

/** Lage des Verlaufs auf der Zwischenfolie. */
export const SIGNAL_LAGE: VerlaufLage = { centerX: 0, centerY: 0, blendAngle: 180 }

// Wortwunsch des Herausgebers woertlich uebernommen: "zwischen den Szenen mit
// meiner Werbung bitte immer so ein es geht gleich los screen zwischenbauen" -
// deshalb nach JEDER Leistung.
export const VORSPANN_FOLIEN: VorspannFolie[] = LEISTUNGEN.flatMap((l): VorspannFolie[] => [l, { art: 'signal' }])

export function haltenMsVon(folie: VorspannFolie): number {
  return folie.art === 'signal' ? SIGNAL_HALTEN_MS : TAKT_MS
}

export function lageVon(folie: VorspannFolie): VerlaufLage {
  return folie.art === 'signal' ? SIGNAL_LAGE : folie.lage
}

// Hersteller, mit denen der Herausgeber arbeitet - als schlichte Namenszeile
// statt als Logo-Reihe: echte Hersteller-Logos ohne Zustimmung nachzubauen
// waere markenrechtlich heikel.
export const PARTNER = ['Cisco', 'Juniper', 'TP-Link', 'Ubiquiti', 'Backblaze']

/** Kontaktdaten laut Spec 2026-09-09, Abschnitt 18.4. */
export const KONTAKT = 'jgnet.eu · hey@bsbnet.eu · +49 5222 9179070'
