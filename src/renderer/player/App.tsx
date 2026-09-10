// Player-Screen: der Bildschirm neben der Scheibe. Aufbau nach dem Vorbild
// der Autodarts-Spielansicht (Vorgabe des Herausgebers mit Bildschirmfoto):
// links und rechts je eine Spielertafel, dazwischen die Dartscheibe, darueber
// die drei Darts der laufenden Aufnahme, unter jeder Tafel der Verlauf des
// laufenden Legs.
//
// Zwei bewusste Abweichungen vom Vorbild:
//  - Die aktive Tafel traegt die Signalfarbe dieses Projekts statt des
//    Autodarts-Magenta. Beide Screens dieser Anwendung sollen dieselbe
//    Farbsprache sprechen.
//  - Der Checkout-Weg steht gross unter der Punktzahl des Spielers am Wurf.
//    Er ist der eigentliche Zweck dieses Bildschirms (Spec Abschnitt 7),
//    waehrend Autodarts ihn nur nebenbei zeigt.

import { useEffect, useState } from 'react'
import type { LegEntry, MatchState, Player, PlayerScore } from '../../shared/typen'
import logoWeiss from '../../../assets/logo-white.png'
import { Dartscheibe } from '../shared/Dartscheibe'
import { spielerAufteilen } from '../spectator/aufteilung'
import { legStatistik } from '../spectator/statistik'
import { useVorfuehrung, vorfuehrungAktiv } from '../spectator/vorfuehrung'
import '../shared/tokens.css'
import './App.css'

/** Dart-Zeichen wie im Vorbild: ein Pfeil von der Seite. */
function DartSymbol({ gefuellt }: { gefuellt: boolean }) {
  return (
    <svg className={`dartsymbol${gefuellt ? ' gefuellt' : ''}`} viewBox="0 0 64 16" aria-hidden="true">
      <path d="M2 8 H44 M44 2 L60 8 L44 14 Z M8 3 L14 8 L8 13 Z" />
    </svg>
  )
}

/** Initialen als Ersatz fuer ein Spielerfoto - es gibt bisher keines. */
function initialenVon(name: string): string {
  const kurz = name
    .split(/\s+/)
    .slice(0, 2)
    .map((teil) => teil[0] ?? '')
    .join('')
    .toUpperCase()
  return kurz || '?'
}

/**
 * Verlauf des laufenden Legs als zweispaltige Tabelle wie im Vorbild: links
 * die geworfenen Punkte, rechts der Rest danach. Die erste Zeile traegt den
 * Startwert, damit die Spalte nie leer beginnt.
 */
const VERLAUF_ZEILEN = 5

function Verlaufstabelle({ eintraege, startScore }: { eintraege: LegEntry[]; startScore: number }) {
  // Nur die juengsten Aufnahmen: die Tafel darf nicht mit dem Leg wachsen,
  // sonst stehen die beiden Tafeln nicht mehr auf gleicher Hoehe und die
  // letzte Zeile wird am Rand abgeschnitten. Die Startzeile faellt weg,
  // sobald genug echte Aufnahmen da sind.
  const gezeigt = eintraege.slice(-VERLAUF_ZEILEN)
  const startZeigen = gezeigt.length < VERLAUF_ZEILEN

  return (
    <div className="verlauf">
      {startZeigen && (
        <div className="verlauf-zeile">
          <span className="verlauf-punkte" />
          <span className="verlauf-rest">{startScore}</span>
        </div>
      )}
      {gezeigt.map((eintrag, i) => (
        <div className="verlauf-zeile" key={i}>
          <span className={`verlauf-punkte${eintrag.bust ? ' bust' : ''}`}>
            {eintrag.bust ? 'Bust' : eintrag.scored}
          </span>
          <span className="verlauf-rest">{eintrag.remainingAfter}</span>
        </div>
      ))}
    </div>
  )
}

function Spielertafel({
  spieler,
  score,
  aktiv,
  bust,
  zugPunkte,
  legHistory,
  startScore,
  checkout,
  checkoutHinweis,
}: {
  spieler: Player
  score: PlayerScore | undefined
  aktiv: boolean
  bust: boolean
  zugPunkte: number
  legHistory: LegEntry[]
  startScore: number
  checkout: string[] | null
  checkoutHinweis: string | null
}) {
  const eigene = legHistory.filter((e) => e.playerId === spieler.id)
  const leg = legStatistik(legHistory, spieler.id)
  const checkoutIstSetup = !checkout && checkoutHinweis !== null
  const wuerfe = aktiv ? (checkout ?? (checkoutHinweis ? [checkoutHinweis] : [])) : []

  return (
    <div className={`tafel${aktiv ? ' aktiv' : ''}`}>
      <div className="tafel-kopf">
        <span className={`tafel-punkt${aktiv ? '' : ' unsichtbar'}`} aria-hidden="true" />
        <span className="tafel-avatar">{initialenVon(spieler.displayName)}</span>
        <span className="tafel-name">{spieler.displayName}</span>
        {spieler.country && <span className="tafel-land">{spieler.country}</span>}
      </div>

      <div className="tafel-rest-zeile">
        <span className={`tafel-rest${bust ? ' bust' : ''}`}>{score?.remaining ?? startScore}</span>
        {/* Punkte der laufenden Aufnahme - im Vorbild das kleine Kaestchen
            rechts neben der grossen Zahl. */}
        <span className="tafel-zug">{aktiv ? zugPunkte : 0}</span>
      </div>

      <div className="tafel-schnitte">
        <span className="tafel-label">Leg</span> {leg.schnitt === null ? '0.0' : leg.schnitt.toFixed(1)}
        <span className="tafel-trenner">/</span>
        <span className="tafel-label">Match</span> {score?.average3 == null ? '0.0' : score.average3.toFixed(1)}
      </div>

      <div className="tafel-darts">
        <DartSymbol gefuellt />
        {leg.darts}
      </div>

      {/* Der Grund, warum dieser Bildschirm neben der Scheibe haengt: was zu
          werfen ist. Nur beim Spieler am Wurf - der Platz bleibt aber immer
          reserviert, damit beide Tafeln gleich hoch bleiben und beim
          Spielerwechsel nichts springt. */}
      <div className={`tafel-checkout${checkoutIstSetup ? ' setup' : ''}${wuerfe.length === 0 ? ' leer' : ''}`}>
        {wuerfe.map((wurf, i) => (
          <span className="checkout-wurf" key={i}>
            {wurf}
          </span>
        ))}
        {wuerfe.length === 0 && <span className="checkout-wurf">&nbsp;</span>}
      </div>

      <Verlaufstabelle eintraege={eigene} startScore={startScore} />
    </div>
  )
}

export function App() {
  // Vorfuehrmodus (?vorfuehrung in der Adresse) ersetzt window.app komplett -
  // derselbe Schalter wie beim Zuschauer-Screen, damit sich der Aufbau auch
  // ohne laufendes Match begutachten laesst (?schritt=N haelt eine Szene an).
  const vorfuehrung = vorfuehrungAktiv()
  const vorfuehrZustand = useVorfuehrung()
  const [echterZustand, setEchterZustand] = useState<MatchState | null>(null)

  useEffect(() => {
    if (vorfuehrung) return
    return window.app.beiZustand(setEchterZustand)
  }, [vorfuehrung])

  const zustand = vorfuehrung ? vorfuehrZustand : echterZustand

  // Kein Zustand, Ruhezustand oder kein Spieler bekannt: nur das Logo auf
  // dunklem Grund. Kein Blinken, keine Bewegung - dieser Bildschirm haengt
  // neben der Scheibe und darf niemanden beim Werfen stoeren.
  if (!zustand || zustand.phase === 'idle' || zustand.players.length === 0) {
    return (
      <div className="ruhezustand">
        <img className="ruhezustand-logo" src={logoWeiss} alt="JGNet" />
      </div>
    )
  }

  const { links, rechts } = spielerAufteilen(zustand.players)
  const scoreVon = (id: string) => zustand.scores.find((s) => s.playerId === id)

  // Zwischen zwei Aufnahmen ist currentThrow leer - dann bleibt die letzte
  // vollstaendige Aufnahme gedaempft stehen, damit die Scheibe nie leer ist.
  const letzteAufnahme = [...zustand.legHistory].reverse().find((e) => e.darts.length > 0)
  const scheibenDarts = zustand.currentThrow.length > 0 ? zustand.currentThrow : (letzteAufnahme?.darts ?? [])
  const scheibeVerblasst = zustand.currentThrow.length === 0

  const tafel = (spieler: Player) => (
    <Spielertafel
      key={spieler.id}
      spieler={spieler}
      score={scoreVon(spieler.id)}
      aktiv={spieler.id === zustand.activePlayerId}
      bust={spieler.id === zustand.activePlayerId && zustand.bust}
      zugPunkte={zustand.currentThrowTotal}
      legHistory={zustand.legHistory}
      startScore={zustand.startScore}
      checkout={zustand.checkout}
      checkoutHinweis={zustand.checkoutHint}
    />
  )

  return (
    <div className="spielbildschirm">
      <div className="einstellungen">
        <span className="einstellung">{zustand.startScore}</span>
        {zustand.variantName !== '' && <span className="einstellung">{zustand.variantName}</span>}
      </div>

      {/* Die drei Darts der laufenden Aufnahme mit ihrer Summe - im Vorbild
          die Leiste oben in der Mitte. */}
      <div className="wurfleiste">
        {[0, 1, 2].map((i) => {
          const dart = zustand.currentThrow[i]
          return (
            <span className={`wurfplatz${dart ? ' belegt' : ''}`} key={i}>
              <DartSymbol gefuellt={Boolean(dart)} />
              <span className="wurfplatz-name">{dart?.name ?? ''}</span>
            </span>
          )
        })}
        <span className={`wurfsumme${zustand.bust ? ' bust' : ''}`}>
          {zustand.bust ? 'Bust' : zustand.currentThrowTotal}
        </span>
      </div>

      <div className="spielflaeche">
        <div className="tafelspalte">{links.map(tafel)}</div>

        <div className="scheibenfeld">
          <Dartscheibe darts={scheibenDarts} verblasst={scheibeVerblasst} />
        </div>

        <div className="tafelspalte">{rechts.map(tafel)}</div>
      </div>

      <img className="bug" src={logoWeiss} alt="JGNet" />
    </div>
  )
}
