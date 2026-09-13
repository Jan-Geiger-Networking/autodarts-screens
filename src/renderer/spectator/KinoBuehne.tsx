// Gemeinsame Buehne des Pausenscreens (Vorspann und Matchtag), Stil "Kino".
// Siehe docs/superpowers/specs/2026-09-13-pausenscreen-kino-design.md, Abschnitt 4.
//
//  - Grund: Grainient (WebGL) mit halber Aufloesung, darunter immer ein
//    CSS-Verlauf in denselben Farben. Ohne WebGL 2 bleibt nur der stehen.
//  - Vignette, Logo oben links, "Spielpause" oben rechts.
//  - Verlaesst der Zuschauer-Screen die Pause, haengt App.tsx die Buehne aus;
//    Grainient gibt dabei seinen WebGL-Kontext frei.

import { Component, useEffect, useState, type ReactNode } from 'react'
import { useReducedMotion } from 'motion/react'
import logoWeiss from '../../../assets/logo-white.png'
import Grainient from './reactbits/Grainient'
import { vorfuehrOhneWebgl } from './vorfuehrung'
import './kino.css'

/** Wo der Verlauf sitzt. Werte wie Grainient: Versatz -0.5..0.5, Winkel in Grad. */
export type VerlaufLage = { centerX: number; centerY: number; blendAngle: number }

/** Dauer der Ueberblendung zwischen zwei Folien - muss zu kino.css passen. */
export const UEBERBLENDUNG_MS = 1500

/**
 * Farben des Verlaufs. "normal" bleibt sehr dunkel, damit weisse Schrift
 * darauf aus dem ganzen Raum lesbar ist; "hell" traegt die Siegerfolie.
 */
const FARBEN = {
  normal: { color1: '#0f5132', color2: '#020617', color3: '#073642', contrast: 1.35 },
  hell: { color1: '#15803d', color2: '#052e16', color3: '#0e7490', contrast: 1.2 },
} as const

let webgl2Ergebnis: boolean | null = null

/** Einmal je Programmlauf pruefen, ob WebGL 2 zur Verfuegung steht. */
function webgl2Verfuegbar(): boolean {
  if (vorfuehrOhneWebgl()) return false
  if (webgl2Ergebnis === null) {
    try {
      const gl = document.createElement('canvas').getContext('webgl2')
      webgl2Ergebnis = gl !== null
      gl?.getExtension('WEBGL_lose_context')?.loseContext()
    } catch {
      webgl2Ergebnis = false
    }
  }
  return webgl2Ergebnis
}

/**
 * Faengt einen Fehler ab, der trotz der webgl2Verfuegbar()-Vorabpruefung noch
 * beim Anlegen des Kontexts auftritt (siehe Spec Abschnitt 4: kein leerer
 * Schirm). Ohne diese Grenze wuerde React 19 bei einem Fehler im Effekt die
 * ganze Wurzel aushaengen - mit ihr bleibt nur die Grainient-Flaeche leer,
 * der CSS-Verlauf darunter (.kino-grund) traegt weiter.
 */
class WebglGrenze extends Component<{ children: ReactNode }, { fehler: boolean }> {
  state = { fehler: false }
  static getDerivedStateFromError() {
    return { fehler: true }
  }
  render() {
    return this.state.fehler ? null : this.props.children
  }
}

export function KinoBuehne({ lage, hell = false, children }: { lage: VerlaufLage; hell?: boolean; children: ReactNode }) {
  const stillstand = useReducedMotion() === true
  const [webgl] = useState(webgl2Verfuegbar)
  const farben = hell ? FARBEN.hell : FARBEN.normal

  return (
    <div className={`kino${hell ? ' kino--hell' : ''}`}>
      <div className="kino-grund" aria-hidden="true">
        {webgl && (
          <WebglGrenze>
            <Grainient
              color1={farben.color1}
              color2={farben.color2}
              color3={farben.color3}
              contrast={farben.contrast}
              centerX={lage.centerX}
              centerY={lage.centerY}
              blendAngle={lage.blendAngle}
              timeSpeed={0.12}
              warpSpeed={1.2}
              grainAmount={0.05}
              grainAnimated={false}
              maxDpr={0.5}
              stillstand={stillstand}
            />
          </WebglGrenze>
        )}
      </div>
      <div className="kino-vignette" aria-hidden="true" />
      {children}
      <img className="kino-logo" src={logoWeiss} alt="JGNet" />
      <div className="kino-pause">
        <span className="kino-pause-punkt" />
        Spielpause
      </div>
    </div>
  )
}

/**
 * Haelt den vorigen Wert fuer die Dauer der Ueberblendung fest: so kann die
 * alte Folie ausblenden, waehrend die neue einblendet. Danach null.
 */
export function useVorige<T>(aktuell: T, dauerMs: number = UEBERBLENDUNG_MS): T | null {
  // Der vorige Wert wird schon WAEHREND des Renders festgehalten, in dem sich
  // aktuell aendert (setState im Render, von React fuer abgeleiteten Zustand
  // vorgesehen). Ueber einen Effekt kaeme er erst einen Render spaeter - die
  // alte Folie waere dazwischen ausgehaengt und wuerde neu aufgebaut.
  const [stand, setStand] = useState<{ aktuell: T; vorige: T | null }>({ aktuell, vorige: null })
  if (!Object.is(stand.aktuell, aktuell)) {
    setStand({ aktuell, vorige: stand.aktuell })
  }
  const vorige = Object.is(stand.aktuell, aktuell) ? stand.vorige : stand.aktuell

  useEffect(() => {
    if (stand.vorige === null) return
    const zeit = window.setTimeout(() => setStand((s) => ({ aktuell: s.aktuell, vorige: null })), dauerMs)
    return () => window.clearTimeout(zeit)
  }, [stand, dauerMs])

  return vorige
}
