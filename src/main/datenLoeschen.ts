// "Alle lokalen Daten loeschen" (Control-Fenster, siehe PRIVACY.md Abschnitt 5
// und Design-Spec Abschnitt 18.3/18.4). Entfernt alles, was die Anwendung
// selbst unter app.getPath('userData') ablegt: die Konfiguration, die
// verschluesselte Anmelde-Ablage (src/autodarts/oauth.ts, ablagePfad()), den
// gespeicherten Matchtag, den Aufzeichnungsordner und die
// OAuth-Sitzungspartition (Befund 2 - liegt unter
// Partitions/ und blieb bisher liegen, wodurch ueberlebende Cookies den
// Nutzer nach "alle Daten geloescht" beim naechsten Anmeldeversuch still
// wieder angemeldet haetten). Kein Import von 'electron' auf Modulebene,
// damit diese Datei sich testen liesse, ohne eine laufende Electron-Runtime
// zu brauchen (gleiches Muster wie in konfiguration.ts und oauth.ts).

import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { SITZUNGSPARTITION } from '../autodarts/oauth'

const KONFIGURATIONS_DATEI = 'config.json'
const ANMELDE_ABLAGE = 'anmeldung.bin'
// Der Matchtag traegt Spielernamen und Ergebnisse eines Abends - die
// gehoeren zu "alle lokalen Daten" und muessen mit weg.
const MATCHTAG_DATEI = 'matchtag.json'
const AUFZEICHNUNGS_ORDNER = 'recordings'
const PARTITIONS_ORDNER = 'Partitions'
// Electron legt Sitzungspartitionen unter <userData>/Partitions/<name ohne
// das "persist:"-Praefix> ab.
const SITZUNGS_ORDNER = SITZUNGSPARTITION.replace(/^persist:/, '')

/**
 * Loescht alle lokal abgelegten Daten der Anwendung und liefert, was davon
 * tatsaechlich vorhanden war und entfernt wurde - fehlende Dateien/Ordner
 * werden nicht als "geloescht" gemeldet, damit die Rueckmeldung im
 * Control-Fenster wahr bleibt.
 */
export async function alleDatenLoeschen(): Promise<string[]> {
  const { app, session } = await import('electron')
  const basis = app.getPath('userData')
  const geloescht: string[] = []

  for (const datei of [KONFIGURATIONS_DATEI, ANMELDE_ABLAGE, MATCHTAG_DATEI]) {
    const pfad = join(basis, datei)
    if (existsSync(pfad)) {
      await rm(pfad, { force: true })
      geloescht.push(datei)
    }
  }

  const aufzeichnungenPfad = join(basis, AUFZEICHNUNGS_ORDNER)
  if (existsSync(aufzeichnungenPfad)) {
    await rm(aufzeichnungenPfad, { recursive: true, force: true })
    geloescht.push(`${AUFZEICHNUNGS_ORDNER}/`)
  }

  const sitzungsPfad = join(basis, PARTITIONS_ORDNER, SITZUNGS_ORDNER)
  if (existsSync(sitzungsPfad)) {
    // clearStorageData() statt rm(): die Partition ist eine laufend von
    // Electron verwaltete Ablage, kein von der Anwendung selbst erzeugter
    // Ordner - genau der Weg, den abmelden() in oauth.ts fuer denselben
    // Zweck bereits geht.
    await session.fromPartition(SITZUNGSPARTITION).clearStorageData()
    geloescht.push(`${PARTITIONS_ORDNER}/${SITZUNGS_ORDNER}/`)
  }

  return geloescht
}
