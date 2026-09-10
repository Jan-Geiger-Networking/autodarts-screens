// Vorspann: laeuft, solange kein Match aktiv ist (Basis-Szene 'idle' aus
// szene.ts), und wiederholt sich endlos. Optik einer Sportuebertragung kurz
// vor Anpfiff: vollflaechiges Bild, harter Schnitt im festen Takt, ein
// dauerhaftes Signal-Element ("Spielpause") oben rechts UND eine
// eigene Zwischenfolie ("Gleich geht's weiter"), die sich zwischen die
// Leistungen schiebt - Wunsch des Herausgebers nach Ansehen auf dem echten
// Bildschirm. Siehe den Abschnitt "Vorspann" in App.css fuer die Fahrten
// (gerichtete Transforms, keine Ueberblendung) und
// docs/superpowers/specs/2026-09-09-autodarts-dual-screen-design.md
// Abschnitt 18.4 fuer die Kontaktdaten.
//
// Wortlaut der Leistungsfolien stammt ausschliesslich aus der
// Anbieterkennzeichnung des Herausgebers und den Geschaeftsfeldern seiner
// eigenen Website (jgnet.eu) - keine Werbeversprechen, keine Zahlen, nichts
// hinzuerfunden. QInfo und WindowsTools bleiben aussen vor
// (erklaerungsbeduerftig ohne Kontext), Downtimes ist eine Statusseite und
// keine Leistung.

import { useEffect, useState } from 'react'
import logoWeiss from '../../../assets/logo-white.png'
import patchpanel from '../../../assets/vorspann-patchpanel.jpg'
import server from '../../../assets/vorspann-server.jpg'
import switchFoto from '../../../assets/vorspann-switch.jpg'
import { vorfuehrungAktiv, vorspannFolieParam } from './vorfuehrung'

/** Standzeit einer Leistungsfolie - siehe "Takt statt Zufall" in der Vorgabe, unveraendert. */
const TAKT_MS = 5000
/** Kurzer Atemzug der Zwischenfolie zwischen zwei Leistungen - keine eigene Station. */
const SIGNAL_HALTEN_MS = 1800
/** Dauer der Fahrt, muss zu den @keyframes in App.css passen. Auf Rueckmeldung
 * ("wirkt zu hastig") von vormals 700ms auf das 1,7-fache angehoben, die
 * harte Abbremsung (var(--jg-ease)) bleibt erhalten. */
const UEBERGANG_MS = 1200

// Schriftgroesse nach laengster Zeile von Hand vergeben statt zur Laufzeit
// ausgemessen: bei fester Spaltenbreite (siehe .vorspann-text in App.css)
// reichen drei Stufen, damit kein Wort aus seiner Spalte laeuft.
type Groesse = 'riesig' | 'gross' | 'kompakt'

type Leistungsfolie = {
  art: 'leistung'
  /** 1-2 Zeilen; laengere Woerter brechen von Hand an einer sinnvollen Stelle um. */
  zeilen: string[]
  groesse: Groesse
  unterzeile?: string
  bild: string
}

/** Die Zwischenfolie traegt keine eigenen Daten - ihr Inhalt ist immer derselbe. */
type Signalfolie = { art: 'signal' }

type Folie = Leistungsfolie | Signalfolie

const LEISTUNGEN: Leistungsfolie[] = [
  { art: 'leistung', zeilen: ['Netzwerk', 'infrastruktur'], groesse: 'kompakt', bild: patchpanel },
  { art: 'leistung', zeilen: ['Glasfaser'], groesse: 'gross', unterzeile: 'Internetanbindung', bild: switchFoto },
  { art: 'leistung', zeilen: ['Video', 'überwachung'], groesse: 'gross', bild: server },
  {
    art: 'leistung',
    zeilen: ['Hosting'],
    groesse: 'riesig',
    unterzeile: 'Betrieb auf eigener Infrastruktur in deutschen Rechenzentren',
    bild: patchpanel,
  },
  {
    art: 'leistung',
    zeilen: ['Monitoring'],
    groesse: 'gross',
    unterzeile: 'Cloudflare Zero Trust · SSH Bastion',
    bild: switchFoto,
  },
  { art: 'leistung', zeilen: ['Backup'], groesse: 'riesig', bild: server },
  { art: 'leistung', zeilen: ['Support und', 'Störungsannahme'], groesse: 'kompakt', bild: patchpanel },
  { art: 'leistung', zeilen: ['Windows-', 'Lizenzen'], groesse: 'gross', bild: switchFoto },
]

const SIGNALFOLIE: Signalfolie = { art: 'signal' }

// Wortwunsch des Herausgebers woertlich uebernommen: "zwischen den Szenen mit
// meiner Werbung bitte immer so ein es geht gleich los screen zwischenbauen" -
// deshalb nach JEDER Leistung, nicht nur jeder zweiten (das waere die
// zurueckhaltendere Alternative gewesen, aber "immer" ist eindeutig). Die
// Zaesur entsteht stattdessen durch den Richtungswechsel (siehe
// .vorspann-folie--invers in App.css) und die deutlich kuerzere Standzeit,
// nicht durch Seltenheit.
const FOLIEN: Folie[] = LEISTUNGEN.flatMap((l): Folie[] => [l, SIGNALFOLIE])

function haltenMsVon(folie: Folie): number {
  return folie.art === 'signal' ? SIGNAL_HALTEN_MS : TAKT_MS
}

// Hersteller, mit denen der Herausgeber arbeitet - Beleg fuer
// Networking/Hosting/Backup, deshalb dauerhaft in einer ruhigen Zone statt an
// einzelne Folien gebunden. Als schlichte Namenszeile statt als Logo-Reihe:
// die im Design-System vorhandenen SVGs waren dort selbst als "(Platzhalter)"
// ausgezeichnet (gestrichelte Box, Schreibmaschinenschrift) - auf einem
// Screen vor Gaesten sieht das nach unfertiger Arbeit aus. Echte Hersteller-
// Logos ohne Zustimmung nachzubauen waere zudem markenrechtlich heikel.
const PARTNER = ['Cisco', 'Juniper', 'TP-Link', 'Ubiquiti', 'Backblaze']

export function Vorspann() {
  // ?vorfuehrung&folie=N haelt den Vorspann auf einer Folie fest, unabhaengig
  // vom schritt-Parameter fuer den MatchState (der Vorspann braucht keinen
  // MatchState und laeuft normalerweise unabhaengig von dessen Einfrieren
  // weiter) - siehe vorspannFolieParam in vorfuehrung.ts. Der Index zaehlt
  // jetzt Leistungs- UND Signalfolien durch (gerade Indizes sind Leistungen,
  // ungerade die Zwischenfolie).
  const eingefroreneFolie = vorfuehrungAktiv() ? vorspannFolieParam() : null
  const [startIndex] = useState(() =>
    eingefroreneFolie !== null ? Math.max(0, Math.min(eingefroreneFolie, FOLIEN.length - 1)) : 0,
  )

  const [aktuell, setAktuell] = useState(startIndex)
  const [vorheriger, setVorheriger] = useState<number | null>(null)

  useEffect(() => {
    if (eingefroreneFolie !== null) return
    // Selbst nachplanender Timer statt setInterval: Leistungs- und
    // Signalfolie haben unterschiedliche Standzeiten (haltenMsVon), ein
    // fester Takt wie vorher reicht dafuer nicht mehr.
    const timer = window.setTimeout(() => {
      setAktuell((bisheriger) => {
        setVorheriger(bisheriger)
        return (bisheriger + 1) % FOLIEN.length
      })
    }, haltenMsVon(FOLIEN[aktuell]!))
    return () => window.clearTimeout(timer)
  }, [eingefroreneFolie, aktuell])

  useEffect(() => {
    if (vorheriger === null) return
    const timer = window.setTimeout(() => setVorheriger(null), UEBERGANG_MS)
    return () => window.clearTimeout(timer)
  }, [vorheriger])

  const folie = FOLIEN[aktuell]!

  return (
    <div className="vorspann">
      {vorheriger !== null && <VorspannFolie key={`v-${vorheriger}`} folie={FOLIEN[vorheriger]!} rolle="verlassend" />}
      <VorspannFolie key={`a-${aktuell}`} folie={folie} rolle="ankommend" />

      <div className="vorspann-logo">
        <img src={logoWeiss} alt="JGNet" />
      </div>

      {/* Bleibt zusaetzlich zur Zwischenfolie bestehen: dieser Hinweis ist
          auch waehrend einer Leistungsfolie sichtbar (5s Standzeit gegenueber
          1,8s der Zwischenfolie - ein zufaelliger Blick landet weit
          ueberwiegend hier), die Zwischenfolie ist der kurze, unuebersehbare
          Ausrufer dazwischen. Zwei verschiedene Momente, keine Dopplung. */}
      <div className="vorspann-signal">
        <span className="vorspann-signal-punkt" />
        Spielpause
      </div>

      <div className="vorspann-fuss">
        <div className="vorspann-partner">
          {PARTNER.map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
        <div className="vorspann-kontakt">jgnet.eu · hey@bsbnet.eu · +49 5222 9179070</div>
      </div>
    </div>
  )
}

function VorspannFolie({ folie, rolle }: { folie: Folie; rolle: 'ankommend' | 'verlassend' }) {
  // Die Zwischenfolie faehrt entgegengesetzt zu den Leistungsfolien (siehe
  // .vorspann-folie--invers) - der Richtungswechsel markiert sie als Zaesur,
  // wie vorgeschlagen.
  const invers = folie.art === 'signal'
  const klassen = `vorspann-folie vorspann-folie--${rolle}${invers ? ' vorspann-folie--invers' : ''}`

  if (folie.art === 'signal') {
    return (
      <div className={klassen}>
        <div className="vorspann-signalfolie">
          <div className="vorspann-signalfolie-text">Gleich geht's weiter</div>
        </div>
      </div>
    )
  }

  return (
    <div className={klassen}>
      <img className="vorspann-foto" src={folie.bild} alt="" />
      <div className="vorspann-text">
        <div className={`vorspann-wort vorspann-wort--${folie.groesse}`}>
          {folie.zeilen.map((zeile) => (
            <div key={zeile}>{zeile}</div>
          ))}
        </div>
        {folie.unterzeile && <div className="vorspann-unterzeile">{folie.unterzeile}</div>}
      </div>
    </div>
  )
}
