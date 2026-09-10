import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NichtAngemeldetFehler, senden } from './rest'
import { subscribeAdresse, ticketAusAntwort, verbinden, wartezeit } from './websocket'

// Ersetzt die Ticket-Beschaffung: senden() kommt aus rest.ts und wuerde ohne
// Mock echtes fetch()/zugriffsToken() ausloesen. holen() wird ebenfalls
// ersetzt, rein zur Sicherheit (matchZustandNeuLaden ruft es nach einer
// Wiederverbindung mit bekannter matchId auf - in diesen Tests nie der Fall,
// aber ein echter Netzaufruf soll unter keinen Umstaenden passieren).
vi.mock('./rest', async (importOriginal) => {
  const echte = await importOriginal<typeof import('./rest')>()
  return { ...echte, senden: vi.fn(), holen: vi.fn().mockResolvedValue({}) }
})

/**
 * Attrappe fuer die globale WebSocket-Klasse, die websocket.ts als vom
 * Electron-Hauptprozess gegeben voraussetzt (siehe Dateikopf von
 * websocket.ts). Oeffnet sich selbst kurz nach dem Konstruieren (Microtask,
 * von den Fake-Timern unten unberuehrt), damit verbinden() ohne manuelles
 * Zutun durchlaeuft - onclose() wird von den Tests gezielt aufgerufen, um
 * einen Verbindungsabbruch zu simulieren.
 */
class AttrappeWebSocket {
  static OPEN = 1
  static instanzen: AttrappeWebSocket[] = []
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((ereignis: { data: unknown }) => void) | null = null
  readyState = 0
  gesendet: string[] = []

  constructor(public url: string) {
    AttrappeWebSocket.instanzen.push(this)
    queueMicrotask(() => {
      this.readyState = AttrappeWebSocket.OPEN
      this.onopen?.()
    })
  }

  send(daten: string): void {
    this.gesendet.push(daten)
  }

  close(): void {
    this.readyState = 3
    this.onclose?.()
  }
}

describe('wartezeit', () => {
  it('waechst exponentiell bis 16s und bleibt danach bei 30s', () => {
    expect(wartezeit(1)).toBe(1000)
    expect(wartezeit(2)).toBe(2000)
    expect(wartezeit(3)).toBe(4000)
    expect(wartezeit(4)).toBe(8000)
    expect(wartezeit(5)).toBe(16000)
    expect(wartezeit(6)).toBe(30000)
    expect(wartezeit(7)).toBe(30000)
    expect(wartezeit(100)).toBe(30000)
  })
})

describe('subscribeAdresse', () => {
  // Der Parametername ist gegen den echten Server belegt: mit ?ticket=
  // antwortet er "unauthorized" (Parameter unbekannt), mit ?code= dagegen
  // "invalid ticket" - er prueft den Wert also. Genau daran scheiterte die
  // Verbindung nach erfolgreicher Anmeldung.
  it('haengt das Ticket als Parameter code an, nicht als ticket', () => {
    const adresse = subscribeAdresse('abc123')
    expect(adresse).toContain('?code=abc123')
    expect(adresse).not.toContain('ticket=')
  })

  it('kodiert Sonderzeichen im Ticket', () => {
    expect(subscribeAdresse('a b+c/d')).toContain('?code=a%20b%2Bc%2Fd')
  })

  it('zeigt auf den Subscribe-Endpunkt', () => {
    expect(subscribeAdresse('x')).toMatch(/^wss:\/\/api\.autodarts\.com\/ms\/v0\/subscribe\?/)
  })
})

describe('ticketAusAntwort', () => {
  // Die echte Antwortform, am 2026-09-10 an einer Serverantwort belegt. Genau
  // hier scheiterte der Verbindungsaufbau nach erfolgreicher Anmeldung: die
  // Funktion kannte "ticket", "id" und "token", aber nicht "code".
  it('liest das Ticket aus dem Feld code', () => {
    expect(ticketAusAntwort({ code: 'abc123' })).toBe('abc123')
  })

  it('bevorzugt code, wenn mehrere Felder vorhanden sind', () => {
    expect(ticketAusAntwort({ code: 'richtig', ticket: 'falsch' })).toBe('richtig')
  })

  it('akzeptiert weiterhin eine reine Zeichenkette', () => {
    expect(ticketAusAntwort('abc123')).toBe('abc123')
  })

  it('findet ein Ticket auch unter anderen gaengigen Feldnamen', () => {
    expect(ticketAusAntwort({ ticket: 'xyz' })).toBe('xyz')
    expect(ticketAusAntwort({ id: 'xyz' })).toBe('xyz')
    expect(ticketAusAntwort({ token: 'xyz' })).toBe('xyz')
  })

  it('wirft bei komplett unerwarteter Antwortform', () => {
    expect(() => ticketAusAntwort({ unerwartet: 1 })).toThrow()
    expect(() => ticketAusAntwort(null)).toThrow()
    expect(() => ticketAusAntwort(42)).toThrow()
    expect(() => ticketAusAntwort('')).toThrow()
  })
})

describe('verbinden: Zustandsmeldungen und Abonnement-Dedublizierung', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    AttrappeWebSocket.instanzen = []
    vi.mocked(senden).mockReset()
    delete process.env.AD_WIEDERGABE
    delete process.env.AD_AUFZEICHNEN
    vi.stubGlobal('WebSocket', AttrappeWebSocket)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('sendet ein doppeltes abonnieren fuer denselben Kanal/Thema nicht erneut (Befund 1)', async () => {
    vi.mocked(senden).mockResolvedValueOnce('ticket-1')
    const verbindung = await verbinden(() => {})

    verbindung.abonnieren('matches', 'm1')
    verbindung.abonnieren('matches', 'm1')

    const socket = AttrappeWebSocket.instanzen[0]!
    const subscribeNachrichten = socket.gesendet.filter((s) => s.includes('"topic":"m1"'))
    expect(subscribeNachrichten.length).toBe(1)

    verbindung.schliessen()
  })

  it('meldet "verbunden", sobald die Verbindung steht', async () => {
    vi.mocked(senden).mockResolvedValueOnce('ticket-1')
    const zustaende: string[] = []
    const verbindung = await verbinden(() => {}, (z) => zustaende.push(z))

    expect(zustaende).toEqual(['verbunden'])
    verbindung.schliessen()
  })

  it('meldet "nichtAngemeldet" und wirft, wenn schon der erste Verbindungsversuch an der Anmeldung scheitert', async () => {
    vi.mocked(senden).mockRejectedValueOnce(new NichtAngemeldetFehler())
    const zustaende: string[] = []

    await expect(verbinden(() => {}, (z) => zustaende.push(z))).rejects.toThrow('Bitte erneut anmelden')
    expect(zustaende).toEqual(['nichtAngemeldet'])
  })

  it('erkennt "nichtAngemeldet" ueber den Fehlertyp, nicht ueber den Nachrichtentext (Fix-Runde 2)', async () => {
    const fehler = new NichtAngemeldetFehler()
    // Nachricht nachtraeglich auf einen komplett anderen Wortlaut geaendert -
    // der Nutzertext ist fuer Menschen gedacht und darf sich jederzeit
    // aendern. Wuerde istAuthFehler() in websocket.ts (wieder) auf einen
    // Textvergleich zurueckfallen statt auf instanceof zu pruefen, bliebe
    // "nichtAngemeldet" hier aus und dieser Test schluege fehl.
    fehler.message = 'Ein ganz anderer Text, der morgen im UI stehen koennte'
    vi.mocked(senden).mockRejectedValueOnce(fehler)

    const zustaende: string[] = []
    await expect(verbinden(() => {}, (z) => zustaende.push(z))).rejects.toBe(fehler)
    expect(zustaende).toEqual(['nichtAngemeldet'])
  })

  it('meldet einen Anmeldeverlust mitten in der Sitzung, versucht weiter und greift bei erneuter Anmeldung von selbst wieder (Befund 2)', async () => {
    vi.mocked(senden)
      .mockResolvedValueOnce('ticket-1')
      .mockRejectedValueOnce(new NichtAngemeldetFehler())
      .mockResolvedValueOnce('ticket-2')

    const zustaende: string[] = []
    const verbindung = await verbinden(() => {}, (z) => zustaende.push(z))
    expect(zustaende).toEqual(['verbunden'])

    // Verbindung bricht mitten in der Sitzung ab (z.B. Aktualisierungs-Token widerrufen).
    AttrappeWebSocket.instanzen[0]!.close()
    expect(zustaende).toEqual(['verbunden', 'getrennt'])

    // Erster Wiederverbindungsversuch (wartezeit(1) = 1000ms) scheitert an
    // der Anmeldung - die Wiederverbindung darf trotzdem weiterlaufen.
    await vi.advanceTimersByTimeAsync(1000)
    expect(zustaende).toEqual(['verbunden', 'getrennt', 'nichtAngemeldet'])
    expect(senden).toHaveBeenCalledTimes(2)

    // Zweiter Versuch (wartezeit(2) = 2000ms spaeter) - der Nutzer hat sich
    // in der Zwischenzeit erneut angemeldet, der Ticket-Abruf klappt wieder.
    await vi.advanceTimersByTimeAsync(2000)
    expect(zustaende).toEqual(['verbunden', 'getrennt', 'nichtAngemeldet', 'verbunden'])
    expect(senden).toHaveBeenCalledTimes(3)
    expect(AttrappeWebSocket.instanzen.length).toBe(2)

    verbindung.schliessen()
  })

  // Nachtrag zur Anmelden/Abmelden-Aufgabe: schliessen() darf einen
  // gezielten Abbruch nicht als 'getrennt' melden (siehe onclose in
  // echteVerbindung), sonst zeigte das Control-Fenster nach einer bewussten
  // Abmeldung "getrennt - Wiederverbindung laeuft automatisch" an, obwohl
  // gar keine Wiederverbindung geplant ist. Zwei Tests, die sich gegenseitig
  // absichern: der eine haette dieselbe zustaende-Assertion auch bestanden,
  // wenn 'getrennt' komplett verschwunden waere.
  it('meldet "getrennt" weiterhin bei einem unerwarteten Verbindungsabbruch', async () => {
    vi.mocked(senden).mockResolvedValueOnce('ticket-1')
    const zustaende: string[] = []
    const verbindung = await verbinden(() => {}, (z) => zustaende.push(z))

    // Abbruch von aussen (z.B. Netzwerk weg) - nicht ueber schliessen().
    AttrappeWebSocket.instanzen[0]!.close()

    expect(zustaende).toEqual(['verbunden', 'getrennt'])
    verbindung.schliessen()
  })

  it('meldet "getrennt" NICHT nach einem gezielten schliessen()', async () => {
    vi.mocked(senden).mockResolvedValueOnce('ticket-1')
    const zustaende: string[] = []
    const verbindung = await verbinden(() => {}, (z) => zustaende.push(z))

    // schliessen() setzt geschlossen=true und ruft dann aktiverSocket.close()
    // auf - das loest denselben onclose-Zuhoerer aus wie im Test oben, aber
    // wegen geschlossen=true soll er hier kein 'getrennt' mehr melden.
    await verbindung.schliessen()

    expect(zustaende).toEqual(['verbunden'])
  })
})
