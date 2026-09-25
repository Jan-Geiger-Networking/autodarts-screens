// Spieler-Verwaltung: merkt sich jeden Spieler, der in einem Match auftaucht,
// und haelt je Spieler ein Profilbild, das im Control-Fenster zugeschnitten
// wird. Liegt als spieler.json unter userData - nur auf diesem Rechner, das
// Repository ist oeffentlich und bekommt davon nichts zu sehen.
//
// Schluessel ist der Autodarts-Name: eine Spieler-ID fuehrt Autodarts nicht
// verlaesslich (siehe Spieler-Abschnitt in adapter.ts, dort ist sie ein
// Index), der Name dagegen bleibt von Match zu Match gleich.
//
// Kein Import von 'electron' auf Modulebene, damit spielerDienst.test.ts die
// reinen Funktionen ohne Electron-Runtime pruefen kann (gleiches Muster wie
// konfiguration.ts).

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { MatchState, Player } from '../shared/typen'
import { protokollieren } from '../autodarts/diagnose'
import { spielerVerteilen } from './fenster'

export type SpielerProfil = {
  name: string
  /** Zugeschnittenes Bild als data:-Adresse, oder null. */
  foto: string | null
}

/**
 * Obergrenze fuer ein Bild. Das Control-Fenster liefert 256x256 als JPEG,
 * das sind rund 20 bis 40 KB - die Grenze faengt nur Unsinn ab, denn das Bild
 * reist mit jeder Zustandsmeldung an alle Fenster.
 */
const FOTO_MAX_ZEICHEN = 300_000

export function fotoGueltig(wert: unknown): wert is string {
  return (
    typeof wert === 'string' &&
    wert.length <= FOTO_MAX_ZEICHEN &&
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(wert)
  )
}

function schluessel(name: string): string {
  return name.trim().toLowerCase()
}

/** Liest eine Spielerliste aus ungeprueftem JSON; Ungueltiges faellt weg. */
export function spielerEinlesen(roh: unknown): SpielerProfil[] {
  if (!Array.isArray(roh)) return []
  const gesehen = new Set<string>()
  const liste: SpielerProfil[] = []
  for (const eintrag of roh) {
    if (typeof eintrag !== 'object' || eintrag === null) continue
    const { name, foto } = eintrag as Record<string, unknown>
    if (typeof name !== 'string' || name.trim() === '' || gesehen.has(schluessel(name))) continue
    gesehen.add(schluessel(name))
    liste.push({ name: name.trim(), foto: fotoGueltig(foto) ? foto : null })
  }
  return liste
}

/** Traegt die gespeicherten Bilder in die Spieler eines Zustands ein. */
export function fotosEintragen(zustand: MatchState, liste: readonly SpielerProfil[]): MatchState {
  if (zustand.players.length === 0) return zustand
  const fotos = new Map(liste.map((p) => [schluessel(p.name), p.foto]))
  const players: Player[] = zustand.players.map((spieler) => {
    const foto = fotos.get(schluessel(spieler.autodartsName))
    return foto ? { ...spieler, photoPath: foto } : spieler
  })
  return { ...zustand, players }
}

/** Namen aus einem Zustand, die noch nicht in der Liste stehen. */
export function neueNamen(zustand: MatchState, liste: readonly SpielerProfil[]): string[] {
  const bekannt = new Set(liste.map((p) => schluessel(p.name)))
  const neue = new Map<string, string>()
  for (const spieler of zustand.players) {
    const name = spieler.autodartsName.trim()
    // "Spieler 3" ist der Platzhalter des Adapters, wenn Autodarts keinen
    // Namen schickt - der gehoert nicht in die Liste.
    if (name === '' || /^Spieler \d+$/.test(name) || bekannt.has(schluessel(name))) continue
    if (!neue.has(schluessel(name))) neue.set(schluessel(name), name)
  }
  return [...neue.values()]
}

let profile: SpielerProfil[] = []

async function speicherPfad(): Promise<string> {
  const { app } = await import('electron')
  return join(app.getPath('userData'), 'spieler.json')
}

export async function spielerLaden(): Promise<void> {
  try {
    profile = spielerEinlesen(JSON.parse(await readFile(await speicherPfad(), 'utf-8')))
  } catch {
    // Datei fehlt oder ist kaputt: leere Liste statt Absturz.
    profile = []
  }
}

export function spielerListe(): SpielerProfil[] {
  return profile
}

async function speichern(): Promise<void> {
  spielerVerteilen(profile)
  try {
    await writeFile(await speicherPfad(), JSON.stringify(profile, null, 2), 'utf-8')
  } catch (fehler) {
    void protokollieren(`spieler.json liess sich nicht schreiben: ${fehler instanceof Error ? fehler.message : String(fehler)}`)
  }
}

/**
 * Merkt sich neue Spieler aus einem Zustand und liefert den Zustand mit den
 * gespeicherten Bildern zurueck. Laeuft bei jeder Zustandsmeldung.
 */
export function spielerAusZustand(zustand: MatchState): MatchState {
  const neue = neueNamen(zustand, profile)
  if (neue.length > 0) {
    profile = [...profile, ...neue.map((name) => ({ name, foto: null }))]
    void speichern()
  }
  return fotosEintragen(zustand, profile)
}

export async function fotoSetzen(name: unknown, foto: unknown): Promise<SpielerProfil[]> {
  if (typeof name !== 'string') throw new Error('Spielername fehlt')
  if (foto !== null && !fotoGueltig(foto)) throw new Error('Ungueltiges Bild')
  profile = profile.map((p) => (schluessel(p.name) === schluessel(name) ? { ...p, foto } : p))
  await speichern()
  return profile
}

export async function spielerEntfernen(name: unknown): Promise<SpielerProfil[]> {
  if (typeof name !== 'string') throw new Error('Spielername fehlt')
  profile = profile.filter((p) => schluessel(p.name) !== schluessel(name))
  await speichern()
  return profile
}

/** Nach "Alle lokalen Daten loeschen": auch das Gedaechtnis leeren. */
export function spielerVergessen(): void {
  profile = []
  spielerVerteilen(profile)
}
