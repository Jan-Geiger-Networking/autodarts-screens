// Haelt den laufenden Matchtag, speichert ihn und verteilt ihn an die
// Fenster. Die Regeln stehen in src/shared/matchtag.ts und sind rein - hier
// liegt alles, was Nebenwirkungen hat: Datei, Zeit, Verteilung, Protokoll.
//
// Gespeichert wird lokal in matchtag.json neben der Konfiguration ("die
// userdaten wer wie viele punkte hat also die match statistiken muessen wir
// local speichern"). Die Datei ueberlebt einen Neustart mitten im Turnier -
// ein Absturz oder eine Aktualisierung darf einen Abend nicht loeschen.
//
// Kein Import von 'electron' auf Modulebene: dieselbe Regel wie in
// konfiguration.ts, damit die Datei unter Vitest ohne Electron-Runtime
// ladbar bleibt.

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { matchtagVerteilen } from './fenster'
import { protokollieren } from '../autodarts/diagnose'
import {
  ergebnisAusZustand,
  ergebnisUebernehmen,
  letztesErgebnisZuruecknehmen,
  matchtagBeenden,
  matchtagEinlesen,
  matchtagStarten,
  naechstePaarung,
  spielerName,
  RUHENDER_MATCHTAG,
  type Matchtag,
} from '../shared/matchtag'
import type { MatchState } from '../shared/typen'

export type MatchtagBefehl =
  /** Neuen Matchtag anlegen. Das naechste Match gilt als Aufwaermrunde. */
  | { art: 'starten'; titel: string }
  /** Turnier abbrechen und zum Normalbetrieb zurueck. */
  | { art: 'beenden' }
  /** Zuletzt gewertete Partie wieder oeffnen (falsch eingerichtet, Abbruch). */
  | { art: 'zuruecknehmen' }

let aktuell: Matchtag = { ...RUHENDER_MATCHTAG }

/**
 * Kennung des zuletzt gewerteten Matches. Autodarts schickt nach dem Ende
 * weitere Momentaufnahmen desselben Matches; ohne diese Sperre liefe jede
 * davon durch die Regeln. ergebnisUebernehmen faengt das zwar selbst ab (die
 * Kennung steht in der Paarung), aber hier faellt schon das Protokollrauschen
 * weg - und eine Partie, die zu keiner Paarung passt, wird sonst bei jeder
 * Momentaufnahme erneut gemeldet.
 */
let zuletztGesehen: string | null = null

async function speicherPfad(): Promise<string> {
  const { app } = await import('electron')
  return join(app.getPath('userData'), 'matchtag.json')
}

/** Liest den gespeicherten Matchtag beim Start. Fehlt die Datei: kein Turnier. */
export async function matchtagLaden(): Promise<Matchtag> {
  try {
    const inhalt = await readFile(await speicherPfad(), 'utf-8')
    aktuell = matchtagEinlesen(JSON.parse(inhalt))
  } catch {
    // Datei fehlt, ist nicht lesbar oder kein gueltiges JSON: Ruhezustand.
    aktuell = { ...RUHENDER_MATCHTAG }
  }
  if (aktuell.phase !== 'aus') {
    const gespielt = aktuell.paarungen.filter((p) => p.siegerId !== null).length
    void protokollieren(
      `Matchtag "${aktuell.titel}" geladen: Phase ${aktuell.phase}, ${aktuell.spieler.length} Spieler, ${gespielt} von ${aktuell.paarungen.length} Partien gespielt`,
    )
  }
  matchtagVerteilen(aktuell)
  return aktuell
}

/** Der aktuelle Stand, ohne Datei- oder Netzzugriff. */
export function matchtagStand(): Matchtag {
  return aktuell
}

async function uebernehmen(neu: Matchtag): Promise<Matchtag> {
  if (neu === aktuell) return aktuell
  aktuell = neu
  matchtagVerteilen(aktuell)
  try {
    await writeFile(await speicherPfad(), JSON.stringify(aktuell, null, 2), 'utf-8')
  } catch (fehler) {
    // Der Abend laeuft weiter, auch wenn das Speichern scheitert - der Stand
    // steht im Arbeitsspeicher und auf den Bildschirmen. Nur ein Neustart
    // haette dann nichts mehr, und genau das steht dann im Protokoll.
    void protokollieren(
      `Matchtag liess sich nicht speichern: ${fehler instanceof Error ? fehler.message : String(fehler)}`,
    )
  }
  return aktuell
}

/** Fuehrt einen Befehl aus dem Control-Fenster aus. */
export async function matchtagBefehlAusfuehren(befehl: MatchtagBefehl): Promise<Matchtag> {
  switch (befehl.art) {
    case 'starten': {
      zuletztGesehen = null
      void protokollieren(`Matchtag "${befehl.titel}" gestartet - das naechste Match zaehlt als Aufwaermrunde`)
      return uebernehmen(matchtagStarten(befehl.titel, new Date().toISOString()))
    }
    case 'beenden': {
      zuletztGesehen = null
      void protokollieren('Matchtag beendet')
      return uebernehmen(matchtagBeenden())
    }
    case 'zuruecknehmen': {
      zuletztGesehen = null
      const neu = letztesErgebnisZuruecknehmen(aktuell)
      if (neu !== aktuell) void protokollieren('Letztes Matchtag-Ergebnis zurueckgenommen')
      return uebernehmen(neu)
    }
  }
}

/**
 * Bekommt jeden MatchState und wertet ein beendetes Match aus. Laeuft kein
 * Matchtag, passiert nichts - die Anwendung verhaelt sich dann wie immer.
 *
 * Bewusst hier und nicht im Adapter: der Adapter ist rein und kennt nur das
 * eine Match, das gerade laeuft. Ein Turnier ueber einen ganzen Abend ist
 * genau das Gegenteil - Zustand, der bleibt.
 */
export function matchZustandVerarbeiten(zustand: MatchState): void {
  if (aktuell.phase === 'aus' || aktuell.phase === 'beendet') return

  const ergebnis = ergebnisAusZustand(zustand)
  if (!ergebnis) return
  if (ergebnis.matchId === zuletztGesehen) return
  zuletztGesehen = ergebnis.matchId

  const vorher = aktuell
  const neu = ergebnisUebernehmen(aktuell, ergebnis, new Date().toISOString())
  if (neu === vorher) {
    void protokollieren(
      `Matchtag: Match ${ergebnis.matchId} (${ergebnis.spieler.map((s) => s.name).join(' gegen ')}) passt zu keiner offenen Paarung - nicht gewertet`,
    )
    return
  }

  if (vorher.phase === 'aufwaermen') {
    void protokollieren(
      `Matchtag: Aufwaermrunde uebernommen, ${neu.spieler.length} Spieler, ${neu.paarungen.length} Partien im Spielplan`,
    )
  } else {
    const verlierer = ergebnis.spieler.find((s) => s.id !== ergebnis.siegerId)?.name ?? '?'
    void protokollieren(`Matchtag: ${spielerName(neu, ergebnis.siegerId ?? '')} gewinnt gegen ${verlierer}`)
  }
  if (neu.phase === 'stechen') void protokollieren(`Matchtag: Gleichstand an der Spitze - Stechen ${neu.stechenRunde}`)
  if (neu.phase === 'beendet') void protokollieren(`Matchtag entschieden: ${spielerName(neu, neu.siegerId ?? '')}`)

  const naechste = naechstePaarung(neu)
  if (naechste) {
    void protokollieren(
      `Matchtag: naechste Partie ${spielerName(neu, naechste.aId)} gegen ${spielerName(neu, naechste.bId)}`,
    )
  }

  void uebernehmen(neu)
}
