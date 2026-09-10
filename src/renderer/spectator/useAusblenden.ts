import { useEffect, useState } from 'react'

/**
 * Haelt ein Element ueber das Verschwinden hinaus im Baum, damit eine
 * gerichtete CSS-Ausfahrt ablaufen kann, bevor React es entfernt: der
 * Aufrufer setzt `sichtbar` auf false, bekommt `imBaum` aber noch fuer
 * `dauerMs` weiterhin true zurueck und schaltet in dieser Zeit per CSS-Klasse
 * von "eingefahren" auf "ausfahrend" um. Respektiert prefers-reduced-motion:
 * dann faellt das Element sofort aus dem Baum, es geht aber keine Information
 * verloren - der Inhalt war ja schon sichtbar.
 */
export function useAusblenden(sichtbar: boolean, dauerMs: number): boolean {
  const [imBaum, setImBaum] = useState(sichtbar)

  useEffect(() => {
    if (sichtbar) {
      setImBaum(true)
      return
    }
    const reduziert = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(() => setImBaum(false), reduziert ? 0 : dauerMs)
    return () => window.clearTimeout(timer)
  }, [sichtbar, dauerMs])

  return imBaum
}
