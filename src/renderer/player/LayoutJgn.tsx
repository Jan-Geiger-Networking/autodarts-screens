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
//   ueber allem  Das Vollbild: die Summe der Aufnahme bzw. der Leg-Sieger, bis
//                die Pfeile gezogen sind, dann der naechste Spieler am Wurf.
//
// Die Ableitung der Einblendungen kommt aus useEinblendung() und ist mit der
// Default-Fassung geteilt: zwei Ableitungen desselben Ereignisses waeren zwei
// Gelegenheiten, auseinanderzulaufen.

import { useEffect, useState } from 'react'
import type { MatchState, Player, PlayerScore } from '../../shared/typen'
import logoWeiss from '../../../assets/logo-white.png'
import { Dartscheibe } from '../shared/Dartscheibe'
import { Profilbild } from '../shared/Profilbild'
import { texte, useEinblendung } from './Einblendung'
import { vollbildAus, type Vollbild } from './vollbild'

/** Ein Average mit einer Nachkommastelle, oder ein Strich. */
function zahlOderStrich(wert: number | null): string {
  return wert === null || !Number.isFinite(wert) ? '–' : wert.toFixed(1)
}

/** Pfeil von der Seite - dasselbe Zeichen wie in der Default-Fassung. */
function DartSymbol() {
  return (
    <svg className="jgn-dartsymbol" viewBox="0 0 64 16" aria-hidden="true">
      <path d="M2 8 H44 M44 2 L60 8 L44 14 Z M8 3 L14 8 L8 13 Z" />
    </svg>
  )
}

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
            {/* Bild und Name bilden die linke Spalte, damit Sets/Legs genau
                in der Mitte des Feldes stehen. */}
            <span className="jgn-stack-wer">
              <Profilbild spieler={spieler} className="jgn-stack-bild" />
              <span className="jgn-stack-name">{namen(spieler)}</span>
            </span>
            <span className="jgn-stack-stand">
              S {score?.sets ?? 0} · L {score?.legs ?? 0}
            </span>
            <span className="jgn-stack-score">{score?.remaining ?? '–'}</span>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Zeilen, die eine Tabelle fasst, bevor die naechste daneben beginnt. Die
 * Spielerliste darueber waechst mit der Spielerzahl, alle Masse sind in vh -
 * die Zahl haengt deshalb nur an der Spielerzahl, nicht an der Aufloesung.
 * Im Browser nachgemessen: mehr Zeilen schneiden den Block oben und unten ab.
 */
function zeilenJeTabelle(spieler: number): number {
  return spieler <= 4 ? 5 : spieler <= 6 ? 3 : 2
}

/**
 * Die Aufnahmen des Spielers am Wurf in diesem Leg, juengste zuletzt.
 * Je Zeile: was die Aufnahme gebracht hat und was danach blieb. Ist die
 * erste Tabelle voll, beginnt rechts daneben die zweite; ist auch die voll,
 * faellt die aelteste Zeile weg - aeltere Aufnahmen interessieren beim
 * Werfen nicht mehr.
 */
function Aufnahmen({ zustand, spielerId }: { zustand: MatchState; spielerId: string }) {
  const proTabelle = zeilenJeTabelle(zustand.players.length)
  const zeilen = [
    // Erste Zeile ohne Punkte: die Startpunktzahl, von der aus gezaehlt
    // wird - genauso wie in der Autodarts-Ansicht.
    { punkte: '', rest: zustand.startScore, bust: false },
    ...zustand.legHistory
      .filter((e) => e.playerId === spielerId)
      .map((e) => ({ punkte: e.bust ? 'Bust' : String(e.scored), rest: e.remainingAfter, bust: e.bust })),
  ].slice(-2 * proTabelle)
  const tabellen = [zeilen.slice(0, proTabelle), zeilen.slice(proTabelle)].filter((t) => t.length > 0)

  return (
    <div className="jgn-aufnahmen-tabellen">
      {tabellen.map((tabelle, t) => (
        <table className="jgn-aufnahmen" key={t}>
          <tbody>
            {tabelle.map((zeile, index) => (
              <tr key={index} className={zeile.bust ? 'ist-bust' : undefined}>
                <td className="jgn-aufnahme-punkte">{zeile.punkte}</td>
                <td className="jgn-aufnahme-rest">
                  <span className="jgn-restkasten">{zeile.rest}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
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
        // Ein Miss steht rot: daneben ist daneben, das soll man sofort sehen.
        const art = dart ? (dart.value === 0 ? 'ist-geworfen ist-miss' : 'ist-geworfen') : empfehlung ? 'ist-empfehlung' : 'ist-leer'
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

  // Der Spielerwechsel gehoert nicht ins Logofeld: ihn zeigt das Vollbild,
  // zusammen mit der Summe der Aufnahme davor.
  if (!u || !anzeige || u.art === 'playerChange') {
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

/** Schieben (600 ms, siehe App.css) plus anderthalb Sekunden Stehen. */
const AM_WURF_MS = 2100
/** Muss zur Ausblende-Transition in App.css passen. */
const AUSBLENDEN_MS = 420

type Lage = {
  inhalt: Vollbild
  /** steht: Pfeile stecken. wechsel: der Naechste ist hereingeschoben. */
  stufe: 'steht' | 'wechsel' | 'aus'
  naechster: string | null
  /** Zaehlt hoch, damit jede neue Aufnahme wieder einfaehrt. */
  lauf: number
}

/**
 * Ueber den ganzen Monitor, damit man es aus jeder Ecke sieht: erst die
 * geworfene Summe (oder der Leg-Sieger), stehend bis die Pfeile gezogen sind,
 * dann schiebt sich der naechste Spieler am Wurf herein - eine Bewegung.
 */
function VollbildAnzeige({ zustand }: { zustand: MatchState }) {
  const [lage, setLage] = useState<Lage | null>(null)

  useEffect(() => {
    const jetzt = vollbildAus(zustand)
    setLage((vorher) => {
      if (jetzt) {
        // Weitere Momentaufnahmen desselben Moments (doppelte Meldung, eine
        // Korrektur in Autodarts) tauschen nur den Inhalt, ohne neu einzufahren.
        const lauf = vorher?.stufe === 'steht' ? vorher.lauf : (vorher?.lauf ?? 0) + 1
        return { inhalt: jetzt, stufe: 'steht', naechster: null, lauf }
      }
      if (!vorher) return null
      if (vorher.stufe === 'steht') {
        // Pfeile gezogen. Nach dem Match ist niemand mehr am Wurf.
        const naechster = vorher.inhalt.art === 'match' ? null : zustand.activePlayerId
        return naechster && zustand.currentThrow.length === 0
          ? { ...vorher, stufe: 'wechsel', naechster }
          : { ...vorher, stufe: 'aus' }
      }
      // Der Naechste wirft schon - dann sofort weg.
      if (vorher.stufe === 'wechsel' && zustand.currentThrow.length > 0) return { ...vorher, stufe: 'aus' }
      return vorher
    })
  }, [zustand])

  const stufe = lage?.stufe
  useEffect(() => {
    if (stufe !== 'wechsel' && stufe !== 'aus') return
    const zeit = window.setTimeout(
      () => setLage((l) => (l?.stufe === 'wechsel' ? { ...l, stufe: 'aus' } : l?.stufe === 'aus' ? null : l)),
      stufe === 'wechsel' ? AM_WURF_MS : AUSBLENDEN_MS,
    )
    return () => window.clearTimeout(zeit)
  }, [stufe, lage?.lauf])

  if (!lage) return null
  const { inhalt, naechster } = lage
  const name = (id: string | null) => {
    const spieler = zustand.players.find((p) => p.id === id)
    return spieler ? namen(spieler) : ''
  }
  const naechsterSpieler = zustand.players.find((p) => p.id === naechster)

  return (
    <div
      className={`jgn-vollbild ist-${lage.stufe}${naechster ? ' mit-wechsel' : ''}`}
      key={lage.lauf}
      role="status"
      aria-live="polite"
    >
      <div className="jgn-vollbild-film">
        {inhalt.art === 'aufnahme' ? (
          <div className="jgn-vollbild-bild">
            <span className="jgn-vollbild-oben jgn-vollbild-werfer">{name(inhalt.spielerId)}</span>
            <span className={`jgn-vollbild-zahl${inhalt.bust ? ' ist-bust' : ''}`}>
              {inhalt.bust ? 'Bust' : inhalt.punkte}
            </span>
          </div>
        ) : (
          <div className="jgn-vollbild-bild jgn-vollbild-sieg">
            <span className="jgn-vollbild-oben">{inhalt.art === 'match' ? 'Match gewonnen' : 'Leg gewonnen'}</span>
            <span className="jgn-vollbild-name">{name(inhalt.spielerId)}</span>
            {inhalt.finish !== null && <span className="jgn-vollbild-unten">Finish {inhalt.finish}</span>}
          </div>
        )}
        <div className="jgn-vollbild-bild jgn-vollbild-amwurf">
          {naechsterSpieler && <Profilbild spieler={naechsterSpieler} className="jgn-vollbild-profil" />}
          <span className="jgn-vollbild-oben">Am Wurf</span>
          <span className="jgn-vollbild-name">{name(naechster)}</span>
        </div>
      </div>
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

          {/* Punktzahl und daneben, klein, was die laufende Aufnahme bisher
              gebracht hat - dieselbe Anordnung wie in der Autodarts-Ansicht. */}
          <div className="jgn-aktiv-zeile">
            <span className={`jgn-aktiv-score${zustand.bust ? ' ist-bust' : ''}`}>
              {zustand.bust ? 'Bust' : (score?.remaining ?? '–')}
            </span>
            <span className="jgn-aktiv-zug">{zustand.currentThrowTotal}</span>
          </div>

          <p className="jgn-aktiv-schnitt">
            Leg <strong>{zahlOderStrich(score?.legAverage ?? null)}</strong> / Match{' '}
            <strong>{zahlOderStrich(score?.average3 ?? null)}</strong>
          </p>

          <p className="jgn-aktiv-darts">
            <DartSymbol />
            {score?.dartsGesamt ?? 0}
          </p>

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

      <VollbildAnzeige zustand={zustand} />
    </div>
  )
}
