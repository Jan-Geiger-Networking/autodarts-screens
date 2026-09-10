// Typdefinitionen für MatchState und zugehörige Datenstrukturen
// Quelle: docs/superpowers/specs/2026-09-09-autodarts-dual-screen-design.md, Abschnitt 6

export type Segment = {
  name: string
  value: number
  multiplier: 1 | 2 | 3
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
}

export type MatchState = {
  phase: 'idle' | 'intro' | 'playing' | 'legBreak' | 'finished'
  matchId: string | null
  variant: 'x01' | 'other'
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
  | { kind: 'highFinish'; playerId: string; score: number }
  | { kind: 'legWon'; playerId: string }
  | { kind: 'matchWon'; playerId: string }
)

// Fensterarten der Anwendung. Von Main, Preload und Renderer gemeinsam
// genutzt, deshalb hier und nicht in src/main/fenster.ts definiert.
export type FensterArt = 'control' | 'player' | 'spectator'
