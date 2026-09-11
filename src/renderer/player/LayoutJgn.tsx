// Player-Screen, Fassung "JGN Optimized".
//
// Entworfen nach der Skizze des Herausgebers und danach, was jemand braucht,
// der an der Scheibe steht: seine Restpunktzahl und den Weg dorthin, so gross
// wie moeglich. Alles andere tritt zurueck.
//
//   oben links   Spielerliste, zwei Spalten, bis acht Personen. Nur Name und
//                Punktzahl - mehr braucht es hier nicht, und der gesparte
//                Platz kommt dem zugute, was der Werfer wirklich ansieht.
//   darunter     Der Spieler am Wurf, aufgeklappt aus der Liste: Name,
//                Punktzahl sehr gross, darunter seine Aufnahmen im Leg.
//   ganz unten   Die drei Pfeile der Aufnahme. Geworfen steht weiss,
//                empfohlen in der Signalfarbe.
//   rechts oben  Das Herkunftszeichen - und an seiner Stelle die Einblendung,
//                sobald etwas passiert (180, Bullseye, Miss, Leg, Match).
//   rechts       Die Scheibe mit den gemessenen Auftreffpunkten.
//
// Die Ableitung der Einblendungen kommt aus useEinblendung() und ist mit der
// Default-Fassung geteilt: zwei Ableitungen desselben Ereignisses waeren zwei
// Gelegenheiten, auseinanderzulaufen.

import type { MatchState, Player, PlayerScore } from '../../shared/typen'
import logoWeiss from '../../../assets/logo-white.png'
import { Dartscheibe } from '../shared/Dartscheibe'
import { texte, useEinblendung } from './Einblendung'

/** Anzeigename eines Spielers. */
function namen(spieler: Player): string {
  return spieler.displayName.trim() !== '' ? spieler.displayName : spieler.autodartsName
}

/**
 * Die Spielerliste oben links. Zwei Spalten, damit auch acht Personen
 * hineinpassen, ohne dass die Zeilen unlesbar schmal werden - bei zwei bis
 * vier Spielern bleibt sie entsprechend flach.
 */
function SpielerStack({ zustand }: { zustand: MatchState }) {
  return (
    <div className={`jgn-stack jgn-stack-${Math.min(zustand.players.length, 8)}`}>
      {zustand.players.slice(0, 8).map((spieler) => {
        const score = zustand.scores.find((s) => s.playerId === spieler.id)
        const aktiv = spieler.id === zustand.activePlayerId
        return (
          <div className={`jgn-stack-eintrag${aktiv ? ' ist-aktiv' : ''}`} key={spieler.id}>
            <span className="jgn-stack-name">{namen(spieler)}</span>
            <span className="jgn-stack-score">{score?.remaining ?? '–'}</span>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Die Aufnahmen des Spielers am Wurf in diesem Leg, juengste zuletzt.
 * Zwei Spalten: was die Aufnahme gebracht hat und was danach blieb.
 */
function Aufnahmen({ zustand, spielerId }: { zustand: MatchState; spielerId: string }) {
  const eigene = zustand.legHistory.filter((e) => e.playerId === spielerId)
  // Nur die letzten sechs: darunter wird die Zeile zu niedrig, und aeltere
  // Aufnahmen interessieren beim Werfen nicht mehr.
  const sichtbare = eigene.slice(-6)
  if (sichtbare.length === 0) {
    return <p className="jgn-aufnahmen-leer">Noch keine Aufnahme in diesem Leg</p>
  }

  return (
    <table className="jgn-aufnahmen">
      <tbody>
        {sichtbare.map((eintrag, index) => (
          <tr key={`${index}-${eintrag.remainingAfter}`} className={eintrag.bust ? 'ist-bust' : undefined}>
            <td className="jgn-aufnahme-punkte">{eintrag.bust ? 'Bust' : eintrag.scored}</td>
            <td className="jgn-aufnahme-rest">{eintrag.remainingAfter}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * Die drei Pfeile der laufenden Aufnahme.
 *
 * Was schon steckt, steht weiss; was der Checkout-Weg vorschlaegt, steht in
 * der Signalfarbe. Damit ist auf einen Blick klar, was Vergangenheit ist und
 * was ein Vorschlag - der Unterschied entscheidet, ob jemand die Anzeige
 * ueberhaupt benutzen kann.
 */
function Pfeile({ zustand }: { zustand: MatchState }) {
  const geworfen = zustand.currentThrow
  const vorschlag = zustand.checkout ?? []

  return (
    <div className="jgn-pfeile">
      {[0, 1, 2].map((platz) => {
        const dart = geworfen[platz]
        const empfehlung = dart ? null : (vorschlag[platz - geworfen.length] ?? null)
        const text = dart?.name ?? empfehlung ?? '–'
        const art = dart ? 'ist-geworfen' : empfehlung ? 'ist-empfehlung' : 'ist-leer'
        return (
          <span className={`jgn-pfeil ${art}`} key={platz}>
            {text}
          </span>
        )
      })}
    </div>
  )
}

/**
 * Das Logofeld rechts oben. Im Normalfall steht dort das Herkunftszeichen;
 * sobald etwas passiert, tritt an seine Stelle die Einblendung - so wandert
 * der Blick nicht durchs Bild, und die Scheibe darunter bleibt frei.
 */
function Logofeld({ zustand }: { zustand: MatchState }) {
  const { anzeige, sichtbar } = useEinblendung(zustand)
  const u = anzeige?.ueberlagerung

  if (!u || !anzeige) {
    return (
      <div className="jgn-logofeld">
        <img className="jgn-logo" src={logoWeiss} alt="Jan Geiger Networking" />
      </div>
    )
  }

  const { oben, gross } = texte(zustand, u)
  return (
    <div
      className={`jgn-logofeld jgn-ereignis jgn-ereignis-${u.art}${sichtbar ? ' ist-sichtbar' : ' faehrt-aus'}`}
      key={anzeige.lauf}
      role="status"
      aria-live="polite"
    >
      <span className="jgn-ereignis-oben">{oben}</span>
      <span className="jgn-ereignis-gross">{gross}</span>
    </div>
  )
}

export function LayoutJgn({ zustand }: { zustand: MatchState }) {
  const amWurf: Player | undefined = zustand.players.find((p) => p.id === zustand.activePlayerId) ?? zustand.players[0]
  const score: PlayerScore | undefined = zustand.scores.find((s) => s.playerId === amWurf?.id)

  // Zwischen zwei Aufnahmen ist currentThrow leer - dann bleibt die letzte
  // vollstaendige Aufnahme gedaempft stehen, damit die Scheibe nie leer ist.
  const letzteAufnahme = [...zustand.legHistory].reverse().find((e) => e.darts.length > 0)
  const scheibenDarts = zustand.currentThrow.length > 0 ? zustand.currentThrow : (letzteAufnahme?.darts ?? [])

  return (
    <div className="jgn">
      <div className="jgn-links">
        <SpielerStack zustand={zustand} />

        <div className="jgn-aktiv">
          <span className="jgn-aktiv-name">{amWurf ? namen(amWurf) : ''}</span>
          <span className={`jgn-aktiv-score${zustand.bust ? ' ist-bust' : ''}`}>
            {zustand.bust ? 'Bust' : (score?.remaining ?? '–')}
          </span>
          {amWurf && <Aufnahmen zustand={zustand} spielerId={amWurf.id} />}
        </div>

        <Pfeile zustand={zustand} />
      </div>

      <div className="jgn-rechts">
        <Logofeld zustand={zustand} />
        <div className="jgn-scheibenfeld">
          <Dartscheibe darts={scheibenDarts} verblasst={zustand.currentThrow.length === 0} />
        </div>
      </div>
    </div>
  )
}
