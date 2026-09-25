// Endstand auf dem Player-Screen: nach dem Match eine Karte je Spieler mit
// Profilbild und Statistik - so wie Autodarts selbst nach dem Match seine
// Auswertung zeigt. Steht zwei Minuten oder bis das naechste Match beginnt
// (siehe App.tsx).

import type { MatchState, Player, PlayerScore } from '../../shared/typen'
import logoWeiss from '../../../assets/logo-white.png'
import { Profilbild } from '../shared/Profilbild'

function name(spieler: Player): string {
  return spieler.displayName.trim() !== '' ? spieler.displayName : spieler.autodartsName
}

function zahl(wert: number | null | undefined): string {
  return wert == null || !Number.isFinite(wert) ? '–' : wert.toFixed(1)
}

/** Der Sieger laut Ereignis, sonst wer die meisten Sets und dann Legs hat. */
export function siegerId(zustand: MatchState): string | null {
  if (zustand.lastEvent?.kind === 'matchWon') return zustand.lastEvent.playerId
  const bester = [...zustand.scores].sort((a, b) => b.sets - a.sets || b.legs - a.legs)[0]
  return bester?.playerId ?? null
}

function checkoutQuote(s: PlayerScore): string {
  if (s.checkoutProzent !== null) return `${s.checkoutProzent.toFixed(1)} %`
  if (s.checkoutAttempts === 0) return '–'
  return `${((s.checkoutHits / s.checkoutAttempts) * 100).toFixed(1)} %`
}

function Karte({ spieler, score, sieger }: { spieler: Player; score: PlayerScore | undefined; sieger: boolean }) {
  const zeilen: [string, string][] = score
    ? [
        ['Average', zahl(score.average3)],
        ['First 9', zahl(score.first9Average)],
        ['Checkout', checkoutQuote(score)],
        ['Höchstes Finish', score.highestFinish === null ? '–' : String(score.highestFinish)],
        ['Darts', String(score.dartsGesamt)],
        ['180', String(score.count180)],
        ['140+', String(score.plus140)],
        ['100+', String(score.plus100)],
        ['60+', String(score.plus60)],
      ]
    : []

  return (
    <div className={`endkarte${sieger ? ' ist-sieger' : ''}`}>
      {sieger && <span className="endkarte-sieger">Sieger</span>}
      <Profilbild spieler={spieler} className="endkarte-bild" />
      <span className="endkarte-name">{name(spieler)}</span>
      <span className="endkarte-stand">
        S {score?.sets ?? 0} · L {score?.legs ?? 0}
      </span>
      <dl className="endkarte-werte">
        {zeilen.map(([titel, wert]) => (
          <div className="endkarte-zeile" key={titel}>
            <dt>{titel}</dt>
            <dd>{wert}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function Endstand({ zustand }: { zustand: MatchState }) {
  const sieger = siegerId(zustand)
  return (
    <div className="endstand">
      <p className="endstand-titel">Match beendet</p>
      <div className={`endstand-karten endstand-${Math.min(zustand.players.length, 8)}`}>
        {zustand.players.map((spieler) => (
          <Karte
            key={spieler.id}
            spieler={spieler}
            score={zustand.scores.find((s) => s.playerId === spieler.id)}
            sieger={spieler.id === sieger}
          />
        ))}
      </div>
      <img className="endstand-logo" src={logoWeiss} alt="JGNet" />
    </div>
  )
}
