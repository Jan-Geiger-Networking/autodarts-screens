import { useEffect, useState } from 'react'
import type { Konfiguration } from '../../main/konfiguration'
import type { MonitorEintrag } from '../../main/monitore'
import type { Verbindungszustand } from '../../autodarts/websocket'
import type { Aktualisierungszustand } from '../../main/aktualisierung'
import { UeberPanel } from './UeberPanel'
import '../shared/tokens.css'
import './App.css'

// Text je Verbindungszustand (siehe src/autodarts/websocket.ts). null heisst:
// noch keine Meldung erhalten, z.B. kurz nach dem Start oder im
// AD_TESTZUSTAND-Modus, in dem gar keine Verbindung versucht wird.
const VERBINDUNGSTEXT: Record<Verbindungszustand, string> = {
  verbunden: 'verbunden',
  getrennt: 'getrennt — Wiederverbindung läuft automatisch',
  nichtAngemeldet: 'nicht angemeldet — bitte einmal anmelden',
}

// Beantwortet genau die Frage des Herausgebers ("wo sehe ich, dass ich
// angemeldet bin?") statt nur einen Zustand zu wiederholen. Erfindet nie
// einen Namen: liegt keine Anmeldung vor, ist das eine Tatsache ("Nicht
// angemeldet"); liegt eine vor, aber der Kontoname liess sich nicht ermitteln
// (siehe nameAusKonto in src/autodarts/konto.ts), steht das ebenso ehrlich da.
function anmeldeText(angemeldet: boolean | null, kontoName: string | null): string {
  if (angemeldet === null) return 'Anmeldestatus wird geladen …'
  if (!angemeldet) return 'Nicht angemeldet'
  return kontoName ? `Angemeldet als: ${kontoName}` : 'Angemeldet, Kontoname nicht abrufbar'
}

// Ein Satz je Zustand der Selbstaktualisierung. Jeder Fall ist benannt - es
// gibt keinen, in dem hier nichts steht, denn "nichts steht da" war genau die
// Rueckmeldung, die zur Ueberarbeitung gefuehrt hat.
function aktualisierungsText(z: Aktualisierungszustand | null): string {
  if (z === null) return 'wird geprüft …'
  switch (z.art) {
    case 'aus':
      return z.grund
    case 'ruht':
      return 'noch nicht gesucht'
    case 'suche':
      return 'Suche läuft …'
    case 'aktuell':
      return `Aktuell — zuletzt geprüft ${new Date(z.geprueft).toLocaleTimeString('de-DE')}`
    case 'gefunden':
      return `Version ${z.version} gefunden, Download beginnt …`
    case 'laedt':
      return `Version ${z.version} wird geladen — ${z.prozent} %`
    case 'bereit':
      return `Version ${z.version} liegt bereit und wird beim Beenden installiert`
    case 'fehler':
      return z.meldung
  }
}

export function App() {
  const [konfiguration, setKonfiguration] = useState<Konfiguration | null>(null)
  const [monitore, setMonitore] = useState<MonitorEintrag[]>([])
  const [verbindungszustand, setVerbindungszustand] = useState<Verbindungszustand | null>(null)
  // null: Anmeldestatus noch nicht abgefragt. Wird zusaetzlich aus dem
  // Verbindungszustand nachgefuehrt (siehe useEffect unten) - "verbunden"
  // ist nur ueberhaupt moeglich, wenn eine Anmeldung vorliegt, und
  // "nichtAngemeldet" sagt es direkt.
  const [angemeldet, setAngemeldet] = useState<boolean | null>(null)
  // Nur gesetzt, wenn eine Anmeldung vorliegt UND der Hauptprozess einen
  // brauchbaren Namen ermitteln konnte (siehe nameAusKonto in
  // src/autodarts/konto.ts) - sonst null, dann zeigt anmeldeText() ehrlich
  // "Kontoname nicht abrufbar" statt etwas zu erfinden.
  const [kontoName, setKontoName] = useState<string | null>(null)
  const [anmeldungLaeuft, setAnmeldungLaeuft] = useState(false)
  // Bei jedem Nicht-Erfolg gesetzt (siehe anmeldenAusloesen) - auch bei einem
  // Abbruch durch den Nutzer selbst, seit die Anmeldung eine fuer Menschen
  // gedachte Meldung liefert (window.app.anmeldungStarten(), Diagnose-Report):
  // "es passiert nichts" nach einem Klick auf Anmelden war genau das
  // gemeldete Problem, ein stiller Abbruch bleibt deshalb nicht mehr stumm.
  const [anmeldungMeldung, setAnmeldungMeldung] = useState<string | null>(null)
  const [diagnosePfad, setDiagnosePfad] = useState<string | null>(null)
  // null: der Hauptprozess hat noch nicht geantwortet.
  const [aktualisierung, setAktualisierung] = useState<Aktualisierungszustand | null>(null)
  const [aktualisierungMeldung, setAktualisierungMeldung] = useState<string | null>(null)
  // Der Changelog-Abschnitt der laufenden Version - nur nach einer
  // Aktualisierung gefuellt, danach nie wieder (siehe changelog:neuerungen).
  const [neuerungen, setNeuerungen] = useState<string | null>(null)

  useEffect(() => {
    window.app.konfigurationLesen().then(setKonfiguration)
    window.app.monitore().then(setMonitore)
    // Deckt "beim Start, wenn bereits eine Anmeldung vorliegt" ab (siehe
    // Task): kontoNameLaden() im Hauptprozess fragt hoechstens einmal pro
    // Anmeldung wirklich ab, ein weiterer Aufruf hier waere also ohnehin
    // kostenlos - trotzdem reicht dieser eine Aufruf beim Mounten.
    window.app.anmeldungStatus().then((status) => {
      setAngemeldet(status.angemeldet)
      setKontoName(status.kontoName)
    })
    window.app.diagnosePfad().then(setDiagnosePfad)
    window.app.aktualisierungZustand().then(setAktualisierung)
    window.app.neuerungen().then(setNeuerungen)
    const abmeldenAktualisierung = window.app.beiAktualisierungszustand(setAktualisierung)
    const abmeldenVerbindung = window.app.beiVerbindungszustand((z) => {
      setVerbindungszustand(z)
      if (z === 'nichtAngemeldet') {
        setAngemeldet(false)
        setKontoName(null)
      }
      if (z === 'verbunden') setAngemeldet(true)
    })
    return () => {
      abmeldenVerbindung()
      abmeldenAktualisierung()
    }
  }, [])

  async function konfigurationAendern(teil: Partial<Konfiguration>): Promise<void> {
    setKonfiguration(await window.app.konfigurationSetzen(teil))
  }

  async function anmeldenAusloesen(): Promise<void> {
    setAnmeldungLaeuft(true)
    setAnmeldungMeldung(null)
    try {
      const ergebnis = await window.app.anmeldungStarten()
      if (ergebnis.erfolg) {
        setAngemeldet(true)
        // Der Hauptprozess hat den Kontonamen fuer eine neue Anmeldung noch
        // nicht abgefragt (anmeldung:starten meldet nur Erfolg/Misserfolg,
        // siehe Kanal-Vorgabe in der Aufgabe) - dieser Aufruf holt ihn nach.
        const status = await window.app.anmeldungStatus()
        setKontoName(status.kontoName)
      } else {
        setAnmeldungMeldung(ergebnis.meldung)
      }
    } finally {
      setAnmeldungLaeuft(false)
    }
  }

  async function installierenAusloesen(): Promise<void> {
    const ergebnis = await window.app.aktualisierungInstallieren()
    // Nur der Nicht-Erfolg braucht eine Meldung: klappt es, startet die
    // Anwendung neu, und niemand liest hier noch etwas.
    setAktualisierungMeldung(ergebnis.erfolg ? null : (ergebnis.meldung ?? 'Installation nicht möglich.'))
  }

  async function abmeldenAusloesen(): Promise<void> {
    setAnmeldungLaeuft(true)
    setAnmeldungMeldung(null)
    try {
      await window.app.anmeldungBeenden()
      setAngemeldet(false)
      setKontoName(null)
    } finally {
      setAnmeldungLaeuft(false)
    }
  }

  return (
    <div className="control">
      <h1>Autodarts Dual-Screen — Steuerung</h1>

      <fieldset className="bereich">
        <legend>Verbindung</legend>
        <p className="hinweis">{anmeldeText(angemeldet, kontoName)}</p>
        <label className="feld">
          Board-ID
          <input
            type="text"
            value={konfiguration?.boardId ?? ''}
            placeholder="noch keine gespeichert"
            onChange={(e) => konfigurationAendern({ boardId: e.target.value.trim() === '' ? null : e.target.value })}
          />
        </label>
        <p className="hinweis">
          Verbindungszustand:{' '}
          {verbindungszustand ? VERBINDUNGSTEXT[verbindungszustand] : 'unbekannt'}
        </p>
        <div className="knopfreihe">
          <button type="button" onClick={anmeldenAusloesen} disabled={anmeldungLaeuft}>
            Anmelden
          </button>
          <button type="button" onClick={abmeldenAusloesen} disabled={anmeldungLaeuft}>
            Abmelden
          </button>
        </div>
        {anmeldungMeldung && <p className="hinweis">{anmeldungMeldung}</p>}
        {diagnosePfad && (
          <p className="hinweis">
            Diagnoseprotokoll: {diagnosePfad}{' '}
            <button type="button" onClick={() => window.app.diagnoseOeffnen()}>
              Im Explorer öffnen
            </button>
          </p>
        )}
      </fieldset>

      <fieldset className="bereich">
        <legend>Monitore</legend>
        <label className="feld">
          Player-Screen
          <select
            value={konfiguration?.playerDisplayId ?? ''}
            onChange={(e) =>
              konfigurationAendern({ playerDisplayId: e.target.value === '' ? null : Number(e.target.value) })
            }
          >
            <option value="">primärer Monitor</option>
            {monitore.map((m) => (
              <option key={m.id} value={m.id}>
                {m.beschriftung}
              </option>
            ))}
          </select>
        </label>
        <label className="feld">
          Spectator-Screen
          <select
            value={konfiguration?.spectatorDisplayId ?? ''}
            onChange={(e) =>
              konfigurationAendern({ spectatorDisplayId: e.target.value === '' ? null : Number(e.target.value) })
            }
          >
            <option value="">primärer Monitor</option>
            {monitore.map((m) => (
              <option key={m.id} value={m.id}>
                {m.beschriftung}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => window.app.monitoreIdentifizieren()}>
          Monitore anzeigen
        </button>
      </fieldset>

      <fieldset className="bereich">
        <legend>Screens</legend>
        <div className="knopfreihe">
          <button type="button" onClick={() => window.app.fensterOeffnen('player')}>
            Player-Screen öffnen
          </button>
          <button type="button" onClick={() => window.app.fensterSchliessen('player')}>
            Player-Screen schließen
          </button>
        </div>
        <div className="knopfreihe">
          <button type="button" onClick={() => window.app.fensterOeffnen('spectator')}>
            Spectator-Screen öffnen
          </button>
          <button type="button" onClick={() => window.app.fensterSchliessen('spectator')}>
            Spectator-Screen schließen
          </button>
        </div>
      </fieldset>

      <fieldset className="bereich">
        <legend>Aktualisierung</legend>
        <p className="hinweis">Stand: {aktualisierungsText(aktualisierung)}</p>
        <label className="feld">
          Beta-Versionen
          <select
            value={konfiguration?.betaKanal === null || konfiguration === null ? '' : String(konfiguration.betaKanal)}
            onChange={(e) =>
              konfigurationAendern({ betaKanal: e.target.value === '' ? null : e.target.value === 'true' })
            }
          >
            <option value="">automatisch — wie die laufende Version</option>
            <option value="true">anbieten</option>
            <option value="false">nicht anbieten</option>
          </select>
        </label>
        <p className="hinweis">
          „Automatisch" heißt: läuft eine Beta, werden Betas angeboten; läuft eine stabile Version, nur stabile.
        </p>
        <div className="knopfreihe">
          <button
            type="button"
            onClick={() => {
              setAktualisierungMeldung(null)
              void window.app.aktualisierungSuchen()
            }}
            disabled={aktualisierung?.art === 'suche' || aktualisierung?.art === 'laedt'}
          >
            Jetzt suchen
          </button>
          <button type="button" onClick={installierenAusloesen} disabled={aktualisierung?.art !== 'bereit'}>
            Jetzt neu starten und installieren
          </button>
        </div>
        {aktualisierungMeldung && <p className="hinweis">{aktualisierungMeldung}</p>}
        {neuerungen && (
          <>
            <p className="hinweis">Neu in Version {window.app.version}:</p>
            <pre className="neuerungen">{neuerungen}</pre>
          </>
        )}
      </fieldset>

      <fieldset className="bereich">
        <legend>Über</legend>
        <UeberPanel />
      </fieldset>
    </div>
  )
}
