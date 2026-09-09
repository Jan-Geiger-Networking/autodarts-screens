// WebSocket-Anbindung an Autodarts: Ticket holen, Verbindung aufbauen,
// Abonnements verwalten, bei Abbruch mit wachsendem Abstand neu verbinden.
//
// Der gesamte Ablauf hier ist eine Annahme aus Community-Projekten (siehe
// Task-5-Brief). Bestaetigt per eigenem Test ist ausschliesslich, dass
// POST /ms/v0/tickets existiert (401 statt 404, siehe docs/autodarts-api.md,
// Abschnitt "Endpunkt-Existenz, eigener Test") - Rumpf und Antwortform des
// Tickets, die WebSocket-Adresse, das Abonnement-Format und die Kanal-/
// Themennamen sind unbestaetigt. Jede darauf beruhende Stelle ist unten als
// Annahme markiert; Abweichungen werden protokolliert statt stillschweigend
// zu scheitern. Kein zusaetzliches Paket - Electron liefert im Hauptprozess
// eine WebSocket-Implementierung mit.

import { holen, NichtAngemeldetFehler, senden } from './rest'
import { aufzeichnungBeenden, aufzeichnungStarten, wiedergeben } from './aufzeichnung'

// Annahme: Verbindungsadresse laut Community-Projekten, nicht selbst bestaetigt.
const WS_ADRESSE = 'wss://api.autodarts.com/ms/v0/subscribe'

export type Verbindung = {
  abonnieren(kanal: string, thema: string): void
  // Liefert ein Promise, das erst aufgeloest wird, wenn eine laufende
  // Aufzeichnung tatsaechlich vollstaendig auf die Platte geschrieben ist -
  // damit die Anwendung beim Beenden darauf warten kann, statt den Prozess
  // zu beenden, waehrend der letzte Schreibvorgang noch unterwegs ist.
  // Loest nie ab (siehe Implementierung unten): ein Schreibfehler beim
  // Beenden wird protokolliert, nicht an den Aufrufer durchgereicht.
  schliessen(): Promise<void>
}

/**
 * Zustandswechsel der Verbindung, ueber den optionalen zweiten Rueckruf von
 * verbinden() gemeldet: "verbunden" bei jedem erfolgreichen (Wieder-)Aufbau,
 * "getrennt" bei einem Abbruch nach vorherigem Erfolg, "nichtAngemeldet",
 * sobald der Ticket-Abruf an einer fehlenden oder ungueltigen Anmeldung
 * scheitert - egal ob beim allerersten Verbindungsversuch oder Jahre spaeter
 * mitten in einer laufenden Sitzung (z.B. weil das Aktualisierungs-Token
 * inzwischen widerrufen wurde). Die Wiederverbindung laeuft in jedem Fall
 * weiter; melden sich Nutzer erneut an, greift sie beim naechsten Versuch
 * von selbst wieder.
 */
export type Verbindungszustand = 'verbunden' | 'getrennt' | 'nichtAngemeldet'

/**
 * Ob fehler bedeutet, dass sich der Nutzer erneut anmelden muss. Prueft den
 * Typ, nicht den Nachrichtentext - oauth.ts (lokal kein oder ein ungueltiges
 * Aktualisierungs-Token) und rest.ts (der Server antwortet mit dem
 * bestaetigten 401-Fehlerrumpf) werfen beide denselben NichtAngemeldetFehler
 * (siehe src/autodarts/fehler.ts). Damit bleibt die Erkennung stabil, selbst
 * wenn sich der - fuer Menschen gedachte - Nachrichtentext einmal aendert.
 */
function istAuthFehler(fehler: unknown): boolean {
  return fehler instanceof NichtAngemeldetFehler
}

function zustandMelden(rueckruf: ((z: Verbindungszustand) => void) | undefined, zustand: Verbindungszustand): void {
  try {
    rueckruf?.(zustand)
  } catch (fehler) {
    // Ein werfender Rueckruf ist ein Programmierfehler des Aufrufers - er
    // darf aber nie die Verbindungslogik selbst zum Absturz bringen.
    console.error('Fehler im Rueckruf beiVerbindungszustand:', fehler)
  }
}

/**
 * Wartezeit vor dem naechsten Wiederverbindungsversuch, in Millisekunden.
 * Reine Funktion: waechst exponentiell (1s, 2s, 4s, 8s, 16s) und bleibt ab
 * dem sechsten Versuch dauerhaft bei 30s. versuch ist die Anzahl bereits
 * gescheiterter Versuche seit der letzten erfolgreichen Verbindung,
 * beginnend bei 1 fuer den ersten Wiederholungsversuch.
 */
export function wartezeit(versuch: number): number {
  const n = Math.max(1, Math.trunc(versuch))
  return Math.min(1000 * 2 ** (n - 1), 30000)
}

/**
 * Zieht den Ticket-String aus der Antwort von POST /ms/v0/tickets. Annahme:
 * eine reine Zeichenkette (siehe Dateikopf). Liefert der Server statt dessen
 * ein Objekt, wird nach gaengigen Feldnamen gesucht und die Abweichung
 * protokolliert - ohne den Ticket-Wert selbst zu loggen, er ist wie ein
 * Token einmalig gueltiges Zugangsmaterial.
 */
export function ticketAusAntwort(antwort: unknown): string {
  if (typeof antwort === 'string' && antwort.length > 0) return antwort

  if (typeof antwort === 'object' && antwort !== null) {
    const rumpf = antwort as Record<string, unknown>
    for (const feld of ['ticket', 'id', 'token'] as const) {
      const wert = rumpf[feld]
      if (typeof wert === 'string' && wert.length > 0) {
        console.warn(
          `Annahme verletzt: Ticket-Antwort von POST /ms/v0/tickets war ein Objekt (Feld "${feld}"), nicht die erwartete reine Zeichenkette. websocket.ts anpassen.`,
        )
        return wert
      }
    }
  }

  throw new Error(
    `Unerwartete Antwortform von POST /ms/v0/tickets: ${typeof antwort}` +
      (typeof antwort === 'object' && antwort !== null
        ? ` mit Feldern [${Object.keys(antwort).join(', ')}]`
        : ''),
  )
}

/**
 * Heuristische Extraktion einer Match-Kennung aus einem Rohereignis, um nach
 * einer Wiederverbindung zu wissen, welches Match per GET
 * /gs/v0/matches/{matchId}/state neu geladen werden muss. Annahme: Ereignisse
 * tragen ein Top-Level-Feld "matchId" (passend zum bestaetigten Endpunkt-Pfad
 * und zu MatchState.matchId aus src/shared/typen.ts) - durch keinen echten
 * Mitschnitt bestaetigt, da diese Aufgabe ohne Dartscheibe umgesetzt wurde.
 */
function matchIdAusEreignis(roh: unknown): string | null {
  if (typeof roh !== 'object' || roh === null) return null
  const wert = (roh as Record<string, unknown>).matchId
  return typeof wert === 'string' && wert.length > 0 ? wert : null
}

/**
 * Baut die Verbindung zu Autodarts auf und liefert sie, sobald die erste
 * Verbindung steht (oder sofort im Wiedergabefall). AD_WIEDERGABE ersetzt
 * die Verbindung vollstaendig durch eine Dateiwiedergabe - dabei wird kein
 * Token angefordert und keine Verbindung geoeffnet, die Anwendung laeuft
 * dann ohne Netz. AD_AUFZEICHNEN schaltet parallel zur echten Verbindung
 * einen Mitschnitt aller Rohereignisse ein.
 *
 * Schlaegt der allererste Verbindungsversuch fehl (z.B. NichtAngemeldetFehler
 * beim Ticket holen), wirft diese Funktion - der Aufrufer kann das direkt in
 * eine Nutzermeldung uebersetzen. Jeder weitere Abbruch waehrend einer
 * laufenden Sitzung wird intern mit wachsendem Abstand neu verbunden und
 * reisst die Anwendung nie ab; ueber beiVerbindungszustand kann der Aufrufer
 * trotzdem verfolgen, was gerade passiert (siehe Verbindungszustand) - vor
 * allem, um mitten in der Sitzung eine ungueltig gewordene Anmeldung
 * anzuzeigen, statt endlos stumm im 30s-Takt weiterzuversuchen.
 * beiVerbindungszustand wird im Wiedergabefall nie aufgerufen, es gibt dort
 * keine echte Verbindung, ueber die es etwas zu melden gaebe.
 */
export async function verbinden(
  beiEreignis: (roh: unknown) => void,
  beiVerbindungszustand?: (zustand: Verbindungszustand) => void,
): Promise<Verbindung> {
  const wiedergabePfad = process.env.AD_WIEDERGABE
  if (wiedergabePfad) {
    return wiedergabeVerbindung(wiedergabePfad, beiEreignis)
  }
  return echteVerbindung(beiEreignis, beiVerbindungszustand)
}

function wiedergabeVerbindung(pfad: string, beiEreignis: (roh: unknown) => void): Verbindung {
  // wiedergeben() hat keinen Abbruchmechanismus - die Wiedergabe laeuft bis
  // zum Dateiende durch. schliessen() ist hier ein Notausgang ohne Wirkung
  // auf eine bereits laufende Wiedergabe (ponytail: kein AbortSignal, bei
  // Bedarf ergaenzen, wenn ein Wiedergabelauf tatsaechlich vorzeitig
  // gestoppt werden muss).
  wiedergeben(pfad, beiEreignis).catch((fehler: unknown) => {
    console.error('Wiedergabe der Aufzeichnung fehlgeschlagen:', fehler)
  })

  return {
    abonnieren: () => {
      // Es gibt keine echte Verbindung, also nichts zu abonnieren.
    },
    schliessen: () => {
      // Siehe Kommentar oben - nichts zu schliessen, nichts zu erwarten.
      return Promise.resolve()
    },
  }
}

async function echteVerbindung(
  nutzerEreignis: (roh: unknown) => void,
  zustandsRueckruf?: (zustand: Verbindungszustand) => void,
): Promise<Verbindung> {
  const aufzeichnenPfad = process.env.AD_AUFZEICHNEN
  const schreiben = aufzeichnenPfad ? aufzeichnungStarten(aufzeichnenPfad) : null

  // Merkt sich alle abonnierten Kanal/Thema-Paare, um sie nach jeder
  // Wiederverbindung automatisch erneut zu senden.
  const abonnements = new Map<string, { kanal: string; thema: string }>()
  let aktuellerMatchId: string | null = null
  let aktiverSocket: WebSocket | null = null
  let geschlossen = false
  let wiederverbindungsVersuch = 0
  let wiederverbindungsTimer: ReturnType<typeof setTimeout> | null = null

  const ereignisVerarbeiten = (roh: unknown): void => {
    const matchId = matchIdAusEreignis(roh)
    if (matchId) aktuellerMatchId = matchId
    schreiben?.(roh)
    nutzerEreignis(roh)
  }

  const nachrichtEmpfangen = (daten: unknown): void => {
    let roh: unknown = daten
    if (typeof daten === 'string') {
      try {
        roh = JSON.parse(daten)
      } catch {
        // Annahme (Nachrichten sind JSON) verletzt - Rohdaten unveraendert
        // weitergeben statt die Nachricht zu verwerfen, damit die
        // Abweichung sofort auffaellt statt still zu scheitern.
        console.warn('WebSocket-Nachricht liess sich nicht als JSON parsen, wird unveraendert weitergegeben.')
      }
    }
    ereignisVerarbeiten(roh)
  }

  const alleAbonnementsSenden = (socket: WebSocket): void => {
    for (const a of abonnements.values()) {
      // Annahme: Abonnement-Form laut Community-Projekten, siehe Dateikopf.
      socket.send(JSON.stringify({ channel: a.kanal, type: 'subscribe', topic: a.thema }))
    }
  }

  const matchZustandNeuLaden = async (): Promise<void> => {
    if (!aktuellerMatchId) return
    try {
      const zustand = await holen<unknown>(`/gs/v0/matches/${aktuellerMatchId}/state`)
      ereignisVerarbeiten(zustand)
    } catch (fehler) {
      console.error('Match-Zustand nach Wiederverbindung liess sich nicht neu laden:', fehler)
    }
  }

  const wiederverbindenPlanen = (): void => {
    if (geschlossen || wiederverbindungsTimer) return
    wiederverbindungsVersuch += 1
    const abstand = wartezeit(wiederverbindungsVersuch)
    console.warn(`Autodarts-WebSocket getrennt, naechster Wiederverbindungsversuch in ${abstand}ms.`)
    wiederverbindungsTimer = setTimeout(() => {
      wiederverbindungsTimer = null
      verbindungOeffnen().catch((fehler: unknown) => {
        console.error('Wiederverbindung fehlgeschlagen:', fehler)
        wiederverbindenPlanen()
      })
    }, abstand)
  }

  const verbindungOeffnen = async (): Promise<void> => {
    let ticketAntwort: unknown
    try {
      ticketAntwort = await senden<unknown>('/ms/v0/tickets', {})
    } catch (fehler) {
      // Greift sowohl beim allerersten Verbindungsversuch als auch bei
      // jedem spaeteren Wiederverbindungsversuch mitten in der Sitzung -
      // einheitlich behandelt, damit eine mitten in der Sitzung ungueltig
      // gewordene Anmeldung nicht nur in console.error verschwindet.
      if (istAuthFehler(fehler)) zustandMelden(zustandsRueckruf, 'nichtAngemeldet')
      throw fehler
    }

    // schliessen() kann waehrend dieses Awaits aufgerufen worden sein (z.B.
    // beim Beenden der Anwendung mitten in einem Wiederverbindungsversuch).
    // Ohne diese Pruefung wuerde jetzt trotzdem ein neuer Socket aufgebaut,
    // Abonnements gesendet und Ereignisse an einen Aufzeichnungsstream
    // weitergereicht, dessen Beenden schon lief.
    if (geschlossen) return

    const ticket = ticketAusAntwort(ticketAntwort)
    // Annahme: WebSocket-Adresse samt ?ticket=-Parameter, siehe Dateikopf.
    const neuerSocket = new WebSocket(`${WS_ADRESSE}?ticket=${encodeURIComponent(ticket)}`)

    await new Promise<void>((resolve, reject) => {
      let geoeffnet = false

      neuerSocket.onopen = () => {
        geoeffnet = true
        aktiverSocket = neuerSocket
        const warWiederverbindung = wiederverbindungsVersuch > 0
        wiederverbindungsVersuch = 0
        alleAbonnementsSenden(neuerSocket)
        zustandMelden(zustandsRueckruf, 'verbunden')
        resolve()
        // Nach einer Wiederverbindung wird der Match-Zustand neu geladen,
        // statt zu raten, welche Ereignisse in der Trennungszeit verpasst
        // wurden - siehe matchZustandNeuLaden.
        if (warWiederverbindung) void matchZustandNeuLaden()
      }

      neuerSocket.onmessage = (ereignis: MessageEvent) => nachrichtEmpfangen(ereignis.data)

      neuerSocket.onerror = () => {
        // Der WebSocket-Standard liefert hier kein brauchbares Fehlerobjekt.
        // Vor dem ersten "open" ist das der einzige Hinweis auf einen
        // gescheiterten Verbindungsversuch - "close" folgt danach garantiert
        // und ueberninmt sonst die eigentliche Behandlung.
        if (!geoeffnet) reject(new Error('Autodarts-WebSocket-Verbindung fehlgeschlagen'))
      }

      neuerSocket.onclose = () => {
        aktiverSocket = null
        if (!geoeffnet) {
          reject(new Error('Autodarts-WebSocket-Verbindung fehlgeschlagen'))
          return
        }
        zustandMelden(zustandsRueckruf, 'getrennt')
        if (!geschlossen) wiederverbindenPlanen()
      }
    })
  }

  await verbindungOeffnen()

  return {
    abonnieren(kanal: string, thema: string): void {
      const schluessel = `${kanal} ${thema}`
      // Schon bekannt (egal ob laengst wieder-abonniert oder frisch gesetzt)
      // -> nichts erneut senden. Ohne diese Pruefung wuerde ein zweiter
      // Aufruf mit demselben Kanal/Thema ein zweites, identisches
      // subscribe-Rahmenwerk auf die Leitung schicken - wie der Server auf
      // ein Doppel-Abonnement reagiert, ist unbekannt, im schlechtesten Fall
      // kaeme jedes Ereignis doppelt an.
      if (abonnements.has(schluessel)) return
      abonnements.set(schluessel, { kanal, thema })
      if (aktiverSocket && aktiverSocket.readyState === WebSocket.OPEN) {
        // Annahme: Abonnement-Form laut Community-Projekten, siehe Dateikopf.
        aktiverSocket.send(JSON.stringify({ channel: kanal, type: 'subscribe', topic: thema }))
      }
    },
    schliessen(): Promise<void> {
      geschlossen = true
      if (wiederverbindungsTimer) clearTimeout(wiederverbindungsTimer)
      aktiverSocket?.close()
      aktiverSocket = null
      if (!schreiben) return Promise.resolve()
      // .catch() statt weiterwerfen: ein Schreibfehler beim Beenden waere
      // sonst eine unbehandelte Ablehnung und wuerde den Node-Hauptprozess
      // beenden - protokollieren reicht, die Verbindung ist ohnehin zu.
      return aufzeichnungBeenden().catch((fehler: unknown) => {
        console.error('Aufzeichnung liess sich beim Schliessen nicht sauber beenden:', fehler)
      })
    },
  }
}
