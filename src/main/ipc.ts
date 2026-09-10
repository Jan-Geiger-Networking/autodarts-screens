// IPC-Kanaele zwischen Main- und Renderer-Prozessen. Enthaelt nur Kanaele,
// die heute eine echte Implementierung haben.

import { app, BrowserWindow, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import type { FensterArt } from '../shared/typen'
import { monitoreAuflisten, monitoreIdentifizieren } from './monitore'
import { konfigurationLesen, konfigurationSchreiben, zusammenfuehren } from './konfiguration'
import { fensterArtVon, fensterOeffnen, fensterSchliessen, konfigurationAktualisieren, verbindungszustandVerteilen } from './fenster'
import { alleDatenLoeschen } from './datenLoeschen'
import { verbindungBeenden, verbindungStarten } from './verbindung'
import { abmelden, anmelden, fehlerZuMeldung, istAngemeldet, istAnmeldungAbbruch, type AnmeldungsErgebnis } from '../autodarts/oauth'
import { diagnosePfad, protokollieren } from '../autodarts/diagnose'

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
    const neue = zusammenfuehren({ ...bisherige, ...roh })
    await konfigurationSchreiben(neue)
    konfigurationAktualisieren(neue)
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
    await verbindungBeenden()
    verbindungszustandVerteilen('nichtAngemeldet')
  })

  // Reine Statusabfrage, kein Geheimnis - nur ob ueberhaupt eine Anmeldung
  // vorliegt, nie das Token oder das Konto selbst.
  ipcMain.handle('anmeldung:status', (event) => {
    kanalPruefen(event, 'anmeldung:status')
    return istAngemeldet()
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
}
