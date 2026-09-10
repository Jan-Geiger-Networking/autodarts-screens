// Selbstaktualisierung ueber GitHub-Releases (Spec Abschnitt 13).
//
// Kein Import von 'electron' oder 'electron-updater' auf Modulebene:
// aktualisierung.test.ts laedt diese Datei unter Vitest ohne laufende
// Electron-Runtime. Die reinen Funktionen (betasErlaubt, changelogAbschnitt,
// fehlerZuMeldung) sind deshalb ohne Electron pruefbar; alles, was den
// Updater selbst braucht, holt ihn erst zur Laufzeit per dynamischem Import -
// gleiches Muster wie in konfiguration.ts.
//
// Drei Eigenheiten dieses Projekts bestimmen die Einstellungen und sind je
// einzeln in electron-updater belegt:
//
//  1. Alle bisherigen Veroeffentlichungen sind Vorabversionen. Der GitHub-
//     Anbieter ueberspringt Vorabversionen, solange allowPrerelease nicht
//     gesetzt ist - die Suche liefe, faende nichts und meldete "aktuell".
//     Welcher Kanal gilt, entscheidet der Herausgeber (Konfigurationsfeld
//     betaKanal); ohne eigene Wahl richtet es sich nach der laufenden
//     Version, siehe betasErlaubt().
//  2. Der Installer ist unsigniert. electron-updater prueft die
//     Authenticode-Signatur einer geladenen Aktualisierung, sobald ein
//     Herausgebername in app-update.yml steht (win.verifyUpdateCodeSignature,
//     Vorgabe true). Ohne Zertifikat gibt es keinen solchen Namen und nichts
//     zu pruefen - die Option ist in package.json deshalb ausdruecklich auf
//     false gesetzt, statt sich auf ein leeres Feld zu verlassen.
//  3. Der Rechner am Board laeuft tagelang durch. Eine Pruefung nur beim
//     Start wuerde eine Woche lang keine Aktualisierung finden; deshalb
//     zusaetzlich ein fester Takt und eine Pruefung, wenn der Rechner aus
//     dem Ruhezustand zurueckkommt.

import type { AppUpdater } from 'electron-updater'
import { protokollieren } from '../autodarts/diagnose'
import { aktualisierungszustandVerteilen } from './fenster'
import { konfigurationLesen } from './konfiguration'
import { matchLaeuft } from './verbindung'

/**
 * Was die Anwendung ueber den Stand der Selbstaktualisierung weiss. Wandert
 * unveraendert bis ins Control-Fenster - jede Meldung dort stammt aus genau
 * einem dieser Faelle, es gibt keinen stillen Zustand.
 */
export type Aktualisierungszustand =
  /** Kein Updater aktiv - im Entwicklungsmodus, weil eine ungepackte Anwendung sich nicht selbst ersetzen kann. */
  | { art: 'aus'; grund: string }
  /** Updater bereit, aber noch nichts geprueft. */
  | { art: 'ruht' }
  | { art: 'suche' }
  | { art: 'aktuell'; geprueft: number }
  | { art: 'gefunden'; version: string }
  | { art: 'laedt'; version: string; prozent: number }
  /** Heruntergeladen und geprueft; die Installation laeuft beim Beenden der Anwendung. */
  | { art: 'bereit'; version: string }
  | { art: 'fehler'; meldung: string }

/** Fester Takt zwischen zwei Pruefungen. Sechs Stunden: haeufig genug fuer
 * einen Rechner, der wochenlang durchlaeuft, selten genug, um niemandem
 * aufzufallen. */
const PRUEFTAKT_MS = 6 * 60 * 60 * 1000

let zustand: Aktualisierungszustand = { art: 'ruht' }
let updaterInstanz: AppUpdater | null = null
let taktGesetzt = false
/** Verhindert, dass eine zweite Pruefung eine laufende ueberholt. */
let laufendePruefung: Promise<void> | null = null

/**
 * Entscheidet, ob Vorabversionen angeboten werden.
 *
 * `betaKanal` ist die Wahl des Herausgebers im Control-Fenster. `null` heisst
 * "nicht entschieden": dann richtet es sich nach der laufenden Version. Wer
 * eine Beta einsetzt, will die naechste Beta; wer eine stabile Version
 * einsetzt, will nicht ungefragt auf eine Beta wechseln. Nach Semantic
 * Versioning ist jede Version mit Bindestrich eine Vorabversion
 * (0.1.0-beta.4 ja, 0.1.0 nein) - dieselbe Regel wie im Release-Workflow.
 */
export function betasErlaubt(betaKanal: boolean | null, laufendeVersion: string): boolean {
  if (typeof betaKanal === 'boolean') return betaKanal
  return laufendeVersion.includes('-')
}

/**
 * Schneidet den Abschnitt einer Version aus dem Changelog heraus - alles
 * zwischen ihrer eigenen Ueberschrift und der naechsten Versionsueberschrift.
 * Gibt null zurueck, wenn die Version dort nicht vorkommt (z.B. eine von Hand
 * gebaute Zwischenversion); dann zeigt das Control-Fenster nichts, statt
 * einen falschen Abschnitt anzuzeigen.
 */
export function changelogAbschnitt(text: string, version: string): string | null {
  const zeilen = text.split(/\r?\n/)
  const beginn = zeilen.findIndex((z) => z.startsWith(`## [${version}]`))
  if (beginn === -1) return null
  const rest = zeilen.slice(beginn + 1)
  const ende = rest.findIndex((z) => z.startsWith('## ['))
  const abschnitt = (ende === -1 ? rest : rest.slice(0, ende)).join('\n').trim()
  return abschnitt === '' ? null : abschnitt
}

/**
 * Uebersetzt einen Updater-Fehler in einen Satz, der im Control-Fenster
 * stehen kann. Der vollstaendige Fehler geht immer zusaetzlich ins
 * Diagnoseprotokoll - hier steht nur, was der Herausgeber daraus machen kann.
 *
 * Der haeufigste Fall hat nichts mit einem Defekt zu tun: sind ausschliesslich
 * Vorabversionen veroeffentlicht und der stabile Kanal eingestellt, findet
 * GitHub unter "latest release" nichts. Das ist eine Einstellungsfrage, keine
 * Stoerung, und wird auch so benannt.
 */
export function fehlerZuMeldung(fehler: unknown): string {
  const roh = fehler instanceof Error ? fehler.message : String(fehler)
  // Belegt an der eigenen Veroeffentlichung v0.1.0-beta.4: der Updater findet
  // die Version, aber keine latest.yml daneben - die haengt erst seit
  // 0.1.0-beta.5 am Release. Ohne diesen Fall staende im Control-Fenster ein
  // englischer Rohtext, der wie ein Defekt aussieht.
  if (/latest\.yml/i.test(roh)) {
    return 'Die gefundene Version bringt keine Aktualisierungsdaten mit. Versionen vor 0.1.0-beta.5 lassen sich nicht selbst aktualisieren — diese eine muss von Hand installiert werden.'
  }
  if (/Unable to find latest version|No published versions|404/i.test(roh)) {
    return 'Keine passende Version gefunden. Wenn nur Beta-Versionen veröffentlicht sind, muss dafür der Beta-Kanal eingeschaltet sein.'
  }
  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|ENETUNREACH|net::/i.test(roh)) {
    return 'Keine Verbindung zu GitHub. Die Suche läuft beim nächsten Versuch von selbst weiter.'
  }
  if (/ERR_UPDATER_INVALID_TAG|sha512|checksum/i.test(roh)) {
    return 'Die heruntergeladene Datei passt nicht zur angekündigten Version und wurde verworfen.'
  }
  return `Aktualisierung fehlgeschlagen: ${roh}`
}

function zustandSetzen(neu: Aktualisierungszustand): void {
  zustand = neu
  aktualisierungszustandVerteilen(neu)
}

/** Aktueller Stand - fuer das Control-Fenster, das beim Oeffnen nachfragt,
 * statt auf die naechste Meldung zu warten. */
export function aktualisierungszustand(): Aktualisierungszustand {
  return zustand
}

/**
 * Holt den Updater und richtet ihn genau einmal ein. Gibt null zurueck, wenn
 * es nichts zu aktualisieren gibt - im Entwicklungsmodus ersetzt sich eine
 * ungepackte Anwendung nicht selbst, und ein Updater, der dort laeuft, meldet
 * nur Fehler.
 */
async function updater(): Promise<AppUpdater | null> {
  if (updaterInstanz) return updaterInstanz

  const { app } = await import('electron')
  if (!app.isPackaged) {
    zustandSetzen({ art: 'aus', grund: 'Entwicklungsmodus — eine ungepackte Anwendung aktualisiert sich nicht selbst' })
    return null
  }

  // Standardimport statt benannter Einfuhr: electron-updater ist ein
  // CommonJS-Modul, der Hauptprozess laeuft als ES-Modul. Node leitet
  // benannte Ausfuhren aus CommonJS nur her, wenn es sie im Quelltext
  // erkennt - bei electron-updater sind es Getter, die dabei durchfallen.
  const { autoUpdater } = (await import('electron-updater')).default

  autoUpdater.autoDownload = true
  // Installiert beim Beenden (Spec Abschnitt 13) - nie mitten in einem Match,
  // denn waehrend eines Matches beendet niemand die Anwendung.
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = {
    info: (m: unknown) => void protokollieren(`Updater: ${String(m)}`),
    warn: (m: unknown) => void protokollieren(`Updater-Warnung: ${String(m)}`),
    // Nur die erste Zeile: electron-updater reicht ganze Fehlerobjekte
    // durch, deren Stapel das Protokoll fuellt, ohne etwas zu erklaeren.
    error: (m: unknown) => void protokollieren(`Updater-Fehler: ${String(m).split('\n')[0]}`),
    debug: () => {},
  }

  autoUpdater.on('checking-for-update', () => zustandSetzen({ art: 'suche' }))
  autoUpdater.on('update-available', (info) => zustandSetzen({ art: 'gefunden', version: info.version }))
  autoUpdater.on('update-not-available', () => zustandSetzen({ art: 'aktuell', geprueft: Date.now() }))
  autoUpdater.on('download-progress', (fortschritt) =>
    zustandSetzen({
      art: 'laedt',
      version: zustand.art === 'gefunden' || zustand.art === 'laedt' ? zustand.version : app.getVersion(),
      prozent: Math.max(0, Math.min(100, Math.round(fortschritt.percent))),
    }),
  )
  autoUpdater.on('update-downloaded', (info) => zustandSetzen({ art: 'bereit', version: info.version }))
  autoUpdater.on('error', (fehler) => {
    void protokollieren(`Updater meldet Fehler: ${fehler instanceof Error ? fehler.message : String(fehler)}`)
    zustandSetzen({ art: 'fehler', meldung: fehlerZuMeldung(fehler) })
  })

  updaterInstanz = autoUpdater
  return autoUpdater
}

async function pruefen(): Promise<void> {
  const auto = await updater()
  if (!auto) return

  try {
    const { app } = await import('electron')
    const konfiguration = await konfigurationLesen()
    const betas = betasErlaubt(konfiguration.betaKanal, app.getVersion())
    // Vor jeder Suche neu gesetzt, nicht nur beim Einrichten: der Herausgeber
    // kann den Kanal zur Laufzeit umstellen, und die naechste Suche soll
    // sofort danach gehen.
    auto.allowPrerelease = betas
    await protokollieren(`Aktualisierungssuche gestartet (Beta-Versionen ${betas ? 'erlaubt' : 'ausgeschlossen'})`)
    await auto.checkForUpdates()
  } catch (fehler) {
    // checkForUpdates() lehnt zusaetzlich zum 'error'-Ereignis ab. Beide Wege
    // fuehren zur selben Meldung; doppelt gesetzt zu werden schadet nicht,
    // gar nicht gesetzt zu werden waere ein stiller Fehlschlag.
    void protokollieren(
      `Aktualisierungssuche fehlgeschlagen: ${fehler instanceof Error ? fehler.message : String(fehler)}`,
    )
    zustandSetzen({ art: 'fehler', meldung: fehlerZuMeldung(fehler) })
  }
}

/**
 * Sucht einmal nach einer Aktualisierung. Ein Fehler bleibt hier - er landet
 * im Zustand und im Protokoll, wirft aber nie nach aussen: eine
 * fehlgeschlagene Suche darf weder den Start noch ein laufendes Match stoeren.
 *
 * Zwei gleichzeitige Aufrufe (fester Takt und Knopf im Control-Fenster im
 * selben Moment) fuehren zu einer einzigen Suche - gleiches
 * Single-Flight-Muster wie bei Anmeldung und Verbindungsaufbau.
 */
export async function aktualisierungSuchen(): Promise<void> {
  if (laufendePruefung) return laufendePruefung
  laufendePruefung = pruefen().finally(() => {
    laufendePruefung = null
  })
  return laufendePruefung
}

/**
 * Startet die Selbstaktualisierung: eine Suche jetzt, danach im festen Takt,
 * und eine zusaetzliche, sobald der Rechner aus dem Ruhezustand
 * zurueckkommt. Mehrfacher Aufruf richtet den Takt nur einmal ein.
 */
export async function aktualisierungStarten(): Promise<void> {
  if (!taktGesetzt) {
    taktGesetzt = true
    // unref(): ein laufender Timer soll den Prozess beim Beenden nicht
    // aufhalten.
    setInterval(() => void aktualisierungSuchen(), PRUEFTAKT_MS).unref()
    // Ein Rechner am Board schlaeft ueber Nacht und wacht ohne Netzwerk auf.
    // Die Suche direkt beim Aufwachen scheitert dann, die naechste im Takt
    // faengt das auf - deshalb hier kein eigener Wiederholungsversuch.
    const { powerMonitor } = await import('electron')
    powerMonitor.on('resume', () => void aktualisierungSuchen())
  }
  await aktualisierungSuchen()
}

/**
 * Installiert eine bereits heruntergeladene Aktualisierung sofort und startet
 * die Anwendung neu. Ausdruecklicher Wunsch des Herausgebers per Knopf - der
 * Normalfall bleibt die Installation beim Beenden.
 *
 * Waehrend eines laufenden Matches wird abgelehnt: ein Neustart mitten im
 * Spiel nimmt beiden Bildschirmen den Stand, und der laesst sich nicht
 * zurueckholen (Spec Abschnitt 13: "nie waehrend eines laufenden Matches").
 */
export async function aktualisierungInstallieren(): Promise<{ erfolg: boolean; meldung?: string }> {
  if (zustand.art !== 'bereit') {
    return { erfolg: false, meldung: 'Es liegt keine fertig heruntergeladene Aktualisierung bereit.' }
  }
  if (matchLaeuft()) {
    return {
      erfolg: false,
      meldung: 'Es läuft ein Match. Die Aktualisierung wird beim Beenden der Anwendung von selbst installiert.',
    }
  }
  const auto = await updater()
  if (!auto) return { erfolg: false, meldung: 'Keine Selbstaktualisierung im Entwicklungsmodus.' }

  await protokollieren(`Aktualisierung wird auf Wunsch sofort installiert: ${zustand.version}`)
  // Die offene Verbindung zuerst sauber schliessen (wartet auf das Ende einer
  // laufenden Aufzeichnung, siehe verbindung.ts) - quitAndInstall beendet den
  // Prozess, danach kaeme kein Aufraeumen mehr zum Zug.
  const { verbindungBeenden } = await import('./verbindung')
  await verbindungBeenden()
  auto.quitAndInstall(false, true)
  return { erfolg: true }
}
