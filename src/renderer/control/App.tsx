import { useEffect, useState } from 'react'
import type { Konfiguration } from '../../main/konfiguration'
import type { MonitorEintrag } from '../../main/monitore'
import type { Verbindungszustand } from '../../autodarts/websocket'
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

export function App() {
  const [konfiguration, setKonfiguration] = useState<Konfiguration | null>(null)
  const [monitore, setMonitore] = useState<MonitorEintrag[]>([])
  const [verbindungszustand, setVerbindungszustand] = useState<Verbindungszustand | null>(null)
  // null: Anmeldestatus noch nicht abgefragt. Wird zusaetzlich aus dem
  // Verbindungszustand nachgefuehrt (siehe useEffect unten) - "verbunden"
  // ist nur ueberhaupt moeglich, wenn eine Anmeldung vorliegt, und
  // "nichtAngemeldet" sagt es direkt.
  const [angemeldet, setAngemeldet] = useState<boolean | null>(null)
  const [anmeldungLaeuft, setAnmeldungLaeuft] = useState(false)
  // Bei jedem Nicht-Erfolg gesetzt (siehe anmeldenAusloesen) - auch bei einem
  // Abbruch durch den Nutzer selbst, seit die Anmeldung eine fuer Menschen
  // gedachte Meldung liefert (window.app.anmeldungStarten(), Diagnose-Report):
  // "es passiert nichts" nach einem Klick auf Anmelden war genau das
  // gemeldete Problem, ein stiller Abbruch bleibt deshalb nicht mehr stumm.
  const [anmeldungMeldung, setAnmeldungMeldung] = useState<string | null>(null)
  const [diagnosePfad, setDiagnosePfad] = useState<string | null>(null)

  useEffect(() => {
    window.app.konfigurationLesen().then(setKonfiguration)
    window.app.monitore().then(setMonitore)
    window.app.anmeldungStatus().then(setAngemeldet)
    window.app.diagnosePfad().then(setDiagnosePfad)
    return window.app.beiVerbindungszustand((z) => {
      setVerbindungszustand(z)
      if (z === 'nichtAngemeldet') setAngemeldet(false)
      if (z === 'verbunden') setAngemeldet(true)
    })
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
      } else {
        setAnmeldungMeldung(ergebnis.meldung)
      }
    } finally {
      setAnmeldungLaeuft(false)
    }
  }

  async function abmeldenAusloesen(): Promise<void> {
    setAnmeldungLaeuft(true)
    setAnmeldungMeldung(null)
    try {
      await window.app.anmeldungBeenden()
      setAngemeldet(false)
    } finally {
      setAnmeldungLaeuft(false)
    }
  }

  return (
    <div className="control">
      <h1>Autodarts Dual-Screen — Steuerung</h1>

      <fieldset className="bereich">
        <legend>Verbindung</legend>
        <p className="hinweis">
          Angemeldet als: {angemeldet === null ? 'unbekannt' : angemeldet ? 'angemeldet' : 'nicht angemeldet'}
        </p>
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
        <legend>Über</legend>
        <UeberPanel />
      </fieldset>
    </div>
  )
}
