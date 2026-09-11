// Heatmap der Auftreffpunkte eines Spielers.
//
// Grundlage sind die gemessenen Koordinaten, die waehrend des Abends
// mitgeschrieben wurden (siehe wuerfeErgaenzen in src/shared/matchtag.ts).
// Gezeichnet wird dieselbe Scheibe wie ueberall sonst - farbig, wie auf dem
// Player-Screen ("mach die dartscheibe bei allen zuschaern wider wie bei dem
// playerboard also farbig") - und darueber zwei weiche Schichten: eine breite
// in Rot und eine schmale in Gelb. Wo viele Pfeile liegen, ueberlagern sich
// die Kreise und die Stelle wird kraeftiger. Das ist die ganze Rechnung; eine
// echte Dichteschaetzung waere auf einem Fernseher nicht zu unterscheiden.
//
// Bewusst OHNE mix-blend-mode: aufhellende Mischung verschwindet auf den
// cremefarbenen Feldern der Scheibe. Deckende Farben mit Alphakanal sind auf
// hellem wie dunklem Feld gleich gut zu sehen.

import { Dartscheibe } from './Dartscheibe'
import { ausKoordinaten } from './scheibengeometrie'

export function Heatmap({ wuerfe }: { wuerfe: readonly { x: number; y: number }[] }) {
  const punkte = wuerfe.map((w) => ausKoordinaten(w))

  return (
    <div className="heatmap">
      <Dartscheibe darts={[]} />
      <svg className="heatmap-schicht" viewBox="-115 -115 230 230" aria-hidden="true">
        <defs>
          {/* Zwei Unschaerfen: die breite malt den Bereich, die schmale den
              Kern. Die Kennungen sind fest - mehrere Heatmaps auf einer Seite
              teilen sich dieselbe Definition, das ist gewollt. */}
          <filter id="heat-weit" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <filter id="heat-kern" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2" />
          </filter>
        </defs>

        <g className="heat-weit" filter="url(#heat-weit)">
          {punkte.map((p, i) => (
            <circle key={`w${i}`} cx={p.x} cy={p.y} r="9" />
          ))}
        </g>
        <g className="heat-kern" filter="url(#heat-kern)">
          {punkte.map((p, i) => (
            <circle key={`k${i}`} cx={p.x} cy={p.y} r="3.5" />
          ))}
        </g>
      </svg>
    </div>
  )
}
