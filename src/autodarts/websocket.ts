// WebSocket-Anbindung an Autodarts: Ticket holen, Verbindung aufbauen,
// Abonnements verwalten, bei Abbruch mit wachsendem Abstand neu verbinden.
//
// Der gesamte Ablauf hier stammte urspruenglich aus einer Annahme aus
// Community-Projekten (siehe Task-5-Brief). Inzwischen bestaetigt: Ticket im
// Feld "code" (siehe ticketAusAntwort), der Abfrageparameter "code" statt
// "ticket" (siehe subscribeAdresse), das Abonnement-Rahmenwerk
// {channel,type,topic} sowie die Kanal- und Themennamen KANAL_BOARDS/
// KANAL_MATCHES/boardThema/matchThema - alle am 2026-09-10 aus dem
// offiziellen Web-Client belegt (siehe docs/autodarts-api.md). Ebenfalls
// belegt (2026-09-10, siehe MATCH_ABO_ZWECKE unten): .state allein liefert
// keine laufenden Wurf-Ereignisse - der offizielle Web-Client abonniert fuer
// die Live-Ansicht eines Matches mehrere Themen gleichzeitig. Unbestaetigt
// bleibt weiterhin, welches Feld eines Ereignisses die Match-Kennung traegt
// (siehe matchIdAusEreignis) - dafuer fehlt bislang ein echter Mitschnitt.
// Kein zusaetzliches Paket - Electron liefert im Hauptprozess eine
// WebSocket-Implementierung mit.

import { holen, NichtAngemeldetFehler, senden } from './rest'
import { aufzeichnungBeenden, aufzeichnungStarten, wiedergeben } from './aufzeichnung'
import { feldUebersicht, protokollieren } from './diagnose'

// Annahme: Verbindungsadresse laut Community-Projekten, nicht selbst bestaetigt.
const WS_ADRESSE = 'wss://api.autodarts.com/ms/v0/subscribe'

// Kanal- und Themennamen, bestaetigt am 2026-09-10 aus dem offiziellen
// Web-Client (https://play.autodarts.com/assets/clients-B_BDSwju.js - der
// Dateiname enthaelt einen Hash und aendert sich bei jedem Deploy, siehe
// docs/autodarts-api.md). Ein Thema hat die Form "<kennung>.<zweck>"; die
// fuer ein Match tatsaechlich gebrauchten Zwecke stehen in MATCH_ABO_ZWECKE
// unten.
export const KANAL_BOARDS = 'autodarts.boards'
export const KANAL_MATCHES = 'autodarts.matches'

/** Thema, um die Match-Ereignisse eines Boards zu abonnieren. */
export function boardThema(boardId: string): string {
  return `${boardId}.matches`
}

// Zwecke, die beim Erkennen eines Matches automatisch mitabonniert werden -
// eine Stelle, an der sich die Liste aendern laesst (siehe matchThemen()).
// .state allein reicht nicht: laut eigenem Fund im offiziellen Web-Client
// (https://play.autodarts.com/assets/use-game-*.js, 2026-09-10) abonniert die
// Live-Match-Ansicht fuer ein Match zusaetzlich .game-events (dort stecken
// die eigentlichen Wurf-/Zug-Ereignisse, siehe GameEvent-Werte
// turn_start/throw/turn_end/game_shot in clients-B_BDSwju.js) und
// .corrections; bei Matches mit Schiedsrichter- bzw. Anfechtungsfunktion
// zusaetzlich .referee/.challenge. .events ist im selben Client-SDK
// definiert, wird von der Live-Match-Ansicht selbst aber nachweislich NICHT
// abonniert - trotzdem mit aufgenommen: ein zusaetzliches, nie feuerndes
// Abonnement kostet nur eine Zeile im Diagnoseprotokoll, ein fehlendes ein
// ganzes Match (siehe docs/autodarts-api.md, Abschnitt "WebSocket-
// Abonnements").
export const MATCH_ABO_ZWECKE = ['state', 'events', 'game-events', 'corrections', 'referee', 'challenge'] as const

/** Thema, um den Zustand eines einzelnen Matches zu abonnieren. */
export function matchThema(matchId: string): string {
  return `${matchId}.${MATCH_ABO_ZWECKE[0]}`
}

/**
 * Alle Themen, die fuer ein erkanntes Match abonniert werden sollen (siehe
 * MATCH_ABO_ZWECKE) - eine pro Zweck, in derselben Reihenfolge.
 */
export function matchThemen(matchId: string): string[] {
  return MATCH_ABO_ZWECKE.map((zweck) => `${matchId}.${zweck}`)
}

export type Verbindung = {
  abonnieren(kanal: string, thema: string): void
  // Gegenstueck zu abonnieren() - entfernt den Eintrag auch aus der
  // Merkliste (siehe abonnements unten), damit eine spaetere
  // Wiederverbindung das abbestellte Thema nicht erneut sendet.
  abbestellen(kanal: string, thema: string): void
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
/**
 * Baut die Adresse des Subscribe-Endpunkts. Der Abfrageparameter heisst
 * `code`, nicht `ticket` - am 2026-09-10 gegen den echten Server belegt:
 * mit `?ticket=` antwortet er `401 "unauthorized"` (Parameter unbekannt,
 * also wie gar keiner), mit `?code=` dagegen `401 "invalid ticket"`, prueft
 * den Wert also tatsaechlich. Passt zur Antwort von POST /ms/v0/tickets, die
 * das Ticket ebenfalls im Feld `code` liefert.
 */
export function subscribeAdresse(ticket: string): string {
  return `${WS_ADRESSE}?code=${encodeURIComponent(ticket)}`
}

export function ticketAusAntwort(antwort: unknown): string {
  // Bestaetigt am 2026-09-10 an einer echten Serverantwort: das Ticket steht
  // im Feld "code". Die urspruenglich erwartete reine Zeichenkette stammte aus
  // einem Community-Projekt und war falsch - genau daran scheiterte der erste
  // Verbindungsaufbau nach einer erfolgreichen Anmeldung.
  if (typeof antwort === 'object' && antwort !== null) {
    const wert = (antwort as Record<string, unknown>).code
    if (typeof wert === 'string' && wert.length > 0) return wert
  }

  // Nachsicht fuer abweichende Formen, falls Autodarts das Feld je umbenennt:
  // lieber mit einer Warnung weiterlaufen als ein laufendes Match verlieren.
  if (typeof antwort === 'string' && antwort.length > 0) {
    console.warn('Ticket-Antwort war eine reine Zeichenkette statt eines Objekts mit "code".')
    return antwort
  }

  if (typeof antwort === 'object' && antwort !== null) {
    const rumpf = antwort as Record<string, unknown>
    for (const feld of ['ticket', 'id', 'token'] as const) {
      const wert = rumpf[feld]
      if (typeof wert === 'string' && wert.length > 0) {
        console.warn(
          `Ticket-Antwort trug das Ticket im Feld "${feld}" statt in "code". websocket.ts pruefen.`,
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

// Gaengige Kandidatenfelder fuer die Match-Kennung in einem Rohereignis, in
// Pruefreihenfolge. Nicht geraten, sondern die vom Herausgeber genannte Liste
// - welches Feld Autodarts tatsaechlich benutzt, ist unbekannt, bis ein
// echter Mitschnitt vorliegt (siehe matchIdAusEreignis).
const MATCH_KENNUNG_KANDIDATEN = ['matchId', 'id', 'match'] as const

function ersterKandidat(objekt: unknown): string | null {
  if (typeof objekt !== 'object' || objekt === null) return null
  const feldwerte = objekt as Record<string, unknown>
  for (const feld of MATCH_KENNUNG_KANDIDATEN) {
    const wert = feldwerte[feld]
    if (typeof wert === 'string' && wert.length > 0) return wert
  }
  return null
}

// Live am 2026-09-10 beobachtet (siehe Diagnoseprotokoll waehrend dieser
// Aufgabe, Abonnement-Report): ein echtes Ereignis vom Board-Kanal kam als
// {channel, topic, data} an - die eigentliche Nutzlast steckt in "data",
// nicht im Umschlag selbst. Kein Ratewert: beobachtet wurde nur, DASS ein
// "data"-Feld den Rest traegt - nicht, was darin steht (die Kandidatensuche
// unten bleibt dieselbe). matchZustandNeuLaden() liefert dagegen die
// REST-Antwort direkt ohne diesen Umschlag (deshalb zuerst am Objekt selbst
// suchen, dann erst in "data").
function nutzlast(roh: unknown): unknown {
  if (typeof roh !== 'object' || roh === null) return roh
  const wert = (roh as Record<string, unknown>).data
  return typeof wert === 'object' && wert !== null ? wert : roh
}

/**
 * Liefert das verschachtelte "data"-Feld eines Objekts, falls vorhanden und
 * selbst ein Objekt - sonst null. Anders als nutzlast() oben (die bei
 * Fehlen auf das Ausgangsobjekt zurueckfaellt, weil sie fuer die
 * Kandidatensuche in matchIdAusEreignis gedacht ist) muss hier eindeutig
 * zwischen "kein verschachteltes data-Feld" und "das data-Feld selbst"
 * unterschieden werden - fuer die zweite Feldnamen-Ebene im
 * Diagnoseprotokoll (siehe ereignisZeileFuerProtokoll).
 */
function verschachteltesDatenfeld(objekt: unknown): Record<string, unknown> | null {
  if (typeof objekt !== 'object' || objekt === null) return null
  const wert = (objekt as Record<string, unknown>).data
  return typeof wert === 'object' && wert !== null ? (wert as Record<string, unknown>) : null
}

/**
 * Baut die Protokollzeile fuer ein empfangenes Ereignis: Kanal und Thema aus
 * dem Umschlag, plus Feldnamen der Nutzlast (nutzlast() oben entpackt ein
 * etwaiges "data"-Feld) - und, falls diese Nutzlast selbst wieder ein
 * verschachteltes "data"-Feld traegt, zusaetzlich dessen eigene Feldnamen,
 * eine Ebene tiefer. Nie Werte, nur Feldnamen und JS-Typ (siehe
 * feldUebersicht()) - das ist die einzige Quelle, aus der sich das
 * Ereignis-Schema ohne Mitschnitt erahnen liesse, und darf deshalb nichts
 * Geheimes preisgeben. Modulweite, exportierte Funktion statt Closure in
 * echteVerbindung(): sie braucht keinen internen Zustand und laesst sich so
 * ohne WebSocket-Attrappe testen.
 */
export function ereignisZeileFuerProtokoll(roh: unknown): string {
  const objekt = typeof roh === 'object' && roh !== null ? (roh as Record<string, unknown>) : null
  const kanal = objekt && typeof objekt.channel === 'string' ? objekt.channel : '?'
  const thema = objekt && typeof objekt.topic === 'string' ? objekt.topic : '?'
  const nutzlastObjekt = nutzlast(roh)
  const zeile = `Ereignis empfangen: Kanal=${kanal} Thema=${thema} Felder=[${feldUebersicht(nutzlastObjekt)}]`
  const verschachtelt = verschachteltesDatenfeld(nutzlastObjekt)
  return verschachtelt ? `${zeile} Verschachtelte-data-Felder=[${feldUebersicht(verschachtelt)}]` : zeile
}

/**
 * Heuristische Extraktion einer Match-Kennung aus einem Rohereignis - sowohl
 * um nach einer Wiederverbindung zu wissen, welches Match per GET
 * /gs/v0/matches/{matchId}/state neu geladen werden muss, als auch um den
 * Match-Kanal (KANAL_MATCHES/matchThemen) automatisch zu abonnieren. Prueft
 * MATCH_KENNUNG_KANDIDATEN der Reihe nach, zuerst am Objekt selbst und dann -
 * falls dort nichts passt - in einem verschachtelten "data"-Feld (siehe
 * nutzlast oben), und liefert den ersten Treffer, der eine nichtleere
 * Zeichenkette ist. Ein Kandidatenfeld mit falschem Typ (z.B. eine Zahl) wird
 * uebersprungen statt die Suche abzubrechen. Liefert null, wenn kein Kandidat
 * passt; welches Feld die eigentliche Nutzlast tatsaechlich benutzt, ist
 * durch keinen echten Mitschnitt bestaetigt, da diese Aufgabe ohne
 * Dartscheibe umgesetzt wurde. Liefert null: ereignisVerarbeiten() in
 * echteVerbindung() protokolliert das einmalig deutlich.
 */
export function matchIdAusEreignis(roh: unknown): string | null {
  return ersterKandidat(roh) ?? ersterKandidat(nutzlast(roh))
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
    abbestellen: () => {
      // Siehe abonnieren oben - nichts zu abbestellen ohne echte Verbindung.
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

  // Nur einmal protokolliert, nicht bei jedem Ereignis ohne Match-Kennung -
  // sonst waere das eine Zeile pro Ereignis, solange noch kein Match laeuft
  // (z.B. Board-Heartbeats). Der Herausgeber sieht die Feldnamen ohnehin bei
  // jedem Ereignis (siehe ereignisZeileFuerProtokoll oben) - dieser Hinweis
  // ist nur die deutliche Zusatzmeldung, falls MATCH_KENNUNG_KANDIDATEN nie
  // greift.
  let matchKennungFehltProtokolliert = false

  // Kernlogik von abonnieren()/abbestellen() - auch von der automatischen
  // Match-Erkennung unten genutzt, nicht nur vom zurueckgegebenen
  // Verbindung-Objekt.
  const abonnierenIntern = (kanal: string, thema: string): void => {
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
      aktiverSocket.send(JSON.stringify({ channel: kanal, type: 'subscribe', topic: thema }))
      void protokollieren(`Abonnement gesendet: ${kanal}/${thema}`)
    }
  }

  const abbestellenIntern = (kanal: string, thema: string): void => {
    const schluessel = `${kanal} ${thema}`
    // Nicht (mehr) abonniert -> nichts zu tun. Verhindert unter anderem, dass
    // eine Wiederverbindung ein laengst abbestelltes Thema erneut sendet:
    // abbestellen() entfernt den Eintrag aus derselben Merkliste, die
    // alleAbonnementsSenden() nach jedem (Wieder-)Verbinden durchgeht.
    if (!abonnements.has(schluessel)) return
    abonnements.delete(schluessel)
    if (aktiverSocket && aktiverSocket.readyState === WebSocket.OPEN) {
      aktiverSocket.send(JSON.stringify({ channel: kanal, type: 'unsubscribe', topic: thema }))
      void protokollieren(`Abonnement abbestellt: ${kanal}/${thema}`)
    }
  }

  // Sobald ein Ereignis eine (neue) Match-Kennung traegt: alle Match-Themen
  // (siehe matchThemen()/MATCH_ABO_ZWECKE) abonnieren und - falls zuvor ein
  // anderes Match lief - dessen Themen abbestellen. Eine neue Match-Kennung
  // heisst zwangslaeufig, dass ein vorheriges Match vorbei ist (es gibt
  // immer nur ein laufendes Match je Board) - eine eigene "Match zu
  // Ende"-Kennung waere eine weitere Annahme ueber ein unbekanntes
  // Ereignisfeld, die sich ohne Mitschnitt nicht pruefen liesse.
  const matchAbonnementAktualisieren = (matchId: string): void => {
    if (matchId === aktuellerMatchId) return
    const vorherigeMatchId = aktuellerMatchId
    aktuellerMatchId = matchId
    if (vorherigeMatchId) {
      for (const thema of matchThemen(vorherigeMatchId)) abbestellenIntern(KANAL_MATCHES, thema)
    }
    for (const thema of matchThemen(matchId)) abonnierenIntern(KANAL_MATCHES, thema)
    void protokollieren(
      `Match erkannt, ${MATCH_ABO_ZWECKE.length} Themen fuer ${KANAL_MATCHES}/${matchId} abonniert (${MATCH_ABO_ZWECKE.join(', ')})`,
    )
  }

  const ereignisVerarbeiten = (roh: unknown): void => {
    void protokollieren(ereignisZeileFuerProtokoll(roh))

    const matchId = matchIdAusEreignis(roh)
    if (matchId) {
      matchAbonnementAktualisieren(matchId)
    } else if (!aktuellerMatchId && !matchKennungFehltProtokolliert) {
      matchKennungFehltProtokolliert = true
      void protokollieren(
        `Keine Match-Kennung unter den bekannten Feldern (${MATCH_KENNUNG_KANDIDATEN.join(', ')}) gefunden - weder im Ereignis selbst noch in einem verschachtelten "data"-Feld - kein automatisches Match-Abonnement moeglich.`,
      )
    }

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
    if (abonnements.size === 0) return
    for (const a of abonnements.values()) {
      socket.send(JSON.stringify({ channel: a.kanal, type: 'subscribe', topic: a.thema }))
    }
    void protokollieren(`Abonnements gesendet: ${abonnements.size}`)
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
      void protokollieren(`Ticket holen fehlgeschlagen: ${fehler instanceof Error ? fehler.message : String(fehler)}`)
      throw fehler
    }
    void protokollieren('Ticket geholt')

    // schliessen() kann waehrend dieses Awaits aufgerufen worden sein (z.B.
    // beim Beenden der Anwendung mitten in einem Wiederverbindungsversuch).
    // Ohne diese Pruefung wuerde jetzt trotzdem ein neuer Socket aufgebaut,
    // Abonnements gesendet und Ereignisse an einen Aufzeichnungsstream
    // weitergereicht, dessen Beenden schon lief.
    if (geschlossen) return

    const ticket = ticketAusAntwort(ticketAntwort)
    const neuerSocket = new WebSocket(subscribeAdresse(ticket))

    await new Promise<void>((resolve, reject) => {
      let geoeffnet = false

      neuerSocket.onopen = () => {
        geoeffnet = true
        aktiverSocket = neuerSocket
        void protokollieren('WebSocket offen')
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
        if (!geoeffnet) {
          void protokollieren('WebSocket-Verbindung fehlgeschlagen (onerror vor dem ersten Oeffnen)')
          reject(new Error('Autodarts-WebSocket-Verbindung fehlgeschlagen'))
        }
      }

      neuerSocket.onclose = () => {
        aktiverSocket = null
        if (!geoeffnet) {
          void protokollieren('WebSocket-Verbindung fehlgeschlagen (geschlossen vor dem ersten Oeffnen)')
          reject(new Error('Autodarts-WebSocket-Verbindung fehlgeschlagen'))
          return
        }
        // Nur bei einem echten Abbruch (nicht bei schliessen()) 'getrennt'
        // melden - sonst zeigte das Control-Fenster nach einer bewussten
        // Abmeldung "Wiederverbindung laeuft automatisch" an, obwohl gar
        // keine geplant ist (geschlossen unterdrueckt sie unten ohnehin).
        if (!geschlossen) {
          void protokollieren('WebSocket getrennt')
          zustandMelden(zustandsRueckruf, 'getrennt')
          wiederverbindenPlanen()
        }
      }
    })
  }

  await verbindungOeffnen()

  return {
    abonnieren: abonnierenIntern,
    abbestellen: abbestellenIntern,
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
