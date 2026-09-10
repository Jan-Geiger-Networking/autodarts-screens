// Vorfuehrmodus: spielt ohne Hauptprozess eine feste Abfolge erfundener
// MatchState-Schnappschuesse durch, die alle sieben Szenen aus Abschnitt 8
// der Spec der Reihe nach zeigt. Aktiviert per Adresse: ?vorfuehrung spielt
// die Tour automatisch durch (echte Anzeigedauern), ?vorfuehrung&schritt=N
// friert auf Schritt N ein - so lassen sich Bildschirmfotos gezielt ohne
// Warten aufnehmen. Bleibt dauerhaft im Code: jede kuenftige Layout-Aenderung
// braucht denselben Weg zum Nachsehen, ganz ohne laufende Autodarts-Verbindung.

import { useEffect, useState } from 'react'
import type { LegEntry, MatchState, Player, Segment } from '../../shared/typen'
import { checkoutWeg, setupWurf } from '../../shared/checkout'

function segmentAusName(name: string): Segment {
  if (name === 'BULL') return { name, value: 25, multiplier: 2 }
  const vielfach: 1 | 2 | 3 = name.startsWith('T') ? 3 : name.startsWith('D') ? 2 : 1
  const zahl = Number(vielfach === 1 ? name : name.slice(1))
  return { name, value: zahl, multiplier: vielfach }
}

function dartsAusWeg(weg: string[] | null): Segment[] {
  return (weg ?? []).map(segmentAusName)
}

// Kleines eingebettetes Bild statt einer echten URL: der Vorfuehrmodus muss
// wie die Anwendung selbst ohne Internetzugang laufen. Zeigt gleichzeitig,
// dass Player.photoPath tatsaechlich als <img> gerendert wird - Jan bleibt
// ohne Bild, um den Initialen-Fallback zu zeigen.
const FOTO_MARKUS =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">' +
      '<rect width="200" height="200" fill="#0f1a2e"/>' +
      '<circle cx="100" cy="78" r="42" fill="#04FC4C"/>' +
      '<rect x="38" y="128" width="124" height="60" rx="4" fill="#04FC4C"/>' +
      '</svg>',
  )

const SPIELER: Player[] = [
  { id: 'p1', autodartsName: 'jan_de', displayName: 'Jan', country: 'DE' },
  { id: 'p2', autodartsName: 'markus_de', displayName: 'Markus', country: 'DE', photoPath: FOTO_MARKUS },
]

type Basis = Omit<MatchState, 'checkout' | 'checkoutHint'>

// checkout/checkoutHint werden nicht Hand-gepflegt, sondern wie im echten
// Hauptprozess (siehe src/main/index.ts, testZustandStarten) ueber die
// tatsaechliche Checkout-Logik ermittelt - der Spectator-Screen selbst
// rechnet nichts, aber die Vorfuehr-Fixture darf die vorhandene Funktion
// wiederverwenden statt Wege von Hand zu erfinden. Der Rest des aktiven
// Spielers kommt direkt aus scores, keine eigene Buchhaltung noetig.
function mitCheckout(basis: Basis): MatchState {
  const restAktiv = basis.scores.find((s) => s.playerId === basis.activePlayerId)?.remaining ?? 0
  const weg = checkoutWeg(restAktiv, 3)
  return { ...basis, checkout: weg, checkoutHint: weg ? null : setupWurf(restAktiv) }
}

const leg2Verlauf: LegEntry[] = [
  { playerId: 'p1', darts: [segmentAusName('T20'), segmentAusName('T20'), segmentAusName('T20')], scored: 180, remainingAfter: 321, bust: false },
  { playerId: 'p1', darts: [segmentAusName('T20'), segmentAusName('T20'), segmentAusName('D10')], scored: 140, remainingAfter: 181, bust: false },
  { playerId: 'p1', darts: [segmentAusName('T15')], scored: 45, remainingAfter: 136, bust: false },
  { playerId: 'p1', darts: [segmentAusName('T6'), segmentAusName('8')], scored: 26, remainingAfter: 110, bust: false },
]

const scoreLeer = (playerId: string) => ({
  playerId,
  remaining: 501,
  legs: 0,
  sets: 0,
  average3: null,
  checkoutAttempts: 0,
  checkoutHits: 0,
  count180: 0,
  highestFinish: null,
})

type Schritt = { zustand: MatchState; haltenMs: number }

function bauSchritte(): Schritt[] {
  const idle: MatchState = {
    phase: 'idle',
    matchId: null,
    variant: 'x01',
    startScore: 501,
    players: [],
    scores: [],
    activePlayerId: null,
    currentThrow: [],
    currentThrowTotal: 0,
    bust: false,
    checkout: null,
    checkoutHint: null,
    legHistory: [],
    lastEvent: null,
  }

  const intro: MatchState = {
    phase: 'intro',
    matchId: 'vorfuehrung',
    variant: 'x01',
    startScore: 501,
    players: SPIELER,
    scores: [scoreLeer('p1'), scoreLeer('p2')],
    activePlayerId: 'p1',
    currentThrow: [],
    currentThrowTotal: 0,
    bust: false,
    checkout: null,
    checkoutHint: null,
    legHistory: [],
    lastEvent: null,
  }

  const scoreboard = mitCheckout({
    phase: 'playing',
    matchId: 'vorfuehrung',
    variant: 'x01',
    startScore: 501,
    players: SPIELER,
    scores: [
      { playerId: 'p1', remaining: 110, legs: 2, sets: 1, average3: 78.4, checkoutAttempts: 5, checkoutHits: 2, count180: 2, highestFinish: 121 },
      { playerId: 'p2', remaining: 301, legs: 1, sets: 0, average3: 65.1, checkoutAttempts: 1, checkoutHits: 0, count180: 1, highestFinish: null },
    ],
    activePlayerId: 'p1',
    currentThrow: leg2Verlauf[3]!.darts,
    currentThrowTotal: leg2Verlauf[3]!.scored,
    bust: false,
    legHistory: leg2Verlauf,
    lastEvent: { seq: 1, kind: 'throw' },
  })

  const spielerwechsel = mitCheckout({
    ...scoreboard,
    activePlayerId: 'p2',
    // Markus hat in seinem neuen Aufnahmezug noch keinen Dart geworfen - ohne
    // diesen Reset wuerde er sonst Jans letzten Wurf "erben" (Spread von
    // scoreboard uebernimmt sonst dessen currentThrow unveraendert).
    currentThrow: [],
    currentThrowTotal: 0,
    lastEvent: { seq: 2, kind: 'playerChange', toPlayerId: 'p2' },
  })

  const nachWechselVerlauf: LegEntry[] = [...leg2Verlauf, { playerId: 'p2', darts: [segmentAusName('T20'), segmentAusName('D20')], scored: 100, remainingAfter: 201, bust: false }]
  const nachWechsel = mitCheckout({
    ...spielerwechsel,
    scores: [scoreboard.scores[0]!, { ...scoreboard.scores[1]!, remaining: 201 }],
    currentThrow: [segmentAusName('T20'), segmentAusName('D20')],
    currentThrowTotal: 100,
    legHistory: nachWechselVerlauf,
    lastEvent: { seq: 3, kind: 'throw' },
  })

  const oneEightyVerlauf: LegEntry[] = [{ playerId: 'p1', darts: [segmentAusName('T20'), segmentAusName('T20'), segmentAusName('T20')], scored: 180, remainingAfter: 321, bust: false }]
  const oneEighty = mitCheckout({
    ...scoreboard,
    scores: [{ ...scoreboard.scores[0]!, remaining: 321, legs: 3, count180: 3 }, nachWechsel.scores[1]!],
    activePlayerId: 'p1',
    currentThrow: oneEightyVerlauf[0]!.darts,
    currentThrowTotal: 180,
    legHistory: oneEightyVerlauf,
    lastEvent: { seq: 4, kind: 'oneEighty', playerId: 'p1' },
  })

  const nachOneEighty = mitCheckout({ ...oneEighty, lastEvent: { seq: 5, kind: 'throw' } })

  const finishWeg = checkoutWeg(121, 3)
  const highFinishVerlauf: LegEntry[] = [{ playerId: 'p2', darts: dartsAusWeg(finishWeg), scored: 121, remainingAfter: 0, bust: false }]
  const highFinish = mitCheckout({
    ...oneEighty,
    scores: [oneEighty.scores[0]!, { ...oneEighty.scores[1]!, remaining: 0, legs: 2, highestFinish: 121 }],
    activePlayerId: 'p2',
    currentThrow: highFinishVerlauf[0]!.darts,
    currentThrowTotal: 121,
    legHistory: highFinishVerlauf,
    lastEvent: { seq: 6, kind: 'highFinish', playerId: 'p2', score: 121 },
  })

  const naechsteLeg = mitCheckout({
    ...highFinish,
    scores: [highFinish.scores[0]!, { ...highFinish.scores[1]!, remaining: 501 }],
    activePlayerId: 'p1',
    currentThrow: [],
    currentThrowTotal: 0,
    legHistory: [],
    lastEvent: { seq: 7, kind: 'throw' },
  })

  const legWinVerlauf: LegEntry[] = [{ playerId: 'p1', darts: [segmentAusName('D20')], scored: 40, remainingAfter: 0, bust: false }]
  const legWin = mitCheckout({
    ...naechsteLeg,
    scores: [{ ...naechsteLeg.scores[0]!, remaining: 0, legs: 4 }, naechsteLeg.scores[1]!],
    activePlayerId: 'p1',
    currentThrow: legWinVerlauf[0]!.darts,
    currentThrowTotal: 40,
    legHistory: legWinVerlauf,
    lastEvent: { seq: 8, kind: 'legWon', playerId: 'p1' },
  })

  const vorMatchgewinn = mitCheckout({
    ...legWin,
    scores: [{ ...legWin.scores[0]!, remaining: 501 }, { ...legWin.scores[1]!, remaining: 260, legs: 3 }],
    activePlayerId: 'p2',
    currentThrow: [],
    currentThrowTotal: 0,
    legHistory: [],
    lastEvent: { seq: 9, kind: 'throw' },
  })

  const matchWinVerlauf: LegEntry[] = [{ playerId: 'p1', darts: [segmentAusName('T20'), segmentAusName('T20'), segmentAusName('D20')], scored: 100, remainingAfter: 0, bust: false }]
  const matchWin = mitCheckout({
    ...vorMatchgewinn,
    phase: 'finished',
    scores: [{ ...vorMatchgewinn.scores[0]!, remaining: 0, legs: 6 }, vorMatchgewinn.scores[1]!],
    activePlayerId: 'p1',
    currentThrow: matchWinVerlauf[0]!.darts,
    currentThrowTotal: 100,
    legHistory: matchWinVerlauf,
    lastEvent: { seq: 10, kind: 'matchWon', playerId: 'p1' },
  })

  return [
    { zustand: idle, haltenMs: 3000 },
    { zustand: intro, haltenMs: 8000 },
    { zustand: scoreboard, haltenMs: 3000 },
    { zustand: spielerwechsel, haltenMs: 3000 },
    { zustand: nachWechsel, haltenMs: 2000 },
    { zustand: oneEighty, haltenMs: 4000 },
    { zustand: nachOneEighty, haltenMs: 2000 },
    { zustand: highFinish, haltenMs: 4000 },
    { zustand: naechsteLeg, haltenMs: 2000 },
    { zustand: legWin, haltenMs: 4500 },
    { zustand: vorMatchgewinn, haltenMs: 2000 },
    { zustand: matchWin, haltenMs: 13000 },
  ]
}

const SCHRITTE = bauSchritte()

function parameter(): URLSearchParams {
  return new URLSearchParams(window.location.search)
}

export function vorfuehrungAktiv(): boolean {
  return parameter().has('vorfuehrung')
}

// Bei einem Direktlink auf einen Schritt ist genau das Anhalten dieses
// Moments der Zweck (Bildschirmfoto) - App.tsx laesst dafuer die sonst
// automatisch ablaufende Ueberlagerung stehen statt sie nach ihrer
// regulaeren Dauer zu verbergen, bevor die Aufnahme ueberhaupt gelingen kann.
export function vorfuehrungEingefroren(): boolean {
  return vorfuehrungAktiv() && parameter().has('schritt')
}

/**
 * Liefert null, wenn der Vorfuehrmodus nicht aktiviert ist (normaler Betrieb
 * ueber window.app). Sonst den jeweils aktuellen synthetischen MatchState:
 * ohne ?schritt automatisch fortschreitend durch alle sieben Szenen, mit
 * ?schritt=N zunaechst im Schnelldurchlauf (30ms je Schritt) bis dorthin und
 * dann eingefroren - so durchlaeuft der Aufrufer (App.tsx) fuer ein gezieltes
 * Bildschirmfoto dieselben lastEvent.seq-Uebergaenge wie im echten Betrieb,
 * eine per Direktlink angesprungene Ueberlagerung loest also tatsaechlich aus
 * statt als vermeintlich schon bekannter Anfangszustand ignoriert zu werden.
 */
export function useVorfuehrung(): MatchState | null {
  const aktiv = vorfuehrungAktiv()
  const schrittParam = parameter().get('schritt')
  const zielIndex = schrittParam ? Math.max(0, Math.min(Number(schrittParam), SCHRITTE.length - 1)) : null
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!aktiv) return
    if (zielIndex !== null) {
      if (index >= zielIndex) return
      const timer = window.setTimeout(() => setIndex((i) => i + 1), 30)
      return () => window.clearTimeout(timer)
    }
    const schritt = SCHRITTE[index % SCHRITTE.length]!
    const timer = window.setTimeout(() => setIndex((i) => i + 1), schritt.haltenMs)
    return () => window.clearTimeout(timer)
  }, [aktiv, zielIndex, index])

  if (!aktiv) return null
  const anzuzeigenderIndex = zielIndex !== null ? Math.min(index, zielIndex) : index % SCHRITTE.length
  return SCHRITTE[anzuzeigenderIndex]!.zustand
}
