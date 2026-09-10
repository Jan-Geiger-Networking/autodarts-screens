// Vorspann: laeuft, solange kein Match aktiv ist (Basis-Szene 'idle' aus
// szene.ts), und wiederholt sich endlos. Optik einer Sportuebertragung kurz
// vor Anpfiff: vollflaechiges Bild, harter Schnitt im festen Takt, ein
// dauerhaftes Signal-Element ("Gleich geht's los"). Siehe den Abschnitt
// "Vorspann" in App.css fuer die Fahrten (gerichtete Transforms, keine
// Ueberblendung) und docs/superpowers/specs/2026-09-09-autodarts-dual-screen-design.md
// Abschnitt 18.4 fuer die Kontaktdaten.
//
// Wortlaut der Folien stammt ausschliesslich aus der Anbieterkennzeichnung
// des Herausgebers und den Geschaeftsfeldern seiner eigenen Website
// (jgnet.eu) - keine Werbeversprechen, keine Zahlen, nichts hinzuerfunden.
// QInfo und WindowsTools bleiben aussen vor (erklaerungsbeduerftig ohne
// Kontext), Downtimes ist eine Statusseite und keine Leistung.

import { useEffect, useState } from 'react'
import logoWeiss from '../../../assets/logo-white.png'
import patchpanel from '../../../assets/vorspann-patchpanel.jpg'
import server from '../../../assets/vorspann-server.jpg'
import switchFoto from '../../../assets/vorspann-switch.jpg'
import cisco from '../../../assets/partner/cisco.svg'
import juniper from '../../../assets/partner/juniper.svg'
import tpLink from '../../../assets/partner/tp-link.svg'
import ubiquiti from '../../../assets/partner/ubiquiti.svg'
import backblaze from '../../../assets/partner/backblaze.svg'
import { vorfuehrungAktiv, vorspannFolieParam } from './vorfuehrung'

/** Fester Takt zwischen zwei Folien - siehe "Takt statt Zufall" in der Vorgabe. */
const TAKT_MS = 5000
/** Dauer der Fahrt, muss zu den @keyframes in App.css passen (700ms). */
const UEBERGANG_MS = 700

// Schriftgroesse nach laengster Zeile von Hand vergeben statt zur Laufzeit
// ausgemessen: bei fester Spaltenbreite (siehe .vorspann-text in App.css)
// reichen drei Stufen, damit kein Wort aus seiner Spalte laeuft.
type Groesse = 'riesig' | 'gross' | 'kompakt'

type Folie = {
  /** 1-2 Zeilen; laengere Woerter brechen von Hand an einer sinnvollen Stelle um. */
  zeilen: string[]
  groesse: Groesse
  unterzeile?: string
  bild: string
}

const FOLIEN: Folie[] = [
  { zeilen: ['Netzwerk', 'infrastruktur'], groesse: 'kompakt', bild: patchpanel },
  { zeilen: ['Glasfaser'], groesse: 'gross', unterzeile: 'Internetanbindung', bild: switchFoto },
  { zeilen: ['Video', 'überwachung'], groesse: 'gross', bild: server },
  {
    zeilen: ['Hosting'],
    groesse: 'riesig',
    unterzeile: 'Betrieb auf eigener Infrastruktur in deutschen Rechenzentren',
    bild: patchpanel,
  },
  { zeilen: ['Monitoring'], groesse: 'gross', unterzeile: 'Cloudflare Zero Trust · SSH Bastion', bild: switchFoto },
  { zeilen: ['Backup'], groesse: 'riesig', bild: server },
  { zeilen: ['Support und', 'Störungsannahme'], groesse: 'kompakt', bild: patchpanel },
  { zeilen: ['Windows-', 'Lizenzen'], groesse: 'gross', bild: switchFoto },
]

// Herstellerzeichen, mit denen der Herausgeber arbeitet - Beleg fuer
// Networking/Hosting/Backup, deshalb dauerhaft in einer ruhigen Zone statt an
// einzelne Folien gebunden.
const PARTNER = [
  { name: 'Cisco', src: cisco },
  { name: 'Juniper', src: juniper },
  { name: 'TP-Link', src: tpLink },
  { name: 'Ubiquiti', src: ubiquiti },
  { name: 'Backblaze', src: backblaze },
]

export function Vorspann() {
  // ?vorfuehrung&folie=N haelt den Vorspann auf einer Folie fest, unabhaengig
  // vom schritt-Parameter fuer den MatchState (der Vorspann braucht keinen
  // MatchState und laeuft normalerweise unabhaengig von dessen Einfrieren
  // weiter) - siehe vorspannFolieParam in vorfuehrung.ts.
  const eingefroreneFolie = vorfuehrungAktiv() ? vorspannFolieParam() : null
  const [startIndex] = useState(() =>
    eingefroreneFolie !== null ? Math.max(0, Math.min(eingefroreneFolie, FOLIEN.length - 1)) : 0,
  )

  const [aktuell, setAktuell] = useState(startIndex)
  const [vorheriger, setVorheriger] = useState<number | null>(null)

  useEffect(() => {
    if (eingefroreneFolie !== null) return
    const takt = window.setInterval(() => {
      setAktuell((bisheriger) => {
        setVorheriger(bisheriger)
        return (bisheriger + 1) % FOLIEN.length
      })
    }, TAKT_MS)
    return () => window.clearInterval(takt)
  }, [eingefroreneFolie])

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

      <img className="bug" src={logoWeiss} alt="JGNet" />

      <div className="vorspann-signal">
        <span className="vorspann-signal-punkt" />
        Gleich geht's los
      </div>

      <div className="vorspann-fuss">
        <div className="vorspann-partner">
          {PARTNER.map((p) => (
            <img key={p.name} src={p.src} alt={p.name} />
          ))}
        </div>
        <div className="vorspann-kontakt">jgnet.eu · hey@bsbnet.eu · +49 5222 9179070</div>
      </div>
    </div>
  )
}

function VorspannFolie({ folie, rolle }: { folie: Folie; rolle: 'ankommend' | 'verlassend' }) {
  return (
    <div className={`vorspann-folie vorspann-folie--${rolle}`}>
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
