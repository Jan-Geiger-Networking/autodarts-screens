// Der Balken am unteren Bildschirmrand.
//
// Er laeuft in der Standzeit der gerade gezeigten Folie von links nach rechts
// und sagt damit, wann umgeblaettert wird ("mach mal im viewer unten einen
// gruehnen balken der von links nach rechts geht das man sieht wann weiter
// geblaettert wird"). Im Fernsehen macht das dasselbe wie die Fortschritts-
// leiste einer Story: man weiss, ob es sich lohnt, noch hinzusehen.
//
// Die Zeit laeuft in CSS ab, nicht in JavaScript: eine Animation mit
// animation-duration kostet keinen einzigen Neuaufbau des Bildes und laeuft
// auch dann rund, wenn der Hauptprozess gerade Ereignisse verarbeitet. Der
// Schluessel setzt sie zurueck - React baut das Element bei einem neuen
// Schluessel neu auf, und damit beginnt die Animation von vorn.

export function Fortschritt({ dauerMs, schluessel }: { dauerMs: number; schluessel: string }) {
  return (
    <div className="fortschritt" aria-hidden="true">
      <span className="fortschritt-balken" key={schluessel} style={{ animationDuration: `${dauerMs}ms` }} />
    </div>
  )
}
