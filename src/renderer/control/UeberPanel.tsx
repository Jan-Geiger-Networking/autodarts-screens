import { Fragment, useState } from 'react'

// Angaben des Herausgebers, woertlich aus Abschnitt 18.4 der Design-Spec
// (docs/superpowers/specs/2026-09-09-autodarts-dual-screen-design.md) und aus
// README.md/PRIVACY.md/SECURITY.md uebernommen. Bewusst als Konstante im
// Renderer eingebettet statt zur Laufzeit aus den Markdown-Dateien gelesen:
// das Panel muss auch dann vollstaendig sein, wenn die Anwendung ohne
// Repository installiert ist.
const ANBIETER: ReadonlyArray<readonly [string, string]> = [
  ['Diensteanbieter', 'Jan Geiger Networking'],
  ['Inhaber', 'Jan Geiger'],
  ['Anschrift', 'Dorfstr. 10A, 32107 Bad Salzuflen, Nordrhein-Westfalen, Deutschland'],
  ['E-Mail', 'hey@bsbnet.eu'],
  ['Telefon', '+49 5222 9179070'],
  ['Web', 'https://jgnet.eu'],
  ['Rechtsform', 'Einzelunternehmen / Kleingewerbe'],
  ['Umsatzsteuer', 'Kleinunternehmer nach § 19 UStG, keine Umsatzsteuer-Identifikationsnummer'],
  ['Aufsichtsbehörde', 'Gewerbeamt der Stadt Bad Salzuflen, Rudolph-Brandes-Allee 19, 32105 Bad Salzuflen'],
  ['Repository', 'https://github.com/Jan-Geiger-Networking/autodarts-screens'],
  ['Sicherheitskontakt', 'hey@bsbnet.eu'],
  ['Support-Zeitraum', '36 Monate ab dem jeweiligen Release'],
]

export function UeberPanel() {
  const [meldung, setMeldung] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)

  // "Alle lokalen Daten loeschen": fragt einmal nach (window.confirm reicht
  // fuer eine so seltene, folgenreiche Aktion), ruft dann den IPC-Kanal auf
  // und meldet, was tatsaechlich weg ist (src/main/datenLoeschen.ts liefert
  // nur Dateien/Ordner, die vorher existierten).
  async function alleDatenLoeschen() {
    const sicher = window.confirm(
      'Wirklich alle lokalen Daten unwiderruflich löschen?\n\n' +
        'Betroffen: Konfiguration, gespeicherte Anmeldung samt Anmelde-Sitzung ' +
        '(danach ist eine erneute Anmeldung nötig) sowie alle Aufzeichnungen unter recordings/.',
    )
    if (!sicher) return

    setLaeuft(true)
    setMeldung(null)
    try {
      const geloescht = await window.app.datenLoeschen()
      setMeldung(
        geloescht.length > 0
          ? `Gelöscht: ${geloescht.join(', ')}`
          : 'Es gab nichts zu löschen — keine lokalen Daten vorhanden.',
      )
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <div className="ueber-panel">
      <section>
        <h3>Autodarts Dual-Screen</h3>
        <p>
          Version {window.app.version} · Lizenz MIT · Support-Zeitraum 36 Monate ab dem jeweiligen
          Release
        </p>
      </section>

      <section>
        <h3>Angaben des Herausgebers</h3>
        <dl className="anbieter-tabelle">
          {ANBIETER.map(([feld, wert]) => (
            <Fragment key={feld}>
              <dt>{feld}</dt>
              <dd>{wert}</dd>
            </Fragment>
          ))}
        </dl>
        <p>
          Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung bereit:{' '}
          <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noreferrer">
            https://ec.europa.eu/consumers/odr
          </a>
          . Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </section>

      <section>
        <h3>Datenschutz</h3>
        <p>
          Zugangsdaten nimmt die Anwendung nicht entgegen — die Anmeldung erfolgt auf der
          Autodarts-Seite im eingebetteten Fenster. Verarbeitet werden: das
          Aktualisierungs-Token (verschlüsselt in <code>safeStorage</code>), Spielernamen,
          Anzeigenamen, Fotos und Ländercodes, soweit selbst eingetragen, sowie Match-Ereignisse
          während des Spiels, die nur bei eingeschalteter Aufzeichnung gespeichert werden.
        </p>
        <p>
          Alle Daten liegen ausschließlich lokal unter <code>%APPDATA%\autodarts-screens</code>,
          es gibt keinen Server dieser Anwendung. Startet der Nutzer selbst eine Aufzeichnung mit
          einem eigenen Dateipfad (Entwicklungs- und Testfunktion), landet sie dort statt im
          Standardordner — weiterhin ausschließlich lokal. Übermittelt wird ausschließlich an die
          Autodarts-API (Anmeldung, Abruf des Matches) — keine Telemetrie, keine Absturzberichte an
          Dritte. Eine automatische Prüfung auf neue Versionen ist noch nicht eingebaut; sobald sie
          es ist, wird sie hier ergänzt.
        </p>
        <p>
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) bzw. lit. f
          (berechtigtes Interesse am Betrieb der Anwendung). Auskunft, Berichtigung, Löschung,
          Einschränkung, Datenübertragbarkeit und Widerspruch können über die oben genannte
          Adresse geltend gemacht werden; es besteht ein Beschwerderecht bei der
          Landesbeauftragten für Datenschutz und Informationsfreiheit Nordrhein-Westfalen.
          Volltext in PRIVACY.md.
        </p>
        <button type="button" onClick={alleDatenLoeschen} disabled={laeuft}>
          Alle lokalen Daten löschen
        </button>
        {meldung && <p className="loeschmeldung">{meldung}</p>}
      </section>

      <section>
        <h3>Sicherheit</h3>
        <p>
          Schwachstellen bitte per E-Mail an <code>hey@bsbnet.eu</code> melden, nicht als
          öffentliches GitHub-Issue. Empfangsbestätigung innerhalb von 5 Werktagen, erste
          Einschätzung innerhalb von 10 Werktagen; wir bitten darum, eine gemeldete Schwachstelle
          erst öffentlich zu machen, nachdem eine Behebung verfügbar ist oder 90 Tage vergangen
          sind. Volltext in SECURITY.md.
        </p>
      </section>
    </div>
  )
}
