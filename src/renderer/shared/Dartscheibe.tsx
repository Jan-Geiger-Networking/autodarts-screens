// Kleine Dartscheibe in der Mitte des Scoreboards: zeigt, wohin die Darts des
// laufenden Zuges gegangen sind. Die Scheibe selbst ist statisch, nur die
// Treffer wechseln - deshalb wird sie einmal aus SEKTOREN aufgebaut und
// danach nur noch mit Markierungen belegt.
//
// Farben bewusst wie an einer echten Scheibe (schwarz/creme, Ringe rot/gruen),
// aber abgedunkelt: sie muss auf einem dunklen Screen liegen, ohne ihn zu
// ueberstrahlen. Die Treffermarkierungen tragen die Signalfarbe des Screens.

import type { Segment } from '../../shared/typen'
import { dartPosition, RADIUS, SEKTOR_WINKEL, SEKTOREN, sektorWinkel } from './scheibengeometrie'
import './dartscheibe.css'

/** Ein Ringstueck eines Sektors als SVG-Pfad. */
function sektorPfad(zahl: number, innen: number, aussen: number): string {
  const mitte = sektorWinkel(zahl)
  const von = ((mitte - SEKTOR_WINKEL / 2) * Math.PI) / 180
  const bis = ((mitte + SEKTOR_WINKEL / 2) * Math.PI) / 180
  const p = (radius: number, bogen: number) => `${(Math.cos(bogen) * radius).toFixed(3)} ${(Math.sin(bogen) * radius).toFixed(3)}`
  return [
    `M ${p(innen, von)}`,
    `L ${p(aussen, von)}`,
    `A ${aussen} ${aussen} 0 0 1 ${p(aussen, bis)}`,
    `L ${p(innen, bis)}`,
    `A ${innen} ${innen} 0 0 0 ${p(innen, von)}`,
    'Z',
  ].join(' ')
}

export function Dartscheibe({
  darts,
  verblasst = false,
  dunkel = false,
}: {
  darts: Segment[]
  verblasst?: boolean
  /**
   * Dunkle Fassung: die hellen Felder werden fast schwarz. Auf dem
   * Zuschauer-Screen gewuenscht ("die dart scheiben farbe aendern") - die
   * cremefarbene Scheibe zog dort zu viel Aufmerksamkeit auf sich, neben
   * einem Spielstand, der die eigentliche Nachricht ist.
   */
  dunkel?: boolean
}) {
  return (
    <svg className={`dartscheibe${dunkel ? ' dartscheibe-dunkel' : ''}`} viewBox="-115 -115 230 230" role="img" aria-label="Trefferbild des laufenden Wurfs">
      <circle className="scheibe-rand" cx="0" cy="0" r="108" />

      {SEKTOREN.map((zahl, index) => {
        // Gerade/ungerade Sektoren wechseln sich in der Farbe ab - wie auf
        // einer echten Scheibe, damit sich benachbarte Felder trennen.
        const hell = index % 2 === 0
        return (
          <g key={zahl}>
            <path className={hell ? 'feld-hell' : 'feld-dunkel'} d={sektorPfad(zahl, RADIUS.bullAussen, RADIUS.tripleInnen)} />
            <path className={hell ? 'ring-gruen' : 'ring-rot'} d={sektorPfad(zahl, RADIUS.tripleInnen, RADIUS.tripleAussen)} />
            <path className={hell ? 'feld-hell' : 'feld-dunkel'} d={sektorPfad(zahl, RADIUS.tripleAussen, RADIUS.doppelInnen)} />
            <path className={hell ? 'ring-gruen' : 'ring-rot'} d={sektorPfad(zahl, RADIUS.doppelInnen, RADIUS.doppelAussen)} />
          </g>
        )
      })}

      <circle className="ring-gruen-flaeche" cx="0" cy="0" r={RADIUS.bullAussen} />
      <circle className="ring-rot-flaeche" cx="0" cy="0" r={RADIUS.bull} />

      {SEKTOREN.map((zahl) => {
        const bogen = (sektorWinkel(zahl) * Math.PI) / 180
        return (
          <text key={zahl} className="scheibe-zahl" x={Math.cos(bogen) * 106} y={Math.sin(bogen) * 106}>
            {zahl}
          </text>
        )
      })}

      {darts.map((dart, index) => {
        const { x, y } = dartPosition(dart, index)
        return (
          <g
            key={`${dart.name}-${index}`}
            className={`treffer${verblasst ? ' treffer-vorher' : ''}`}
            style={{ animationDelay: `${index * 90}ms` }}
          >
            {/* Drei Ringe uebereinander: der dunkle Hof hebt den Treffer von
                jeder Feldfarbe ab (auf dem cremefarbenen Feld ging ein rein
                gruener Punkt vorher unter), der helle Ring gibt die Kante,
                der Kern die Signalfarbe.
                Die Groesse ist bewusst klein: Autodarts zeichnet einen Punkt
                mit einem Hundertstel des Scheibenradius. Vorher war er hier
                fuenfmal so gross und deckte halbe Felder zu - der Treffer sass
                richtig, sah aber falsch aus. Etwas groesser als das Vorbild
                bleibt er trotzdem, weil diese Scheibe kleiner dargestellt
                wird. */}
            <circle className="treffer-schatten" cx={x} cy={y} r="4.2" />
            <circle className="treffer-hof" cx={x} cy={y} r="3" />
            <circle className="treffer-kern" cx={x} cy={y} r="1.9" />
          </g>
        )
      })}
    </svg>
  )
}
