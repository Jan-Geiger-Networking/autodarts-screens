// Wiedererkennung eines Monitors ueber Neustarts hinweg.
//
// Die Kennung, die Electron einem Monitor gibt (Display.id), ist NICHT
// dauerhaft: Windows vergibt sie neu, wenn ein Bildschirm aus- und wieder
// eingeschaltet, umgesteckt oder der Rechner neu gestartet wird. Genau das
// ist der Normalfall in einer Huette, in der abends alles angeschaltet wird -
// mit der blanken Kennung staende der Player-Screen dann irgendwo.
//
// Deshalb wird ein Steckbrief gespeichert: Kennung, Beschriftung des Systems
// (unter Windows z.B. "\\.\DISPLAY1"), Aufloesung und Skalierung. Beim Suchen
// wird von genau nach grob abgestiegen, und eine Uebereinstimmung zaehlt nur,
// wenn sie EINDEUTIG ist - zwei gleiche Monitore duerfen nicht dazu fuehren,
// dass die Anwendung sich blind fuer einen entscheidet.
//
// Kein Import von 'electron': damit diese Regeln ohne laufende
// Electron-Runtime pruefbar bleiben (gleiche Trennung wie konfiguration.ts).

/** Steckbrief eines Monitors, wie er in der Konfiguration landet. */
export type MonitorKennung = {
  id: number
  label: string
  breite: number
  hoehe: number
  skalierung: number
}

/** Ein angeschlossener Monitor, auf das Noetige eingedampft. */
export type MonitorBeschreibung = MonitorKennung

/**
 * Sucht den gespeicherten Monitor unter den angeschlossenen.
 *
 * Reihenfolge, von genau nach grob. Jede Stufe zaehlt nur bei genau einem
 * Treffer:
 *   1. Beschriftung, Aufloesung und Skalierung - derselbe Monitor am
 *      selben Anschluss, unveraendert eingestellt.
 *   2. Beschriftung und Aufloesung - Skalierung wurde geaendert.
 *   3. Beschriftung allein - der Anschluss stimmt, die Aufloesung nicht
 *      (kommt vor, wenn ein Fernseher beim Einschalten erst eine
 *      Notaufloesung meldet).
 *   4. Aufloesung und Skalierung - der Monitor haengt an einem anderen
 *      Anschluss, ist aber der einzige seiner Art.
 *   5. Die alte Kennung - letzter Versuch; sie stimmt nur, wenn sich seit
 *      dem Speichern nichts geaendert hat.
 *
 * Liefert null, wenn nichts eindeutig passt. Dann ist der Monitor
 * offensichtlich nicht da - der Aufrufer wartet, statt das Fenster
 * irgendwohin zu legen.
 */
export function passendenMonitorWaehlen(
  kennung: MonitorKennung | null,
  vorhandene: readonly MonitorBeschreibung[],
): MonitorBeschreibung | null {
  if (!kennung || vorhandene.length === 0) return null

  const stufen: ((m: MonitorBeschreibung) => boolean)[] = [
    (m) =>
      m.label === kennung.label &&
      m.breite === kennung.breite &&
      m.hoehe === kennung.hoehe &&
      m.skalierung === kennung.skalierung,
    (m) => m.label === kennung.label && m.breite === kennung.breite && m.hoehe === kennung.hoehe,
    (m) => m.label !== '' && m.label === kennung.label,
    (m) => m.breite === kennung.breite && m.hoehe === kennung.hoehe && m.skalierung === kennung.skalierung,
    (m) => m.id === kennung.id,
  ]

  for (const passt of stufen) {
    const treffer = vorhandene.filter(passt)
    if (treffer.length === 1) return treffer[0]!
  }
  return null
}

/**
 * Liest eine gespeicherte Kennung. Alles Ungepruefte kommt aus einer Datei:
 * fehlt ein Feld oder hat es den falschen Typ, gilt die ganze Kennung als
 * nicht vorhanden - eine halbe Kennung fuehrt zu falschen Treffern.
 */
export function kennungEinlesen(roh: unknown): MonitorKennung | null {
  if (typeof roh !== 'object' || roh === null || Array.isArray(roh)) return null
  const k = roh as Record<string, unknown>
  if (!Number.isInteger(k.id)) return null
  if (typeof k.label !== 'string') return null
  if (!Number.isInteger(k.breite) || !Number.isInteger(k.hoehe)) return null
  if (typeof k.skalierung !== 'number' || !Number.isFinite(k.skalierung)) return null
  return {
    id: k.id as number,
    label: k.label,
    breite: k.breite as number,
    hoehe: k.hoehe as number,
    skalierung: k.skalierung,
  }
}
