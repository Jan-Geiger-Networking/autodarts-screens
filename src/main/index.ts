import { app } from 'electron'
import { fensterOeffnen, konfigurationAktualisieren, zustandVerteilen } from './fenster'
import { ipcRegistrieren } from './ipc'
import { konfigurationLesen } from './konfiguration'
import { checkoutWeg, setupWurf } from '../shared/checkout'
import type { MatchState, Player, Segment } from '../shared/typen'

/**
 * Verschickt ohne Netz und ohne laufenden Adapter einen realistisch gefuellten,
 * synthetischen MatchState - aktiviert ueber AD_TESTZUSTAND=1. Kein
 * Wegwerf-Code: die spaetere Player-Screen-Aufgabe braucht genau das, um
 * Layout und Zahlen zu entwickeln, bevor src/autodarts/oauth.ts und der
 * Adapter existieren. Wiederholt alle 3 Sekunden mit einem neuen Wurf, damit
 * sich am Player-Screen tatsaechlich etwas veraendert (nicht nur ein
 * einmaliger statischer Zustand).
 */
function testZustandStarten(): void {
  const spieler: Player[] = [
    { id: 'p1', autodartsName: 'testspieler_eins', displayName: 'Anna' },
    { id: 'p2', autodartsName: 'testspieler_zwei', displayName: 'Ben' },
  ]
  const wurf: Segment[] = [
    { name: 'T20', value: 20, multiplier: 3 },
    { name: 'T20', value: 20, multiplier: 3 },
    { name: '5', value: 5, multiplier: 1 },
  ]
  const summe = wurf.reduce((s, d) => s + d.value * d.multiplier, 0)

  let restAktiv = 501
  let sequenz = 0

  const naechsterZustand = (): MatchState => {
    sequenz += 1
    const neuerRest = restAktiv - summe
    // Rest 1 oder darunter ist beim x01 ohne gueltiges Doppel ein Bust bzw.
    // ein Wert, den checkoutWeg/setupWurf nicht mehr sinnvoll behandeln -
    // fuer diesen Entwicklungs-Fixture reicht es, dann wieder von vorn zu
    // beginnen, statt Bust- oder Leg-Ende-Logik nachzubilden.
    restAktiv = neuerRest <= 1 ? 501 : neuerRest
    const weg = checkoutWeg(restAktiv, 3)

    return {
      phase: 'playing',
      matchId: 'test-zustand',
      variant: 'x01',
      startScore: 501,
      players: spieler,
      scores: [
        {
          playerId: 'p1',
          remaining: restAktiv,
          legs: 1,
          sets: 0,
          average3: 78.4,
          checkoutAttempts: 1,
          checkoutHits: 0,
          count180: 1,
          highestFinish: null,
        },
        {
          playerId: 'p2',
          remaining: 241,
          legs: 0,
          sets: 0,
          average3: 65.1,
          checkoutAttempts: 0,
          checkoutHits: 0,
          count180: 0,
          highestFinish: null,
        },
      ],
      activePlayerId: 'p1',
      currentThrow: wurf,
      currentThrowTotal: summe,
      bust: false,
      checkout: weg,
      checkoutHint: weg ? null : setupWurf(restAktiv),
      legHistory: [],
      lastEvent: { seq: sequenz, kind: 'throw' },
    }
  }

  setTimeout(() => zustandVerteilen(naechsterZustand()), 800)
  setInterval(() => zustandVerteilen(naechsterZustand()), 3000)
}

app.whenReady().then(async () => {
  ipcRegistrieren()
  konfigurationAktualisieren(await konfigurationLesen())
  fensterOeffnen('control')

  if (process.env.AD_TESTZUSTAND === '1') {
    fensterOeffnen('player')
    testZustandStarten()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
