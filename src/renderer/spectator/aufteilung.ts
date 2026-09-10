// Wie sich die Spielertafeln auf die beiden Seiten der Scheibe verteilen.
// Eigene Datei, damit die Regel ohne React pruefbar bleibt - dieselbe
// Trennung wie bei szene.ts und statistik.ts.

/**
 * Teilt die Spieler in eine linke und eine rechte Spalte. Die Mitte gehoert
 * immer der Dartscheibe, deshalb wird nie in die Mitte gesetzt: bis vier
 * Spieler ergibt das zwei Karten je Seite (die vier Ecken), ab fuenf drei je
 * Seite. Vorgabe des Herausgebers.
 *
 * Aufgerundet nach links: bei ungerader Anzahl steht einer mehr links, damit
 * die Aufteilung bei jeder Spielerzahl vorhersagbar bleibt.
 */
export function spielerAufteilen<T>(spieler: readonly T[]): { links: T[]; rechts: T[] } {
  const trenn = Math.ceil(spieler.length / 2)
  return { links: spieler.slice(0, trenn), rechts: spieler.slice(trenn) }
}
