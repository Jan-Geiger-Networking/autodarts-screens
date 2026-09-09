import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

// Kein Import von 'electron' auf Modulebene: konfiguration.test.ts laedt diese
// Datei unter Vitest ohne laufende Electron-Runtime. standardKonfiguration und
// zusammenfuehren sind deshalb reine Funktionen. app.getPath('userData') wird
// erst innerhalb von konfigurationLesen/konfigurationSchreiben per dynamischem
// import('electron') geholt, wenn die Datei tatsaechlich im Main-Prozess laeuft.

export type Konfiguration = {
  boardId: string | null
  playerDisplayId: number | null
  spectatorDisplayId: number | null
}

export const standardKonfiguration: Konfiguration = {
  boardId: null,
  playerDisplayId: null,
  spectatorDisplayId: null,
}

// roh kommt aus einer Datei und ist deshalb ungeprueft. Unbekannte Felder
// werden verworfen, fehlende oder falsch typisierte Felder fallen auf die
// Standardkonfiguration zurueck.
export function zusammenfuehren(roh: unknown): Konfiguration {
  if (typeof roh !== 'object' || roh === null || Array.isArray(roh)) {
    return { ...standardKonfiguration }
  }
  const quelle = roh as Record<string, unknown>
  return {
    boardId: typeof quelle.boardId === 'string' ? quelle.boardId : standardKonfiguration.boardId,
    playerDisplayId:
      typeof quelle.playerDisplayId === 'number'
        ? quelle.playerDisplayId
        : standardKonfiguration.playerDisplayId,
    spectatorDisplayId:
      typeof quelle.spectatorDisplayId === 'number'
        ? quelle.spectatorDisplayId
        : standardKonfiguration.spectatorDisplayId,
  }
}

async function konfigurationsPfad(): Promise<string> {
  const { app } = await import('electron')
  return join(app.getPath('userData'), 'config.json')
}

export async function konfigurationLesen(): Promise<Konfiguration> {
  try {
    const inhalt = await readFile(await konfigurationsPfad(), 'utf-8')
    return zusammenfuehren(JSON.parse(inhalt))
  } catch {
    // Datei fehlt, ist nicht lesbar oder kein gueltiges JSON: Standardkonfiguration
    // statt Absturz.
    return { ...standardKonfiguration }
  }
}

export async function konfigurationSchreiben(k: Konfiguration): Promise<void> {
  await writeFile(await konfigurationsPfad(), JSON.stringify(k, null, 2), 'utf-8')
}
