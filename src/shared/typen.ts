// Typdefinitionen für MatchState und zugehörige Datenstrukturen
// Quelle: docs/superpowers/specs/2026-09-09-autodarts-dual-screen-design.md, Abschnitt 6

export type Segment = {
  name: string
  value: number
  multiplier: 1 | 2 | 3
  /**
   * Gemessener Auftreffpunkt, normiert auf -1..1 mit y nach OBEN - genau die
   * Form, die Autodarts selbst liefert und in ihrem eigenen Client per
   * `{cx: x * RADIUS, cy: -y * RADIUS}` auf die Scheibe rechnet (belegt im
   * Quelltext des Web-Clients, use-game-*.js). Fehlt, wenn der Wurf keinen
   * Auftreffpunkt hat (z.B. eine von Hand eingetragene Korrektur) - dann
   * zeigt die Scheibe die Mitte des getroffenen Feldes.
   */
  koordinaten?: { x: number; y: number }
}

export type LegEntry = {
  playerId: string
  darts: Segment[] // 1 bis 3 Darts
  scored: number // Summe, 0 bei Bust
  remainingAfter: number
  bust: boolean
}

export type Player = {
  id: string
  autodartsName: string
  displayName: string // aus Spieler-Verwaltung, sonst autodartsName
  photoPath?: string
  country?: string // ISO-3166-1 alpha-2 fuer Flagge
  avatarUrl?: string // Fallback aus der API
}

export type PlayerScore = {
  playerId: string
  remaining: number
  legs: number
  sets: number
  average3: number | null
  checkoutAttempts: number
  checkoutHits: number
  count180: number
  highestFinish: number | null
  /**
   * Average und geworfene Darts des laufenden Legs, wie Autodarts sie selbst
   * fuehrt (stats[i].legStats). null, solange keine Zahl vorliegt.
   */
  legAverage: number | null
  legDarts: number | null
  /**
   * Abstand zum Bull bei der Anfangsermittlung, in der Einheit, in der
   * Autodarts ihn liefert (stats[i].legStats.bullDistance). null ausserhalb
   * einer Anfangsermittlung.
   */
  bullAbstand: number | null
  /** Der Wurf der Anfangsermittlung, wenn er vorliegt. */
  bullWurf?: Segment
  /**
   * Geworfene Darts im ganzen Match. Grundlage des selbst gerechneten
   * Averages: das Statistikobjekt von Autodarts war in einem echten Match
   * leer (siehe docs/autodarts-api.md), deshalb rechnet die Anwendung die
   * Match-Statistik aus dem mit, was sie selbst sieht.
   */
  dartsGesamt: number
  /** Erzielte Punkte im ganzen Match, ohne Bust-Aufnahmen (die zaehlen 0). */
  punkteGesamt: number
  /**
   * Weitere Zahlen, die Autodarts in stats[i].matchStats fuehrt (belegt aus
   * einem Diagnoseprotokoll vom 10.09.2026, siehe docs/autodarts-api.md).
   * null bzw. 0, solange der Server nichts liefert - hier wird nichts
   * geschaetzt.
   */
  first9Average: number | null
  /** Aufnahmen ueber 60, ueber 100 und ueber 140 Punkten im ganzen Match. */
  plus60: number
  plus100: number
  plus140: number
  /** Checkout-Quote des Servers in Prozent. */
  checkoutProzent: number | null
}

export type MatchState = {
  /**
   * 'bullOff' ist die Ermittlung des Anfangsspielers: jeder wirft einen Dart,
   * wer naeher am Bull liegt, beginnt. Autodarts fuehrt sie als eigenen Modus
   * (Variant "Bull-off", belegt im Quelltext des Web-Clients).
   */
  /**
   * 'starting' liegt zwischen der Startmeldung des Bretts und der ersten
   * Zustandsmeldung von Autodarts. In dieser Zeit ist noch nichts bekannt -
   * keine Spieler, keine Punktzahl -, aber der Bildschirm soll die
   * Spielpause schon verlassen haben. Bei einer Anfangsermittlung kann das
   * mehrere Sekunden dauern, weil die erste Momentaufnahme erst mit dem
   * ersten Dart kommt ("ich muss den ersten immer schmeissen damit es los
   * geht").
   */
  phase: 'idle' | 'starting' | 'bullOff' | 'intro' | 'playing' | 'legBreak' | 'finished'
  matchId: string | null
  variant: 'x01' | 'other'
  /**
   * Der Modusname, wie Autodarts ihn schickt ("X01", "Cricket", "Bermuda",
   * ...). variant oben sagt nur, ob die x01-Logik (Checkout, Restpunkte)
   * greift; fuer die Anzeige braucht es den echten Namen, sonst steht bei
   * jedem anderen Modus nur "other" oder gar nichts auf dem Bildschirm.
   */
  variantName: string
  startScore: number // 501, 301, ...
  players: Player[]
  scores: PlayerScore[]
  activePlayerId: string | null
  currentThrow: Segment[] // 0 bis 3 Darts des laufenden Wurfs
  currentThrowTotal: number
  bust: boolean
  checkout: string[] | null // z.B. ['T20','T20','D4'], null wenn kein Finish; schließt checkoutHint aus
  checkoutHint: string | null // Setup-Wurf, wenn checkout null ist, z.B. 'T20'; schließt checkout aus
  legHistory: LegEntry[] // Wurf-fuer-Wurf des laufenden Legs
  lastEvent: MatchEvent | null // loest Einblendungen aus
}

export type MatchEvent = { seq: number } & (
  | { kind: 'throw' }
  | { kind: 'playerChange'; toPlayerId: string }
  | { kind: 'oneEighty'; playerId: string }
  /** Ein Dart ausserhalb der Scheibe. Wird nur ganz kurz gezeigt. */
  | { kind: 'miss'; playerId: string }
  /** Ein Dart im inneren Bull. */
  | { kind: 'bullseye'; playerId: string }
  | { kind: 'highFinish'; playerId: string; score: number }
  | { kind: 'legWon'; playerId: string }
  | { kind: 'matchWon'; playerId: string }
)

// Fensterarten der Anwendung. Von Main, Preload und Renderer gemeinsam
// genutzt, deshalb hier und nicht in src/main/fenster.ts definiert.
export type FensterArt = 'control' | 'player' | 'spectator'
