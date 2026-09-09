// "Alle lokalen Daten loeschen" (Control-Fenster, siehe PRIVACY.md Abschnitt 5
// und Design-Spec Abschnitt 18.3/18.4). Entfernt alles, was die Anwendung
// selbst unter app.getPath('userData') ablegt: die Konfiguration, die
// verschluesselte Anmelde-Ablage (src/autodarts/oauth.ts, ablagePfad()) und
// den Aufzeichnungsordner. Kein Import von 'electron' auf Modulebene, damit
// diese Datei sich testen liesse, ohne eine laufende Electron-Runtime zu
// brauchen (gleiches Muster wie in konfiguration.ts und oauth.ts).

import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'

const KONFIGURATIONS_DATEI = 'config.json'
const ANMELDE_ABLAGE = 'anmeldung.bin'
const AUFZEICHNUNGS_ORDNER = 'recordings'

/**
 * Loescht alle lokal abgelegten Daten der Anwendung und liefert, was davon
 * tatsaechlich vorhanden war und entfernt wurde - fehlende Dateien/Ordner
 * werden nicht als "geloescht" gemeldet, damit die Rueckmeldung im
 * Control-Fenster wahr bleibt.
 */
export async function alleDatenLoeschen(): Promise<string[]> {
  const { app } = await import('electron')
  const basis = app.getPath('userData')
  const geloescht: string[] = []

  for (const datei of [KONFIGURATIONS_DATEI, ANMELDE_ABLAGE]) {
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

  return geloescht
}
