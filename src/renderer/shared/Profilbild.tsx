// Profilbild eines Spielers: das im Control-Fenster zugeschnittene Bild
// (photoPath), sonst das Bild aus der API, sonst die Initialen. Die Groesse
// kommt aus der Klasse des Aufrufers - hier steht nur die Form.

import type { Player } from '../../shared/typen'

export function initialenVon(name: string): string {
  const kurz = name
    .split(/\s+/)
    .slice(0, 2)
    .map((teil) => teil[0] ?? '')
    .join('')
    .toUpperCase()
  return kurz || '?'
}

export function Profilbild({ spieler, className }: { spieler: Player; className: string }) {
  const quelle = spieler.photoPath ?? spieler.avatarUrl
  if (quelle) return <img className={`profilbild ${className}`} src={quelle} alt="" />
  return (
    <span className={`profilbild profilbild-initialen ${className}`} aria-hidden="true">
      {initialenVon(spieler.displayName || spieler.autodartsName)}
    </span>
  )
}
