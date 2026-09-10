import { useEffect, useState } from 'react'
import type { MatchState, Player, PlayerScore } from '../../shared/typen'
import logoWeiss from '../../../assets/logo-white.png'
import '../shared/tokens.css'
import './App.css'

/**
 * Waehlt aus den uebrigen Spielern (alle ausser `eigeneId`) den fuehrenden
 * Gegner: meiste gewonnene Legs, bei Gleichstand meiste Sets. Bei genau zwei
 * Spielern ist das automatisch der einzige andere Spieler - dieselbe
 * Funktion deckt also sowohl den 2-Spieler- als auch den Mehr-Spieler-Fall
 * aus Abschnitt 7 der Spec ab ("nur den fuehrenden Gegner und die eigene
 * Position").
 */
function fuehrenderGegner(spieler: Player[], scores: PlayerScore[], eigeneId: string | null): Player | undefined {
  const scoreVon = (id: string) => scores.find((s) => s.playerId === id)
  return spieler
    .filter((p) => p.id !== eigeneId)
    .sort((a, b) => {
      const sa = scoreVon(a.id)
      const sb = scoreVon(b.id)
      return (sb?.legs ?? 0) - (sa?.legs ?? 0) || (sb?.sets ?? 0) - (sa?.sets ?? 0)
    })[0]
}

export function App() {
  const [zustand, setZustand] = useState<MatchState | null>(null)

  useEffect(() => window.app.beiZustand(setZustand), [])

  // Kein Zustand, Ruhezustand oder kein Spieler bekannt: nur das Logo auf
  // dunklem Grund. Kein Blinken, keine Bewegung.
  if (!zustand || zustand.phase === 'idle' || zustand.players.length === 0) {
    return (
      <div className="ruhezustand">
        <img className="ruhezustand-logo" src={logoWeiss} alt="JGNet" />
      </div>
    )
  }

  const eigenerSpieler = zustand.players.find((p) => p.id === zustand.activePlayerId) ?? zustand.players[0]
  const eigenerScore = zustand.scores.find((s) => s.playerId === eigenerSpieler?.id)
  const gegner = fuehrenderGegner(zustand.players, zustand.scores, eigenerSpieler?.id ?? null)
  const gegnerScore = zustand.scores.find((s) => s.playerId === gegner?.id)

  // Kein eigenes Feld fuer die laufende Leg-Nummer im MatchState: die bisher
  // gewonnenen Legs aller Spieler ergeben in Summe die Anzahl beendeter Legs,
  // das laufende ist die naechste Nummer danach.
  const legNummer = zustand.scores.reduce((summe, s) => summe + s.legs, 0) + 1

  const rest = eigenerScore?.remaining ?? zustand.startScore
  const wurfSlots = [0, 1, 2].map((i) => zustand.currentThrow[i]?.name ?? '–')

  let checkoutInhalt = ''
  let checkoutIstSetup = false
  if (zustand.checkout) {
    checkoutInhalt = zustand.checkout.join(' · ')
  } else if (zustand.checkoutHint) {
    checkoutInhalt = `Setup: ${zustand.checkoutHint}`
    checkoutIstSetup = true
  }

  return (
    <div className="bildschirm">
      <div className="kopfzeile">
        <span className="kopfzeile-name">{eigenerSpieler?.displayName ?? '–'}</span>
        <span className="kopfzeile-stand">
          {eigenerScore?.legs ?? 0} - {gegnerScore?.legs ?? 0}
        </span>
        <span className="kopfzeile-name">{gegner?.displayName ?? '–'}</span>
        <span className="kopfzeile-leg">Leg {legNummer}</span>
      </div>

      <div className="rest-bereich">
        <div className={`rest${zustand.bust ? ' bust' : ''}`}>{rest}</div>
      </div>

      <div className={`checkout${checkoutIstSetup ? ' setup' : ''}`}>{checkoutInhalt}</div>

      <div className="trennlinie" />

      <div className="wurf-zeile">
        <div className="wurf-darts">
          {wurfSlots.map((name, i) => (
            <span className="wurf-dart" key={i}>
              {name}
            </span>
          ))}
        </div>
        <span className="wurf-summe">{zustand.currentThrowTotal}</span>
      </div>
    </div>
  )
}
