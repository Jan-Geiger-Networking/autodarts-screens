import { describe, expect, it } from "vitest";
import { szeneAusZustand } from "./szene";
import type {
  MatchState,
  MatchEvent,
  Player,
  PlayerScore,
} from "../../shared/typen";

const spieler: Player[] = [
  { id: "p1", autodartsName: "jan", displayName: "Jan" },
  { id: "p2", autodartsName: "markus", displayName: "Markus" },
];

const score = (
  playerId: string,
  ueberschreibungen: Partial<PlayerScore> = {},
): PlayerScore => ({
  playerId,
  remaining: 301,
  legs: 0,
  sets: 0,
  average3: 60,
  checkoutAttempts: 0,
  checkoutHits: 0,
  count180: 0,
  legAverage: null,
  legDarts: null,
  bullAbstand: null,
  dartsGesamt: 0,
  punkteGesamt: 0,
  first9Average: null,
  plus60: 0,
  plus100: 0,
  plus140: 0,
  checkoutProzent: null,
  highestFinish: null,
  ...ueberschreibungen,
});

function zustand(ueberschreibungen: Partial<MatchState> = {}): MatchState {
  return {
    phase: "playing",
    matchId: "m1",
    variant: "x01",
    variantName: "X01",
    startScore: 501,
    players: spieler,
    scores: [score("p1"), score("p2")],
    activePlayerId: "p1",
    currentThrow: [],
    currentThrowTotal: 0,
    bust: false,
    checkout: null,
    checkoutHint: null,
    legHistory: [],
    lastEvent: null,
    ...ueberschreibungen,
  };
}

describe("szeneAusZustand", () => {
  it("zeigt idle ohne Match", () => {
    const ergebnis = szeneAusZustand(zustand({ phase: "idle" }), -1);
    expect(ergebnis.basis).toBe("idle");
    expect(ergebnis.ueberlagerung).toBeNull();
  });

  it("zeigt idle wenn keine Spieler bekannt sind, unabhaengig von phase", () => {
    const ergebnis = szeneAusZustand(
      zustand({ phase: "playing", players: [] }),
      -1,
    );
    expect(ergebnis.basis).toBe("idle");
  });

  it("zeigt intro waehrend der Einfuehrungsphase", () => {
    const ergebnis = szeneAusZustand(zustand({ phase: "intro" }), -1);
    expect(ergebnis.basis).toBe("intro");
    expect(ergebnis.ueberlagerung).toBeNull();
  });

  it("Normalfall: scoreboard ohne Ereignis", () => {
    const ergebnis = szeneAusZustand(zustand(), -1);
    expect(ergebnis.basis).toBe("scoreboard");
    expect(ergebnis.ueberlagerung).toBeNull();
    expect(ergebnis.verarbeiteteSeq).toBe(-1);
  });

  it("ein throw-Ereignis loest keine Ueberlagerung aus, gilt aber als verarbeitet", () => {
    const ereignis: MatchEvent = { seq: 5, kind: "throw" };
    const ergebnis = szeneAusZustand(zustand({ lastEvent: ereignis }), 2);
    expect(ergebnis.ueberlagerung).toBeNull();
    expect(ergebnis.verarbeiteteSeq).toBe(5);
  });

  it("playerChange loest die passende Ueberlagerung aus", () => {
    const ereignis: MatchEvent = {
      seq: 3,
      kind: "playerChange",
      toPlayerId: "p2",
    };
    const ergebnis = szeneAusZustand(zustand({ lastEvent: ereignis }), 2);
    expect(ergebnis.ueberlagerung).toEqual({
      art: "playerChange",
      seq: 3,
      zuSpielerId: "p2",
    });
    expect(ergebnis.verarbeiteteSeq).toBe(3);
  });

  it("oneEighty loest bigMoment aus", () => {
    const ereignis: MatchEvent = { seq: 7, kind: "oneEighty", playerId: "p1" };
    const ergebnis = szeneAusZustand(zustand({ lastEvent: ereignis }), 6);
    expect(ergebnis.ueberlagerung).toEqual({
      art: "bigMoment",
      seq: 7,
      anlass: "oneEighty",
      spielerId: "p1",
    });
  });

  it("highFinish loest bigMoment aus", () => {
    const ereignis: MatchEvent = {
      seq: 8,
      kind: "highFinish",
      playerId: "p2",
      score: 141,
    };
    const ergebnis = szeneAusZustand(zustand({ lastEvent: ereignis }), 7);
    expect(ergebnis.ueberlagerung).toEqual({
      art: "bigMoment",
      seq: 8,
      anlass: "highFinish",
      spielerId: "p2",
    });
  });

  it("legWon loest legWin aus", () => {
    const ereignis: MatchEvent = { seq: 9, kind: "legWon", playerId: "p1" };
    const ergebnis = szeneAusZustand(zustand({ lastEvent: ereignis }), 8);
    expect(ergebnis.ueberlagerung).toEqual({
      art: "legWin",
      seq: 9,
      spielerId: "p1",
    });
  });

  it("matchWon loest matchWin aus", () => {
    const ereignis: MatchEvent = { seq: 10, kind: "matchWon", playerId: "p1" };
    const ergebnis = szeneAusZustand(zustand({ lastEvent: ereignis }), 9);
    expect(ergebnis.ueberlagerung).toEqual({
      art: "matchWin",
      seq: 10,
      spielerId: "p1",
    });
  });

  it("dieselbe Sequenznummer loest kein zweites Mal aus", () => {
    const ereignis: MatchEvent = { seq: 4, kind: "legWon", playerId: "p1" };
    const zustandMitEreignis = zustand({ lastEvent: ereignis });

    const erster = szeneAusZustand(zustandMitEreignis, 3);
    expect(erster.ueberlagerung).not.toBeNull();

    const zweiter = szeneAusZustand(zustandMitEreignis, erster.verarbeiteteSeq);
    expect(zweiter.ueberlagerung).toBeNull();
    expect(zweiter.verarbeiteteSeq).toBe(4);
  });
});

describe("szeneAusZustand: Zaehler beginnt bei jedem Match neu", () => {
  it("spielt ein Ereignis auch dann ab, wenn die Nummer KLEINER ist als die zuletzt gesehene", () => {
    // Der Ruhezustand traegt lastEvent: null, deshalb faengt seq bei jedem
    // neuen Match wieder bei 1 an. Ein Bildschirm, der ueber mehrere Matches
    // offen bleibt, hat aber noch die hohe Nummer des vorigen Matches
    // gemerkt - ab dem zweiten Match wuerde sonst keine Einblendung mehr
    // ausgeloest. Genau das war gemeldet: "bei dem normalen viewer screen
    // wird der gewinner des legs und 180 und so nicht angezeigt".
    const ereignis: MatchEvent = { seq: 1, kind: "oneEighty", playerId: "p1" };
    const ergebnis = szeneAusZustand(zustand({ lastEvent: ereignis }), 87);
    expect(ergebnis.ueberlagerung).toEqual({
      art: "bigMoment",
      seq: 1,
      anlass: "oneEighty",
      spielerId: "p1",
    });
    expect(ergebnis.verarbeiteteSeq).toBe(1);
  });

  it("spielt dieselbe Momentaufnahme trotzdem nur einmal ab", () => {
    const ereignis: MatchEvent = { seq: 4, kind: "legWon", playerId: "p1" };
    const ergebnis = szeneAusZustand(zustand({ lastEvent: ereignis }), 4);
    expect(ergebnis.ueberlagerung).toBeNull();
    expect(ergebnis.verarbeiteteSeq).toBe(4);
  });
});
