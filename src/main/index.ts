import { app } from "electron";
import {
  fensterOeffnen,
  konfigurationAktualisieren,
  zustandVerteilen,
} from "./fenster";
import { ipcRegistrieren } from "./ipc";
import { konfigurationLesen } from "./konfiguration";
import { verbindungBeenden, verbindungStarten } from "./verbindung";
import { aktualisierungStarten } from "./aktualisierung";
import { checkoutWeg, setupWurf } from "../shared/checkout";
import type { MatchState, Player, Segment } from "../shared/typen";

/**
 * Verschickt ohne Netz und ohne laufenden Adapter einen realistisch gefuellten,
 * synthetischen MatchState - aktiviert ueber AD_TESTZUSTAND=1. Kein
 * Wegwerf-Code: taugt weiterhin zum Entwickeln von Layout und Zahlen am
 * Player-Screen, unabhaengig vom Adapter, der Rohereignisse noch nicht in
 * MatchState uebersetzt (der fehlt absichtlich, siehe docs/UEBERGABE.md).
 * Wiederholt alle 3 Sekunden mit einem neuen Wurf, damit sich am
 * Player-Screen tatsaechlich etwas veraendert (nicht nur ein einmaliger
 * statischer Zustand).
 */
function testZustandStarten(): void {
  const spieler: Player[] = [
    { id: "p1", autodartsName: "testspieler_eins", displayName: "Anna" },
    { id: "p2", autodartsName: "testspieler_zwei", displayName: "Ben" },
  ];
  const wurf: Segment[] = [
    { name: "T20", value: 20, multiplier: 3 },
    { name: "T20", value: 20, multiplier: 3 },
    { name: "5", value: 5, multiplier: 1 },
  ];
  const summe = wurf.reduce((s, d) => s + d.value * d.multiplier, 0);

  let restAktiv = 501;
  let sequenz = 0;

  const naechsterZustand = (): MatchState => {
    sequenz += 1;
    const neuerRest = restAktiv - summe;
    // Rest 1 oder darunter ist beim x01 ohne gueltiges Doppel ein Bust bzw.
    // ein Wert, den checkoutWeg/setupWurf nicht mehr sinnvoll behandeln -
    // fuer diesen Entwicklungs-Fixture reicht es, dann wieder von vorn zu
    // beginnen, statt Bust- oder Leg-Ende-Logik nachzubilden.
    restAktiv = neuerRest <= 1 ? 501 : neuerRest;
    const weg = checkoutWeg(restAktiv, 3);

    return {
      phase: "playing",
      matchId: "test-zustand",
      variant: "x01",
      variantName: "X01",
      startScore: 501,
      players: spieler,
      scores: [
        {
          playerId: "p1",
          remaining: restAktiv,
          legs: 1,
          sets: 0,
          average3: 78.4,
          checkoutAttempts: 1,
          checkoutHits: 0,
          count180: 1,
          highestFinish: null,
          dartsGesamt: 24,
          punkteGesamt: 627,
        },
        {
          playerId: "p2",
          remaining: 241,
          legs: 0,
          sets: 0,
          average3: 65.1,
          checkoutAttempts: 0,
          checkoutHits: 0,
          count180: 0,
          highestFinish: null,
          dartsGesamt: 24,
          punkteGesamt: 521,
        },
      ],
      activePlayerId: "p1",
      currentThrow: wurf,
      currentThrowTotal: summe,
      bust: false,
      checkout: weg,
      checkoutHint: weg ? null : setupWurf(restAktiv),
      legHistory: [],
      lastEvent: { seq: sequenz, kind: "throw" },
    };
  };

  setTimeout(() => zustandVerteilen(naechsterZustand()), 800);
  setInterval(() => zustandVerteilen(naechsterZustand()), 3000);
}

app.whenReady().then(async () => {
  ipcRegistrieren();
  konfigurationAktualisieren(await konfigurationLesen());
  const controlFenster = fensterOeffnen("control");

  if (process.env.AD_TESTZUSTAND === "1") {
    fensterOeffnen("player");
    testZustandStarten();
    return;
  }

  // Erst verbinden, wenn das Control-Fenster seinen Inhalt geladen hat (der
  // beiVerbindungszustand()-Listener im Renderer ist dann registriert) -
  // sonst koennte die allererste Zustandsmeldung (z.B. "nichtAngemeldet")
  // ungesehen verschwinden, weil Electron IPC-Nachrichten nicht zwischenspeichert.
  controlFenster.webContents.once("did-finish-load", () => {
    void verbindungStarten();
    // Erst hier, aus demselben Grund wie der Verbindungsaufbau: der
    // beiAktualisierungszustand()-Listener im Control-Fenster ist dann
    // registriert, sonst verschwaende die erste Meldung ("Suche laeuft")
    // ungesehen. Wirft nie - ein Fehler bei der Suche landet im Zustand und
    // im Diagnoseprotokoll, nicht im Start.
    void aktualisierungStarten();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Schliesst eine offene Verbindung und wartet auf das saubere Beenden einer
// laufenden Aufzeichnung, bevor der Prozess tatsaechlich endet - sonst
// fehlten die letzten Zeilen, weil der WriteStream sein "finish" nie
// abwarten durfte. preventDefault() plus erneutes app.quit() danach ist das
// uebliche Electron-Muster fuer asynchrones Aufraeumen beim Beenden.
let wirdBeendet = false;
app.on("before-quit", (ereignis) => {
  if (wirdBeendet) return;
  wirdBeendet = true;
  ereignis.preventDefault();
  verbindungBeenden().finally(() => app.quit());
});
