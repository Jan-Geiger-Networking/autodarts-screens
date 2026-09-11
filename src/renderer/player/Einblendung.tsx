// Kurze Einblendungen auf dem Player-Screen: Spielerwechsel, 180, hohes
// Finish, gewonnenes Leg, gewonnenes Match.
//
// Der Bildschirm haengt gross und weit weg an der Scheibe ("der bildschirm
// ist noch sooo gros und recht weit weg vom spieler"). Deshalb gross genug,
// um im Vorbeigehen lesbar zu sein - aber ueber der Scheibe statt ueber den
// Spielertafeln: Restpunktzahl und Checkout-Weg bleiben immer sichtbar, denn
// dafuer steht der Bildschirm da. Nur das gewonnene Match nimmt die ganze
// Flaeche; danach ist ohnehin nichts mehr zu treffen.
//
// Deutlich kuerzer als auf dem Zuschauer-Screen ("ganz kurz"): dort ist die
// Einblendung das Programm, hier stoert sie beim Spielen, wenn sie steht.
//
// Die Ableitung, WAS zu zeigen ist, kommt aus szene.ts und ist mit dem
// Zuschauer-Screen geteilt - beide Bildschirme reagieren damit auf dasselbe
// Ereignis, statt zwei Auslegungen desselben MatchState zu pflegen.

import { useEffect, useRef, useState } from 'react'
import type { MatchState } from '../../shared/typen'
import { szeneAusZustand, type Ueberlagerung } from '../spectator/szene'
import { vorfuehrungEingefroren } from '../spectator/vorfuehrung'

/**
 * Standzeit je Anlass. Kurz genug, dass sie beim naechsten Wurf weg ist -
 * eine Aufnahme dauert selten unter vier Sekunden.
 */
const DAUER_MS: Record<Ueberlagerung['art'], number> = {
  playerChange: 1600,
  // Noch kuerzer als auf dem Zuschauer-Screen: hier steht der Werfer davor
  // und wirft gleich weiter.
  miss: 900,
  bigMoment: 2200,
  legWin: 2800,
  matchWin: 6000,
}

/** Dauer der Ein- und Ausfahrt, muss zu den @keyframes in App.css passen. */
const UEBERGANG_MS = 420

type Anzeige = {
  ueberlagerung: Ueberlagerung
  /** Zaehlt hoch, damit dieselbe Art zweimal hintereinander neu animiert. */
  lauf: number
}

function nameVon(zustand: MatchState, spielerId: string): string {
  const spieler = zustand.players.find((p) => p.id === spielerId)
  if (!spieler) return 'Spieler'
  return spieler.displayName.trim() !== '' ? spieler.displayName : spieler.autodartsName
}

/** Zeile und Beiwort je Anlass. */
export function texte(zustand: MatchState, u: Ueberlagerung): { oben: string; gross: string; unten?: string } {
  switch (u.art) {
    case 'playerChange':
      return { oben: 'Am Wurf', gross: nameVon(zustand, u.zuSpielerId) }
    case 'bigMoment':
      if (u.anlass === 'oneEighty') return { oben: nameVon(zustand, u.spielerId), gross: '180' }
      if (u.anlass === 'bullseye') return { oben: nameVon(zustand, u.spielerId), gross: 'Bullseye' }
      return { oben: nameVon(zustand, u.spielerId), gross: 'High Finish' }
    case 'miss':
      return { oben: nameVon(zustand, u.spielerId), gross: 'Miss' }
    case 'legWin':
      return { oben: 'Leg gewonnen', gross: nameVon(zustand, u.spielerId) }
    case 'matchWin':
      return { oben: 'Match gewonnen', gross: nameVon(zustand, u.spielerId), unten: 'Gut gespielt' }
  }
}

/**
 * Die gerade zu zeigende Einblendung, samt Ein- und Ausfahrt.
 *
 * Als Hook herausgezogen, weil das JGN-Layout dieselbe Ableitung braucht,
 * sie aber an anderer Stelle zeigt (im Logofeld statt ueber der Scheibe).
 * Zwei Ableitungen desselben Ereignisses waeren zwei Gelegenheiten,
 * auseinanderzulaufen.
 */
export function useEinblendung(zustand: MatchState): { anzeige: Anzeige | null; sichtbar: boolean } {
  // Die zuletzt verarbeitete Ereignisnummer. Als Ref, nicht als State: sie
  // darf kein Neuzeichnen ausloesen, sonst liefe die Einblendung zweimal.
  const verarbeitet = useRef(-1)
  const lauf = useRef(0)
  const [anzeige, setAnzeige] = useState<Anzeige | null>(null)
  const [sichtbar, setSichtbar] = useState(false)

  useEffect(() => {
    const ergebnis = szeneAusZustand(zustand, verarbeitet.current)
    verarbeitet.current = ergebnis.verarbeiteteSeq
    if (!ergebnis.ueberlagerung) return

    lauf.current += 1
    setAnzeige({ ueberlagerung: ergebnis.ueberlagerung, lauf: lauf.current })
    setSichtbar(true)
  }, [zustand])

  // Zwei Zeitgeber: erst ausblenden, dann aus dem Baum nehmen. Ohne den
  // zweiten bliebe ein unsichtbares Element ueber der Scheibe liegen.
  useEffect(() => {
    if (!anzeige || !sichtbar) return
    // Im auf einen Schritt eingefrorenen Vorfuehrmodus ist das Anhalten
    // dieses Moments der Zweck (Bildschirmfoto) - dann nicht verbergen.
    if (vorfuehrungEingefroren()) return
    const aus = window.setTimeout(() => setSichtbar(false), DAUER_MS[anzeige.ueberlagerung.art])
    return () => window.clearTimeout(aus)
  }, [anzeige, sichtbar])

  useEffect(() => {
    if (sichtbar || !anzeige) return
    const weg = window.setTimeout(() => setAnzeige(null), UEBERGANG_MS)
    return () => window.clearTimeout(weg)
  }, [sichtbar, anzeige])

  return { anzeige, sichtbar }
}

/**
 * Der Spielerwechsel als Bahn, die quer durchs Bild faehrt.
 *
 * Bewusst gross und bewusst quer ueber alles: der Bildschirm haengt weit weg
 * an der Scheibe, und wer gerade an der Reihe ist, muss aus jeder Ecke des
 * Raums zu erkennen sein ("animieren das ein neuer spielr drann ist wie so
 * ein slide und ganz gros welcher spieler jetzt dran ist"). Sie steht nur
 * anderthalb Sekunden - danach ist der Blick wieder frei fuer Restpunktzahl
 * und Checkout-Weg.
 *
 * position: fixed, damit dieselbe Bahn aus beiden Aufteilungen (Default und
 * JGN Optimized) ueber den ganzen Bildschirm geht, egal an welcher Stelle im
 * Baum sie haengt.
 */
export function SpielerSlide({ name, sichtbar, lauf }: { name: string; sichtbar: boolean; lauf: number }) {
  return (
    <div className="spielerslide" key={lauf} role="status" aria-live="polite">
      <div className={`spielerslide-bahn${sichtbar ? ' ist-sichtbar' : ' faehrt-aus'}`}>
        <span className="spielerslide-oben">Am Wurf</span>
        <span className="spielerslide-name">{name}</span>
      </div>
    </div>
  )
}

export function Einblendung({ zustand }: { zustand: MatchState }) {
  const { anzeige, sichtbar } = useEinblendung(zustand)
  if (!anzeige) return null

  const u = anzeige.ueberlagerung
  const { oben, gross, unten } = texte(zustand, u)

  // Der Spielerwechsel bekommt die grosse Bahn statt der kleinen Einblendung
  // ueber der Scheibe.
  if (u.art === 'playerChange') return <SpielerSlide name={gross} sichtbar={sichtbar} lauf={anzeige.lauf} />
  const klassen = [
    'einblendung',
    `einblendung-${u.art}`,
    sichtbar ? 'ist-sichtbar' : 'faehrt-aus',
    u.art === 'matchWin' ? 'einblendung-vollflaeche' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    // aria-live="polite": ein Vorleseprogramm meldet die Einblendung, sobald
    // es gerade nichts Wichtigeres sagt - es unterbricht nichts.
    <div className={klassen} key={anzeige.lauf} role="status" aria-live="polite">
      <span className="einblendung-oben">{oben}</span>
      <span className="einblendung-gross">{gross}</span>
      {unten && <span className="einblendung-unten">{unten}</span>}
    </div>
  )
}
