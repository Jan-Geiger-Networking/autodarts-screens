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

/**
 * Standzeit je Anlass. Kurz genug, dass sie beim naechsten Wurf weg ist -
 * eine Aufnahme dauert selten unter vier Sekunden.
 */
const DAUER_MS: Record<Ueberlagerung['art'], number> = {
  playerChange: 1600,
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
function texte(zustand: MatchState, u: Ueberlagerung): { oben: string; gross: string; unten?: string } {
  switch (u.art) {
    case 'playerChange':
      return { oben: 'Am Wurf', gross: nameVon(zustand, u.zuSpielerId) }
    case 'bigMoment':
      return u.anlass === 'oneEighty'
        ? { oben: nameVon(zustand, u.spielerId), gross: '180' }
        : { oben: nameVon(zustand, u.spielerId), gross: 'High Finish' }
    case 'legWin':
      return { oben: 'Leg gewonnen', gross: nameVon(zustand, u.spielerId) }
    case 'matchWin':
      return { oben: 'Match gewonnen', gross: nameVon(zustand, u.spielerId), unten: 'Gut gespielt' }
  }
}

export function Einblendung({ zustand }: { zustand: MatchState }) {
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
    const dauer = DAUER_MS[anzeige.ueberlagerung.art]
    const aus = window.setTimeout(() => setSichtbar(false), dauer)
    return () => window.clearTimeout(aus)
  }, [anzeige, sichtbar])

  useEffect(() => {
    if (sichtbar || !anzeige) return
    const weg = window.setTimeout(() => setAnzeige(null), UEBERGANG_MS)
    return () => window.clearTimeout(weg)
  }, [sichtbar, anzeige])

  if (!anzeige) return null

  const u = anzeige.ueberlagerung
  const { oben, gross, unten } = texte(zustand, u)
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
