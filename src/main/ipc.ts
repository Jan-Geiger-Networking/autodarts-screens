// IPC-Kanaele zwischen Main- und Renderer-Prozessen. Enthaelt nur Kanaele,
// die heute eine echte Implementierung haben.

import { app, BrowserWindow, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { FensterArt } from '../shared/typen'
import {
  aktualisierungInstallieren,
  aktualisierungSuchen,
  aktualisierungszustand,
  changelogAbschnitt,
  type Aktualisierungszustand,
} from './aktualisierung'
import { kennungFuer, monitoreAuflisten, monitoreIdentifizieren } from './monitore'
import { screen } from 'electron'
import { konfigurationLesen, konfigurationSchreiben, zusammenfuehren, type Konfiguration } from './konfiguration'
import { fensterArtVon, fensterOeffnen, fensterSchliessen, konfigurationAktualisieren, verbindungszustandVerteilen } from './fenster'
import { alleDatenLoeschen } from './datenLoeschen'
import { verbindungBeenden, verbindungStarten } from './verbindung'
import { abmelden, anmelden, fehlerZuMeldung, istAngemeldet, istAnmeldungAbbruch, type AnmeldungsErgebnis } from '../autodarts/oauth'
import { kontoNameLaden, kontoNameVerwerfen, type AnmeldungsStatus } from '../autodarts/konto'
import { diagnosePfad, protokollieren } from '../autodarts/diagnose'
import { matchtagBefehlAusfuehren, matchtagStand, type MatchtagBefehl } from './matchtagDienst'
import type { Matchtag } from '../shared/matchtag'

const GUELTIGE_FENSTER_ARTEN: readonly FensterArt[] = ['control', 'player', 'spectator']

function istFensterArt(wert: unknown): wert is FensterArt {
  return typeof wert === 'string' && (GUELTIGE_FENSTER_ARTEN as readonly string[]).includes(wert)
}

// Kanaele, die nur das Control-Fenster aufrufen darf. Player und Spectator
// laden dieselbe Preload-Datei und koennten sie technisch ebenso aufrufen -
// kein Geheimnis-Leck (kein Token, keine Adresse, kein Dateipfad geht
// darueber), aber unnoetig vergroesserte Angriffsflaeche. 'zustand' steht
// bewusst nicht in dieser Liste: der laeuft nur vom Hauptprozess zum
// Renderer (zustandVerteilen -> webContents.send), nie als IPC-Handler,
// den ein Renderer aufrufen koennte.
const NUR_CONTROL: ReadonlySet<string> = new Set([
  'fenster:oeffnen',
  'fenster:schliessen',
  'konfiguration:lesen',
  'konfiguration:setzen',
  'daten:loeschen',
  // monitore:identifizieren HANDELT: es legt fuer zwei Sekunden auf jedem
  // Monitor ein alwaysOnTop-Fenster ab (Befund 5). Aus dem Player- oder
  // Spectator-Renderer aufgerufen deckt es mitten im Match beliebig oft alle
  // Monitore zu - anders als monitore:auflisten, das nur Monitordaten
  // herausgibt und deshalb bewusst NICHT in dieser Liste steht.
  'monitore:identifizieren',
  // Anmelden/Abmelden/Anmeldestatus gehoeren dem Control-Fenster - Player
  // und Spectator haben mit der Kontoverwaltung nichts zu tun.
  'anmeldung:starten',
  'anmeldung:beenden',
  'anmeldung:status',
  // diagnose:pfad gibt nur einen Dateipfad heraus (kein Geheimnis), aber wie
  // bei monitore:identifizieren gilt: Kontoverwaltung und Diagnose gehoeren
  // dem Control-Fenster. diagnose:oeffnen HANDELT zusaetzlich (oeffnet den
  // Datei-Explorer, siehe monitore:identifizieren-Kommentar oben) und
  // gehoert deshalb erst recht hierher.
  'diagnose:pfad',
  'diagnose:oeffnen',
  // Die Selbstaktualisierung gehoert dem Control-Fenster. aktualisierung:
  // suchen und aktualisierung:installieren HANDELN (Netzabruf, Neustart der
  // Anwendung) - aus dem Player- oder Spectator-Renderer aufgerufen koennte
  // ein Fehler im Renderer mitten im Match einen Neustart ausloesen.
  'aktualisierung:zustand',
  'aktualisierung:suchen',
  'aktualisierung:installieren',
  'changelog:neuerungen',
  // Der Matchtag wird im Control-Fenster eingerichtet. matchtag:befehl
  // HANDELT (startet oder beendet ein Turnier, nimmt ein Ergebnis zurueck) -
  // aus dem Zuschauer-Renderer aufgerufen koennte ein Fehler dort einen
  // laufenden Abend loeschen. matchtag:lesen steht aus demselben Grund hier
  // wie diagnose:pfad: die Einrichtung gehoert dem Control-Fenster. Player-
  // und Zuschauer-Screen bekommen den Stand ueber den Kanal 'matchtag',
  // der nur vom Hauptprozess zum Renderer laeuft.
  'matchtag:lesen',
  'matchtag:befehl',
])

/**
 * Entscheidet, ob ein Fenster der Art `art` den Kanal `kanal` aufrufen darf.
 * Reine Funktion (keine Electron-Objekte), damit sie ohne laufende
 * Electron-Runtime testbar ist. `art === null` deckt ein Fenster ab, das die
 * Fensterverwaltung nicht kennt (z. B. bereits geschlossen) - das bekommt
 * bei eingeschraenkten Kanaelen ebenfalls keinen Zugriff.
 */
export function darfKanalNutzen(art: FensterArt | null, kanal: string): boolean {
  if (!NUR_CONTROL.has(kanal)) return true
  return art === 'control'
}

/**
 * Wirft einen aussagekraeftigen Fehler, wenn das aufrufende Fenster den
 * Kanal nicht nutzen darf. Electron reicht eine hier geworfene Exception als
 * abgelehntes Promise an den Aufrufer zurueck - kein stilles undefined, wer
 * den Kanal aus dem falschen Fenster aufruft, hat einen Programmierfehler
 * gemacht und soll das sehen.
 */
function kanalPruefen(event: IpcMainInvokeEvent, kanal: string): void {
  const absender = BrowserWindow.fromWebContents(event.sender)
  const art = absender ? fensterArtVon(absender) : null
  if (!darfKanalNutzen(art, kanal)) {
    throw new Error(`Kanal "${kanal}" ist dem Control-Fenster vorbehalten, Aufrufer war "${art ?? 'unbekannt'}"`)
  }
}

/** Registriert alle IPC-Handler. Wird einmal beim Start aufgerufen. */
export function ipcRegistrieren(): void {
  // Synchron statt handle(): das Ueber-Panel zeigt window.app.version direkt
  // beim Rendern an, ohne auf ein Promise zu warten. app.getVersion() statt
  // process.env.npm_package_version im Preload (Befund 3) - npm setzt diese
  // Variable nur unter "npm run ..."; im gepackten Programm existiert sie
  // nicht. Nur eine Versionsnummer, kein Geheimnis - offen fuer jedes Fenster.
  ipcMain.on('app:version', (event) => {
    event.returnValue = app.getVersion()
  })

  // Gibt nur Monitordaten heraus (Aufloesung, Position, Skalierung) - kein
  // Geheimnis, keine Handlung. Bewusst nicht in NUR_CONTROL, siehe Kommentar
  // dort.
  ipcMain.handle('monitore:auflisten', () => monitoreAuflisten())

  ipcMain.handle('monitore:identifizieren', (event) => {
    kanalPruefen(event, 'monitore:identifizieren')
    monitoreIdentifizieren()
  })

  ipcMain.handle('konfiguration:lesen', (event) => {
    kanalPruefen(event, 'konfiguration:lesen')
    return konfigurationLesen()
  })

  // Sicherheitsvorgabe: nimmt ausschliesslich die drei bekannten Felder
  // entgegen. zusammenfuehren liest nur boardId/playerDisplayId/
  // spectatorDisplayId aus einem rohen, ungeprueften Objekt aus und
  // validiert deren Typ - alles andere (Token, Adressen, Dateipfade, ...)
  // wird verworfen statt durchgereicht. teil wird vor der Validierung mit
  // der bisherigen Konfiguration zusammengefuehrt, damit "setzen" ein
  // Teilobjekt bleibt und nicht fehlende Felder auf null zuruecksetzt.
  ipcMain.handle('konfiguration:setzen', async (event, teil: unknown) => {
    kanalPruefen(event, 'konfiguration:setzen')
    const bisherige = await konfigurationLesen()
    const roh = typeof teil === 'object' && teil !== null ? teil : {}
    const neue = steckbriefeNachfuehren(zusammenfuehren({ ...bisherige, ...roh }))
    await konfigurationSchreiben(neue)
    konfigurationAktualisieren(neue)
    autostartAnwenden(neue.autostart)
    return neue
  })

  ipcMain.handle('fenster:oeffnen', (event, art: unknown) => {
    kanalPruefen(event, 'fenster:oeffnen')
    if (istFensterArt(art)) fensterOeffnen(art)
  })

  ipcMain.handle('fenster:schliessen', (event, art: unknown) => {
    kanalPruefen(event, 'fenster:schliessen')
    if (istFensterArt(art)) fensterSchliessen(art)
  })

  // Die eigentliche Bestaetigung ("bist du sicher?") liegt beim Renderer -
  // dieser Kanal loescht ohne Rueckfrage, sobald er aufgerufen wird.
  ipcMain.handle('daten:loeschen', (event) => {
    kanalPruefen(event, 'daten:loeschen')
    return alleDatenLoeschen()
  })

  // Ob es geklappt hat und - bei Nicht-Erfolg - eine fuer Menschen gedachte
  // Meldung (fehlerZuMeldung) gehen an den Renderer, nie der rohe Fehler:
  // kein Token, keine Adresse, kein Code (siehe AnmeldungsErgebnis in
  // oauth.ts). Der vollstaendige Fehler (auch bei einem Abbruch) landet
  // ausschliesslich im Diagnoseprotokoll. Bricht der Nutzer die Anmeldung
  // selbst ab (Fenster geschlossen, Zeitlimit), ist das keine console.error-
  // Meldung wert, sondern eine ruhig zu behandelnde Entscheidung -
  // istAnmeldungAbbruch() unterscheidet das von einem echten Fehlerfall.
  // Nach Erfolg wird sofort verbunden, ohne auf einen Neustart zu warten -
  // verbindungStarten() ist selbst dagegen abgesichert, neben einer
  // bestehenden Verbindung eine zweite aufzubauen.
  ipcMain.handle('anmeldung:starten', async (event): Promise<AnmeldungsErgebnis> => {
    kanalPruefen(event, 'anmeldung:starten')
    try {
      await anmelden()
    } catch (fehler) {
      const abgebrochen = istAnmeldungAbbruch(fehler)
      const pfad = await diagnosePfad()
      await protokollieren(
        `Anmeldung fehlgeschlagen (abgebrochen=${abgebrochen}): ${fehler instanceof Error ? fehler.message : String(fehler)}`,
      )
      if (!abgebrochen) console.error('Anmeldung fehlgeschlagen:', fehler)
      return { erfolg: false, abgebrochen, meldung: fehlerZuMeldung(fehler, pfad) }
    }
    // Ein vorheriger Kontoname (falls je einer geladen wurde) gehoert zu
    // einer moeglicherweise anderen Anmeldung - der naechste
    // anmeldung:status-Aufruf soll ihn frisch abfragen, nicht den alten
    // Wert weiterreichen (siehe Kommentar an kontoNameVerwerfen).
    kontoNameVerwerfen()
    void verbindungStarten()
    return { erfolg: true }
  })

  // Trennt die Verbindung und meldet den Zustand danach ausdruecklich als
  // "nichtAngemeldet" - ohne das haette das Control-Fenster nach einer
  // bewussten Abmeldung "getrennt" gezeigt, als wuerde gleich wieder
  // verbunden (websocket.ts meldet 'getrennt' inzwischen ohnehin nur noch
  // bei einem echten Abbruch, nicht bei einem gezielten schliessen()).
  ipcMain.handle('anmeldung:beenden', async (event) => {
    kanalPruefen(event, 'anmeldung:beenden')
    await abmelden()
    kontoNameVerwerfen()
    await verbindungBeenden()
    verbindungszustandVerteilen('nichtAngemeldet')
  })

  // Ob ueberhaupt eine Anmeldung vorliegt, und - falls ja - der Kontoname
  // fuer "Angemeldet als: <Name>" im Control-Fenster (siehe kontoNameLaden:
  // wird nur beim allerersten Aufruf nach einer Anmeldung tatsaechlich
  // abgefragt, danach zwischengespeichert). Kein Token, kein Konto-Ident,
  // keine Adresse verlassen ueber diesen Kanal den Hauptprozess - nur ein
  // Anzeigename, kein Geheimnis.
  ipcMain.handle('anmeldung:status', async (event): Promise<AnmeldungsStatus> => {
    kanalPruefen(event, 'anmeldung:status')
    const angemeldet = await istAngemeldet()
    if (!angemeldet) return { angemeldet, kontoName: null }
    return { angemeldet, kontoName: await kontoNameLaden() }
  })

  // Nur ein Dateipfad, kein Geheimnis - fuer die Anzeige im Control-Fenster.
  ipcMain.handle('diagnose:pfad', (event) => {
    kanalPruefen(event, 'diagnose:pfad')
    return diagnosePfad()
  })

  // Oeffnet den Datei-Explorer mit dem Diagnoseprotokoll markiert, damit der
  // Herausgeber es ohne Pfad-Suche im Dateisystem finden und verschicken
  // kann. HANDELT (oeffnet ein externes Programmfenster) - deshalb in
  // NUR_CONTROL, siehe Kommentar dort.
  ipcMain.handle('diagnose:oeffnen', async (event) => {
    kanalPruefen(event, 'diagnose:oeffnen')
    shell.showItemInFolder(await diagnosePfad())
  })

  // Der zuletzt bekannte Stand, ohne auf die naechste Meldung zu warten: das
  // Control-Fenster kann jederzeit geoeffnet und geschlossen werden, eine
  // bereits verschickte Meldung waere dann verloren (Electron speichert
  // IPC-Nachrichten nicht zwischen).
  ipcMain.handle('aktualisierung:zustand', (event): Aktualisierungszustand => {
    kanalPruefen(event, 'aktualisierung:zustand')
    return aktualisierungszustand()
  })

  // Sucht sofort statt auf den naechsten Takt zu warten. Wirft nie - das
  // Ergebnis kommt ueber den Kanal 'aktualisierungszustand', auch ein Fehler.
  ipcMain.handle('aktualisierung:suchen', (event) => {
    kanalPruefen(event, 'aktualisierung:suchen')
    return aktualisierungSuchen()
  })

  // Lehnt waehrend eines laufenden Matches ab und sagt warum (siehe
  // aktualisierungInstallieren) - die Rueckfrage vor dem Aufruf uebernimmt
  // der Renderer.
  ipcMain.handle('aktualisierung:installieren', (event) => {
    kanalPruefen(event, 'aktualisierung:installieren')
    return aktualisierungInstallieren()
  })

  // Zeigt nach einer Aktualisierung einmalig, was neu ist (Spec Abschnitt 13),
  // und merkt sich die gezeigte Version sofort. Gibt null zurueck, wenn es
  // nichts zu zeigen gibt: gleiche Version wie beim letzten Mal, allererster
  // Start (da gab es keine Aktualisierung, nur eine Installation), fehlender
  // oder unlesbarer Changelog.
  ipcMain.handle('changelog:neuerungen', async (event): Promise<string | null> => {
    kanalPruefen(event, 'changelog:neuerungen')
    const version = app.getVersion()
    const bisherige = await konfigurationLesen()
    if (bisherige.zuletztGeseheneVersion === version) return null

    const neue = { ...bisherige, zuletztGeseheneVersion: version }
    await konfigurationSchreiben(neue)
    konfigurationAktualisieren(neue)
    if (bisherige.zuletztGeseheneVersion === null) return null

    try {
      // getAppPath() zeigt im gepackten Programm auf das Verzeichnis mit
      // package.json und CHANGELOG.md (siehe "files" in package.json), in der
      // Entwicklung auf das Projektverzeichnis - derselbe Aufruf trifft
      // beidesmal die richtige Datei.
      const text = await readFile(join(app.getAppPath(), 'CHANGELOG.md'), 'utf-8')
      return changelogAbschnitt(text, version)
    } catch (fehler) {
      void protokollieren(
        `Changelog nicht lesbar, Neuerungen werden nicht angezeigt: ${fehler instanceof Error ? fehler.message : String(fehler)}`,
      )
      return null
    }
  })

  // Stand des Matchtags auf Anfrage - das Control-Fenster holt ihn beim
  // Aufbau, ohne auf die naechste Aenderung zu warten.
  ipcMain.handle('matchtag:lesen', (event): Matchtag => {
    kanalPruefen(event, 'matchtag:lesen')
    return matchtagStand()
  })

  // Turnier starten, beenden oder das letzte Ergebnis zuruecknehmen. Gibt den
  // neuen Stand zurueck, damit das Control-Fenster nicht nachfragen muss.
  ipcMain.handle('matchtag:befehl', (event, befehl: unknown): Promise<Matchtag> => {
    kanalPruefen(event, 'matchtag:befehl')
    return matchtagBefehlAusfuehren(matchtagBefehlPruefen(befehl))
  })
}

/**
 * Prueft einen Befehl aus dem Renderer. Alles, was ueber IPC kommt, ist
 * ungeprueft - ein unbekannter Befehl wird zu 'beenden' statt zu einem
 * Absturz im Hauptprozess. Reine Funktion, damit sie ohne Electron pruefbar
 * ist (gleiches Muster wie darfKanalNutzen).
 */
export function matchtagBefehlPruefen(roh: unknown): MatchtagBefehl {
  if (typeof roh !== 'object' || roh === null) return { art: 'beenden' }
  const b = roh as Record<string, unknown>
  if (b.art === 'starten') return { art: 'starten', titel: typeof b.titel === 'string' ? b.titel : '' }
  if (b.art === 'zuruecknehmen') return { art: 'zuruecknehmen' }
  return { art: 'beenden' }
}

/**
 * Schreibt zu jeder gewaehlten Display-Kennung den vollen Steckbrief mit.
 *
 * Das Control-Fenster schickt nur eine Kennung - mehr sieht die Auswahlliste
 * nicht. Die Kennung allein ueberlebt aber keinen Neustart (siehe
 * monitorAuswahl.ts), deshalb wird hier, wo die Monitore bekannt sind, der
 * Steckbrief dazugelegt. Wird die Auswahl geleert, faellt auch er weg.
 */
export function steckbriefeNachfuehren(k: Konfiguration): Konfiguration {
  const displays = screen.getAllDisplays()
  const steckbrief = (id: number | null) => {
    if (id === null) return null
    const display = displays.find((d) => d.id === id)
    return display ? kennungFuer(display) : null
  }
  return {
    ...k,
    playerMonitor: k.playerDisplayId === null ? null : (steckbrief(k.playerDisplayId) ?? k.playerMonitor),
    spectatorMonitor: k.spectatorDisplayId === null ? null : (steckbrief(k.spectatorDisplayId) ?? k.spectatorMonitor),
  }
}

/**
 * Traegt die Anwendung in den Autostart des Benutzers ein oder wieder aus.
 *
 * Nur im gepackten Programm: in der Entwicklung zeigte der Eintrag sonst auf
 * die electron.exe des Projektverzeichnisses und wuerde beim naechsten
 * Anmelden eine leere Electron-Huelle starten.
 */
export function autostartAnwenden(an: boolean): void {
  if (!app.isPackaged) return
  try {
    app.setLoginItemSettings({ openAtLogin: an, path: process.execPath, args: [] })
  } catch (fehler) {
    void protokollieren(
      `Autostart liess sich nicht setzen: ${fehler instanceof Error ? fehler.message : String(fehler)}`,
    )
  }
}
