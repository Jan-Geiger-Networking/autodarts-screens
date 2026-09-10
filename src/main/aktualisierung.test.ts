import { describe, expect, it, vi } from 'vitest'

// aktualisierung.ts importiert './fenster' (top-level 'electron'-Import),
// './verbindung' und '../autodarts/diagnose' - gemockt, damit dieser Test
// unter einer normalen Node-Runtime laeuft. Geprueft werden hier
// ausschliesslich die reinen Funktionen; der Updater selbst wird erst
// innerhalb der Funktionen per dynamischem Import geholt und kommt in diesem
// Test nie zum Zug.
vi.mock('./fenster', () => ({ aktualisierungszustandVerteilen: vi.fn() }))
vi.mock('./verbindung', () => ({ matchLaeuft: vi.fn(() => false), verbindungBeenden: vi.fn() }))
vi.mock('../autodarts/diagnose', () => ({ protokollieren: vi.fn(async () => {}) }))
vi.mock('./konfiguration', () => ({ konfigurationLesen: vi.fn() }))

const { betasErlaubt, changelogAbschnitt, fehlerZuMeldung } = await import('./aktualisierung')

describe('betasErlaubt', () => {
  it('folgt der ausdruecklichen Wahl des Herausgebers, egal welche Version laeuft', () => {
    expect(betasErlaubt(true, '1.0.0')).toBe(true)
    expect(betasErlaubt(false, '0.1.0-beta.4')).toBe(false)
  })

  it('richtet sich ohne eigene Wahl nach der laufenden Version', () => {
    // Genau der Fall, an dem die Selbstaktualisierung sonst scheitert: es
    // sind ausschliesslich Vorabversionen veroeffentlicht, und ohne
    // allowPrerelease findet der GitHub-Anbieter nie etwas.
    expect(betasErlaubt(null, '0.1.0-beta.5')).toBe(true)
    expect(betasErlaubt(null, '1.0.0')).toBe(false)
  })
})

describe('changelogAbschnitt', () => {
  const changelog = [
    '# Änderungen',
    '',
    '## [Unveröffentlicht]',
    '',
    '## [0.2.0] - 2026-09-11',
    '',
    '### Hinzugefügt',
    '- Etwas Neues',
    '',
    '## [0.1.0] - 2026-09-10',
    '',
    '- Der Anfang',
  ].join('\n')

  it('schneidet genau den Abschnitt der gesuchten Version heraus', () => {
    expect(changelogAbschnitt(changelog, '0.2.0')).toBe('### Hinzugefügt\n- Etwas Neues')
  })

  it('nimmt beim letzten Abschnitt alles bis zum Dateiende', () => {
    expect(changelogAbschnitt(changelog, '0.1.0')).toBe('- Der Anfang')
  })

  it('gibt null zurueck, wenn die Version nicht im Changelog steht', () => {
    // Lieber nichts anzeigen als den Abschnitt einer fremden Version.
    expect(changelogAbschnitt(changelog, '0.3.0')).toBeNull()
  })

  it('gibt null zurueck, wenn der Abschnitt leer ist', () => {
    expect(changelogAbschnitt(changelog, 'Unveröffentlicht')).toBeNull()
  })

  it('kommt mit Windows-Zeilenenden zurecht', () => {
    expect(changelogAbschnitt(changelog.replace(/\n/g, '\r\n'), '0.1.0')).toBe('- Der Anfang')
  })
})

describe('fehlerZuMeldung', () => {
  it('benennt die fehlende Version als Einstellungsfrage, nicht als Stoerung', () => {
    const meldung = fehlerZuMeldung(new Error('Unable to find latest version on GitHub (404)'))
    expect(meldung).toContain('Beta-Kanal')
  })

  it('erklaert eine fehlende latest.yml als alte Version statt als Defekt', () => {
    // Echter Fall aus dem Lauf gegen die eigene Veroeffentlichung beta.4.
    const meldung = fehlerZuMeldung(
      new Error('Cannot find latest.yml in the latest release artifacts (https://example.invalid/latest.yml): HttpError: 404'),
    )
    expect(meldung).toContain('von Hand')
    expect(meldung).not.toContain('HttpError')
  })

  it('erklaert einen Netzwerkfehler und dass es von selbst weitergeht', () => {
    expect(fehlerZuMeldung(new Error('getaddrinfo ENOTFOUND github.com'))).toContain('von selbst')
  })

  it('reicht einen unbekannten Fehler im Wortlaut durch, statt ihn zu verschlucken', () => {
    expect(fehlerZuMeldung(new Error('irgendetwas Unerwartetes'))).toContain('irgendetwas Unerwartetes')
  })

  it('kommt auch mit einem geworfenen Nicht-Fehler zurecht', () => {
    expect(fehlerZuMeldung('kaputt')).toContain('kaputt')
  })
})
