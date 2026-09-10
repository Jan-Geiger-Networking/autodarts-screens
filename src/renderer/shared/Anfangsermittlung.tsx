// Anfangsermittlung ("Bull-off"): jeder wirft einen Dart, wer naeher am Bull
// liegt, beginnt. Autodarts fuehrt das als eigenen Modus (Variante
// "Bull-off"), der Abstand steht je Spieler in stats[i].legStats.bullDistance
// (beides belegt im Quelltext des Web-Clients, siehe docs/autodarts-api.md).
//
// Von beiden Screens genutzt: der Player-Screen zeigt sie klein neben der
// Scheibe, der Zuschauer-Screen gross. Das Bild ist dasselbe.

import type { MatchState, Segment } from '../../shared/typen'
import { Dartscheibe } from './Dartscheibe'
import './anfangsermittlung.css'

/** Abstand lesbar machen. Autodarts liefert eine Zahl ohne Einheit - sie wird
 * deshalb ohne Einheit gezeigt, nur gerundet. */
function abstandText(abstand: number | null): string {
  return abstand === null ? '—' : abstand.toFixed(1)
}

export function Anfangsermittlung({ zustand, gross = false }: { zustand: MatchState; gross?: boolean }) {
  // Alle bisher geworfenen Bull-Darts zusammen auf einer Scheibe: so ist auf
  // einen Blick zu sehen, wer naeher dran liegt.
  const wuerfe: Segment[] = zustand.scores.map((s) => s.bullWurf).filter((w): w is Segment => w !== undefined)

  // Wer liegt vorn? Nur, wenn ueberhaupt ein Abstand vorliegt.
  const mitAbstand = zustand.scores.filter((s) => s.bullAbstand !== null)
  const bester = mitAbstand.length > 0 ? mitAbstand.reduce((a, b) => (a.bullAbstand! <= b.bullAbstand! ? a : b)) : null

  return (
    <div className={`anfang${gross ? ' anfang-gross' : ''}`}>
      <p className="anfang-titel">Wer beginnt?</p>
      <p className="anfang-erklaerung">Ein Dart auf das Bull — der näher liegt, fängt an</p>

      <div className="anfang-scheibe">
        <Dartscheibe darts={wuerfe} />
      </div>

      <div className="anfang-spieler">
        {zustand.players.map((spieler) => {
          const score = zustand.scores.find((s) => s.playerId === spieler.id)
          const fuehrt = bester !== null && score?.playerId === bester.playerId
          const geworfen = score?.bullAbstand !== null && score?.bullAbstand !== undefined
          return (
            <div className={`anfang-karte${fuehrt ? ' fuehrt' : ''}`} key={spieler.id}>
              <span className="anfang-name">{spieler.displayName}</span>
              <span className="anfang-abstand">{abstandText(score?.bullAbstand ?? null)}</span>
              <span className="anfang-label">{geworfen ? 'Abstand zum Bull' : 'noch nicht geworfen'}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
