// Bedienteil fuer den Matchtag im Control-Fenster.
//
// Der ganze Ablauf braucht genau drei Knoepfe: starten, letztes Ergebnis
// zuruecknehmen, beenden. Alles andere ergibt sich aus den Matches selbst -
// die Aufwaermrunde liefert die Spielerliste, jede gespielte Partie traegt
// sich von allein ein (siehe src/main/matchtagDienst.ts).
//
// Angezeigt wird hier, was zum Einrichten des naechsten Matches noetig ist:
// welche Paarung dran ist und wie der Stand aussieht. Dieselben Zahlen
// stehen gross auf dem Zuschauer-Screen; hier in klein, damit man sie beim
// Einrichten vor sich hat, ohne sich umzudrehen.

import { useEffect, useState } from 'react'
import { naechstePaarung, spielerName, tabelle, type Matchtag, type MatchtagPhase } from '../../shared/matchtag'

const PHASENTEXT: Record<MatchtagPhase, string> = {
  aus: 'Kein Matchtag — die Anwendung läuft im Normalbetrieb.',
  aufwaermen: 'Aufwärmrunde: jetzt ein Autodarts-Match mit ALLEN Teilnehmern spielen. Daraus entsteht der Spielplan.',
  spielplan: 'Spielplan steht. Erste Partie einrichten.',
  laeuft: 'Turnier läuft.',
  stechen: 'Gleichstand an der Spitze — Stechen läuft.',
  beendet: 'Entschieden.',
}

export function MatchtagPanel() {
  const [matchtag, setMatchtag] = useState<Matchtag | null>(null)
  const [titel, setTitel] = useState('')
  const [beendenBestaetigt, setBeendenBestaetigt] = useState(false)

  useEffect(() => {
    void window.app.matchtagLesen().then(setMatchtag)
    return window.app.beiMatchtag(setMatchtag)
  }, [])

  // Die Bestaetigung fuer "Beenden" gilt nur kurz: sonst steht der Knopf den
  // ganzen Abend scharf und ein Fehlklick loescht das Turnier.
  useEffect(() => {
    if (!beendenBestaetigt) return
    const timer = window.setTimeout(() => setBeendenBestaetigt(false), 5000)
    return () => window.clearTimeout(timer)
  }, [beendenBestaetigt])

  if (!matchtag) return <p className="hinweis">Wird geladen …</p>

  const laeuft = matchtag.phase !== 'aus'
  const naechste = naechstePaarung(matchtag)
  const stand = tabelle(matchtag)
  const gespielt = matchtag.paarungen.filter((p) => p.siegerId !== null).length

  return (
    <>
      <p className="hinweis">{PHASENTEXT[matchtag.phase]}</p>

      {!laeuft && (
        <>
          <label className="feld">
            Name des Abends
            <input
              type="text"
              value={titel}
              placeholder="Matchtag"
              onChange={(e) => setTitel(e.target.value)}
              maxLength={40}
            />
          </label>
          <div className="knopfreihe">
            <button type="button" onClick={() => void window.app.matchtagBefehl({ art: 'starten', titel })}>
              Matchtag starten
            </button>
          </div>
          <p className="hinweis">
            Danach ein Match mit allen Mitspielern starten — das zählt als Aufwärmrunde und legt Spielerliste und
            Spielplan fest.
          </p>
        </>
      )}

      {laeuft && (
        <>
          {naechste && (
            <p className="hinweis matchtag-naechste">
              Jetzt einrichten: <strong>{spielerName(matchtag, naechste.aId)}</strong> gegen{' '}
              <strong>{spielerName(matchtag, naechste.bId)}</strong>
            </p>
          )}
          {matchtag.phase === 'beendet' && (
            <p className="hinweis matchtag-naechste">
              Sieger: <strong>{spielerName(matchtag, matchtag.siegerId ?? '')}</strong>
            </p>
          )}

          {stand.length > 0 && (
            <table className="matchtag-tabelle">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Spieler</th>
                  <th>Pkt</th>
                  <th>Sp</th>
                  <th>Legs</th>
                </tr>
              </thead>
              <tbody>
                {stand.map((z) => (
                  <tr key={z.spieler.id}>
                    <td>{z.platz}</td>
                    <td>{z.spieler.name}</td>
                    <td>{z.punkte}</td>
                    <td>{z.gespielt}</td>
                    <td>
                      {z.legsFuer}:{z.legsGegen}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p className="hinweis">
            {gespielt} von {matchtag.paarungen.length} Partien gespielt.
          </p>

          <div className="knopfreihe">
            <button
              type="button"
              onClick={() => void window.app.matchtagBefehl({ art: 'zuruecknehmen' })}
              disabled={gespielt === 0}
            >
              Letztes Ergebnis zurücknehmen
            </button>
            {beendenBestaetigt ? (
              <button
                type="button"
                className="gefahr"
                onClick={() => {
                  setBeendenBestaetigt(false)
                  void window.app.matchtagBefehl({ art: 'beenden' })
                }}
              >
                Wirklich beenden — Stand geht verloren
              </button>
            ) : (
              <button type="button" onClick={() => setBeendenBestaetigt(true)}>
                Matchtag beenden
              </button>
            )}
          </div>
          <p className="hinweis">
            „Zurücknehmen" öffnet die zuletzt gewertete Partie wieder — für den Fall, dass ein Match falsch eingerichtet
            oder abgebrochen wurde.
          </p>
        </>
      )}
    </>
  )
}
