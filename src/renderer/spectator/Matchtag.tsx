// Pausenbildschirm waehrend eines Matchtags, im Kino-Stil als Titelsequenz.
//
// Loest den Vorspann ab, solange ein Turnier laeuft ("ab da aendert sich der
// pausenbildschirm mit statistik einblendungen und die liste wer wie viele
// punkte hat und am gewinnen ist"). Welche Folien es gibt und in welcher
// Reihenfolge, steht in matchtagFolien.ts; alle Zahlen kommen aus
// abgeschlossenen Partien (src/shared/matchtag.ts). Wo es keine Grundlage
// gibt, faellt der Wert weg, statt eine Null zu zeigen, die nach Leistung
// aussieht.
//
// Gestaltung: docs/superpowers/specs/2026-09-13-pausenscreen-kino-design.md,
// Abschnitt 6 - linksbuendig, riesige Namen, Zeilen tauchen aus der
// Unschaerfe auf, Zahlen zaehlen hoch. Strahlen und Konfetti der Siegerfolie
// sind entfallen; der hellere Verlauf uebernimmt ihre Rolle.

import { useEffect, useState, type CSSProperties } from 'react'
import {
  endstand,
  naechstePaarung,
  spielerBilanzen,
  spielerName,
  statistiken,
  tabelle,
  type Matchtag as MatchtagStand,
  type Paarung,
} from '../../shared/matchtag'
import { folienFuer, type FolienArt } from './matchtagFolien'
import { Fortschritt } from './Fortschritt'
import { Heatmap } from '../shared/Heatmap'
import { KinoBuehne, useVorige, type VerlaufLage } from './KinoBuehne'
import BlurText from './reactbits/BlurText'
import CountUp from './reactbits/CountUp'
import { matchtagFolieParam, vorfuehrMatchtag, vorfuehrMatchtagAktiv } from './vorfuehrung'

/** Standzeit einer Folie. Laenger als beim Vorspann: hier stehen Zahlen. */
const TAKT_MS = 15000
/** Die Folie "Jetzt" bleibt laenger - danach richtet jemand das Match ein. */
const TAKT_JETZT_MS = 20000
/** Analyse, Heatmap und Sieger tragen viel Inhalt und brauchen Lesezeit. */
const TAKT_LANG_MS = 20000

/** Der Text einer neuen Folie beginnt, wenn sie etwa halb eingeblendet ist. */
const TEXT_START_MS = 700

/** Lage des Verlaufs je Folie - der Hintergrund gleitet beim Wechsel dorthin. */
const LAGE: Record<FolienArt, VerlaufLage> = {
  jetzt: { centerX: -0.2, centerY: 0.1, blendAngle: 20 },
  tabelle: { centerX: 0.2, centerY: -0.1, blendAngle: 80 },
  spielplan: { centerX: -0.1, centerY: -0.2, blendAngle: 140 },
  statistik: { centerX: 0.25, centerY: 0.15, blendAngle: 200 },
  analyse: { centerX: -0.25, centerY: 0, blendAngle: 250 },
  heatmap: { centerX: 0.1, centerY: 0.25, blendAngle: 300 },
  aufwaermen: { centerX: 0, centerY: 0.1, blendAngle: 45 },
  sieger: { centerX: 0, centerY: 0.3, blendAngle: 90 },
}

/** Der Matchtag-Stand aus dem Hauptprozess. */
export function useMatchtag(): MatchtagStand | null {
  const vorfuehrung = vorfuehrMatchtagAktiv()
  const [stand, setStand] = useState<MatchtagStand | null>(null)
  useEffect(() => {
    // Mit ?matchtag, ?mtfolie=N oder ?mtaufwaermen kommt ein Beispiel-Matchtag
    // zum Einsatz, damit dieser Bildschirm ohne Scheibe und ohne Turnier
    // begutachtet werden kann.
    if (vorfuehrung) {
      setStand(vorfuehrMatchtag())
      return
    }
    if (typeof window === 'undefined' || !window.app?.beiMatchtag) return
    return window.app.beiMatchtag(setStand)
  }, [vorfuehrung])
  return stand
}

/** Was gerade ansteht - fuer die Statuszeile ueber jeder Folie. */
function statusText(matchtag: MatchtagStand): string {
  if (matchtag.phase === 'beendet') return `Sieger: ${spielerName(matchtag, matchtag.siegerId ?? '')}`
  if (matchtag.phase === 'aufwaermen') return 'Alle Mitspieler in ein Match'
  const naechste = naechstePaarung(matchtag)
  if (!naechste) return 'Alle Partien gespielt'
  const offen = matchtag.paarungen.filter((p) => p.siegerId === null).length
  return `Gleich: ${spielerName(matchtag, naechste.aId)} gegen ${spielerName(matchtag, naechste.bId)} · noch ${offen} ${offen === 1 ? 'Partie' : 'Partien'}`
}

/**
 * Der Weg durch den Abend als Linie, die sich Partie fuer Partie fuellt
 * ("wie so eine roadmap also oben da ist Warmup dann Main Matches oder so und
 * dann Finale das als linie die sich fuellt schritt fuer schritt match fuer
 * match dann weis man wie lange grob noch"). Erreicht ist eine Station ueber
 * die PHASE, gefuellt ist die Linie ueber die Zahl der gespielten Partien.
 */
function Roadmap({ matchtag }: { matchtag: MatchtagStand }) {
  const letzte =
    matchtag.phase === 'stechen' ? 'Stechen' : matchtag.modus === 'huette' ? 'Finale' : 'Entscheidung'
  const stationen = ['Aufwärmen', 'Hauptrunde', letzte]

  const erreicht =
    matchtag.phase === 'aufwaermen' ? 0 : matchtag.phase === 'stechen' || matchtag.phase === 'finale' || matchtag.phase === 'beendet' ? 2 : 1

  const gesamt = matchtag.paarungen.length
  const gespielt = matchtag.paarungen.filter((p) => p.siegerId !== null).length
  const anteil =
    matchtag.phase === 'beendet' ? 1 : matchtag.phase === 'aufwaermen' ? 0 : gesamt === 0 ? 0 : gespielt / gesamt

  return (
    <div className="mt-roadmap">
      <div className="mt-roadmap-linie">
        <span className="mt-roadmap-fuellung" style={{ width: `${Math.round(anteil * 100)}%` }} />
      </div>
      <div className="mt-roadmap-stationen">
        {stationen.map((name, i) => (
          <span
            className={`mt-station${i < erreicht ? ' ist-vorbei' : ''}${i === erreicht ? ' ist-hier' : ''}`}
            key={name}
          >
            <span className="mt-station-punkt" />
            {name}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Zahl mit einer Nachkommastelle, oder ein Strich, wenn es sie nicht gibt. */
function zahl(wert: number | null | undefined, stellen = 1): string {
  return typeof wert === 'number' && Number.isFinite(wert) ? wert.toFixed(stellen) : '–'
}

/** Verzoegerung als Inline-Stil fuer .kino-einblenden. */
function verzoegert(ms: number): { animationDelay: string } {
  return { animationDelay: `${ms}ms` }
}

/** Titelblock jeder Folie: gruener Kicker, darunter der Titel gross. */
function Titel({ kicker, titel }: { kicker: string; titel: string }) {
  return (
    <div className="mt-titel">
      <span className="mt-kicker kino-einblenden" style={verzoegert(TEXT_START_MS - 200)}>
        {kicker}
      </span>
      <BlurText text={titel} className="mt-titel-gross" startVerzoegerungMs={TEXT_START_MS} delay={90} direction="bottom" />
    </div>
  )
}

/** Style-Variable fuer die laengenabhaengige Schriftgroesse in kino.css. */
function zeichenVariable(text: string): CSSProperties {
  return { '--zeichen': text.length } as CSSProperties
}

function FolieJetzt({ matchtag }: { matchtag: MatchtagStand }) {
  const naechste = naechstePaarung(matchtag)
  if (!naechste) return null
  const danach = matchtag.paarungen.filter((p) => p.siegerId === null && p.id !== naechste.id).slice(0, 3)
  const stechen = matchtag.phase === 'stechen'
  const nameA = spielerName(matchtag, naechste.aId)
  const nameB = spielerName(matchtag, naechste.bId)

  return (
    <div className="mt-folie mt-jetzt">
      <div className="mt-jetzt-paar">
        <span className="kino-strich" />
        <span className="mt-kicker">{stechen ? 'Stechen um den Sieg' : 'Als Nächstes'}</span>
        <div className="mt-name-rahmen" style={zeichenVariable(nameA)}>
          <BlurText
            text={nameA}
            className="mt-jetzt-name"
            startVerzoegerungMs={TEXT_START_MS}
            delay={120}
            direction="bottom"
          />
        </div>
        <span className="mt-jetzt-gegen kino-einblenden" style={verzoegert(TEXT_START_MS + 500)}>
          gegen
        </span>
        <div className="mt-name-rahmen" style={zeichenVariable(nameB)}>
          <BlurText
            text={nameB}
            className="mt-jetzt-name"
            startVerzoegerungMs={TEXT_START_MS + 800}
            delay={120}
            direction="bottom"
          />
        </div>
      </div>
      {danach.length > 0 && (
        <div className="mt-danach kino-einblenden" style={verzoegert(TEXT_START_MS + 1400)}>
          <span className="mt-kicker mt-kicker--grau">Danach</span>
          {danach.map((p) => (
            <span className="mt-danach-zeile" key={p.id}>
              {spielerName(matchtag, p.aId)} <em>vs</em> {spielerName(matchtag, p.bId)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function FolieTabelle({ matchtag }: { matchtag: MatchtagStand }) {
  // Nach dem Ende zaehlt die Endplatzierung, nicht die rohe Punktetabelle:
  // im Huetten-Modus entscheiden die Endspiele ueber die Plaetze 1 bis 4.
  const beendet = matchtag.phase === 'beendet'
  const zeilen = beendet ? endstand(matchtag) : tabelle(matchtag)
  const fuehrend = zeilen[0]?.punkte ?? 0
  return (
    <div className="mt-folie">
      <Titel kicker={matchtag.titel || 'Matchtag'} titel={beendet ? 'Endstand' : 'Tabelle'} />
      <table className={`mt-tabelle${zeilen.length > 6 ? ' mt-tabelle--dicht' : ''}`}>
        <thead>
          <tr>
            <th className="mt-sp-platz">#</th>
            <th className="mt-sp-name">Spieler</th>
            <th>Pkt</th>
            <th>Sp</th>
            <th>S</th>
            <th>N</th>
            <th>Legs</th>
            <th>+/–</th>
          </tr>
        </thead>
        <tbody>
          {zeilen.map((z, i) => {
            const vorn = beendet ? z.spieler.id === matchtag.siegerId : z.punkte === fuehrend && z.gespielt > 0
            return (
              <tr
                key={z.spieler.id}
                className={`kino-einblenden${vorn ? ' ist-vorn' : ''}`}
                style={verzoegert(TEXT_START_MS + 300 + i * 110)}
              >
                <td className="mt-sp-platz">{z.platz}</td>
                <td className="mt-sp-name">{z.spieler.name}</td>
                <td className="mt-punkte">{z.punkte}</td>
                <td>{z.gespielt}</td>
                <td>{z.siege}</td>
                <td>{z.niederlagen}</td>
                <td>
                  {z.legsFuer}:{z.legsGegen}
                </td>
                <td>{z.legDifferenz > 0 ? `+${z.legDifferenz}` : z.legDifferenz}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function PlanZeile({
  matchtag,
  paarung,
  naechste,
  verzoegerungMs,
}: {
  matchtag: MatchtagStand
  paarung: Paarung
  naechste: boolean
  verzoegerungMs: number
}) {
  const gespielt = paarung.siegerId !== null
  return (
    <div
      className={`mt-plan-zeile kino-einblenden${gespielt ? ' ist-gespielt' : ''}${naechste ? ' ist-naechste' : ''}`}
      style={verzoegert(verzoegerungMs)}
    >
      <span className={`mt-plan-name${paarung.siegerId === paarung.aId ? ' ist-sieger' : ''}`}>
        {spielerName(matchtag, paarung.aId)}
      </span>
      <span className="mt-plan-mitte">{gespielt ? `${paarung.legsA} : ${paarung.legsB}` : 'vs'}</span>
      <span className={`mt-plan-name${paarung.siegerId === paarung.bId ? ' ist-sieger' : ''}`}>
        {spielerName(matchtag, paarung.bId)}
      </span>
    </div>
  )
}

function FolieSpielplan({ matchtag }: { matchtag: MatchtagStand }) {
  const offen = matchtag.paarungen.filter((p) => p.siegerId === null).length
  const naechste = naechstePaarung(matchtag)
  const spalten = matchtag.paarungen.length > 20 ? 3 : 2
  return (
    <div className="mt-folie">
      <Titel kicker="Spielplan" titel={`${matchtag.paarungen.length - offen} von ${matchtag.paarungen.length} gespielt`} />
      <div className={`mt-plan mt-plan--${spalten}`}>
        {matchtag.paarungen.map((p, i) => (
          <PlanZeile
            key={p.id}
            matchtag={matchtag}
            paarung={p}
            naechste={p.id === naechste?.id}
            verzoegerungMs={TEXT_START_MS + 300 + i * 70}
          />
        ))}
      </div>
    </div>
  )
}

function FolieStatistik({ matchtag }: { matchtag: MatchtagStand }) {
  const st = statistiken(matchtag)
  const werte: { titel: string; wert: number; stellen: number; name: string }[] = []
  if (st.bestesAverage) werte.push({ titel: 'Bestes Average', wert: st.bestesAverage.wert, stellen: 1, name: st.bestesAverage.spieler.name })
  if (st.meiste180) werte.push({ titel: 'Meiste 180er', wert: st.meiste180.wert, stellen: 0, name: st.meiste180.spieler.name })
  if (st.hoechstesFinish) werte.push({ titel: 'Höchstes Finish', wert: st.hoechstesFinish.wert, stellen: 0, name: st.hoechstesFinish.spieler.name })
  if (st.gesamt180 > 0) werte.push({ titel: '180er gesamt', wert: st.gesamt180, stellen: 0, name: 'alle zusammen' })

  return (
    <div className="mt-folie">
      <Titel kicker={matchtag.titel || 'Matchtag'} titel="Zahlen des Abends" />
      {werte.length > 0 && (
        <div className="mt-werte">
          {werte.map((w, i) => (
            <div className="mt-wert kino-einblenden" key={w.titel} style={verzoegert(TEXT_START_MS + 300 + i * 150)}>
              <span className="mt-wert-titel">{w.titel}</span>
              <CountUp
                to={w.wert}
                nachkommastellen={w.stellen}
                duration={1.6}
                delay={(TEXT_START_MS + 500 + i * 150) / 1000}
                className="mt-wert-zahl"
              />
              <span className="mt-wert-name">{w.name}</span>
            </div>
          ))}
        </div>
      )}
      {st.schnitte.length > 0 && (
        <div className="mt-schnitte kino-einblenden" style={verzoegert(TEXT_START_MS + 1100)}>
          <span className="mt-kicker mt-kicker--grau">Schnitt über alle Partien</span>
          {st.schnitte.slice(0, 6).map((e) => (
            <span className="mt-schnitt-zeile" key={e.spieler.id}>
              <span>{e.spieler.name}</span>
              <span className="mt-schnitt-wert">{zahl(e.wert)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Die Analyse-Folie: alles, was sich ueber jeden Spieler sagen laesst, in
 * einer Tabelle. Sie ist bewusst dicht - dafuer steht sie auch laenger.
 */
function FolieAnalyse({ matchtag }: { matchtag: MatchtagStand }) {
  const bilanzen = spielerBilanzen(matchtag)
  return (
    <div className="mt-folie">
      <Titel kicker={matchtag.titel || 'Matchtag'} titel="Spieleranalyse" />
      <table className="mt-tabelle mt-analyse">
        <thead>
          <tr>
            <th className="mt-sp-name">Spieler</th>
            <th>Ø</th>
            <th>Bestes</th>
            <th>180</th>
            <th>Finish</th>
            <th>60+</th>
            <th>100+</th>
            <th>140+</th>
            <th>Darts</th>
            <th>Legs</th>
            <th>Pkt</th>
          </tr>
        </thead>
        <tbody>
          {bilanzen.map((b, i) => (
            <tr key={b.spieler.id} className="kino-einblenden" style={verzoegert(TEXT_START_MS + 300 + i * 110)}>
              <td className="mt-sp-name">{b.spieler.name}</td>
              <td>{zahl(b.schnitt)}</td>
              <td>{zahl(b.bestesAverage)}</td>
              <td>{b.count180}</td>
              <td>{b.hoechstesFinish ?? '–'}</td>
              <td>{b.plus60}</td>
              <td>{b.plus100}</td>
              <td>{b.plus140}</td>
              <td>{b.darts}</td>
              <td>
                {b.legsFuer}:{b.legsGegen}
              </td>
              <td className="mt-punkte">{b.punkte}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Die Heatmap-Folie: jeder Spieler mit seiner Scheibe, darauf alle Pfeile des
 * Abends als Waermebild. Wer keinen gemessenen Wurf hat, faellt weg.
 */
function FolieHeatmap({ matchtag }: { matchtag: MatchtagStand }) {
  const mitWuerfen = matchtag.spieler.filter((s) => s.wuerfe.length > 0)
  return (
    <div className="mt-folie">
      <Titel kicker={matchtag.titel || 'Matchtag'} titel="Wo die Pfeile landen" />
      <div className={`mt-heatmaps mt-heatmaps-${Math.min(mitWuerfen.length, 8)}`}>
        {mitWuerfen.map((spieler, i) => (
          <div className="mt-heatkarte kino-einblenden" key={spieler.id} style={verzoegert(TEXT_START_MS + 300 + i * 120)}>
            <Heatmap wuerfe={spieler.wuerfe} />
            <span className="mt-heatname">{spieler.name}</span>
            <span className="mt-heatzahl">{spieler.wuerfe.length} Pfeile</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FolieAufwaermen({ matchtag }: { matchtag: MatchtagStand }) {
  return (
    <div className="mt-folie mt-aufwaermen">
      <span className="kino-strich" />
      <span className="mt-kicker mt-kicker--abstand">{matchtag.titel || 'Matchtag'}</span>
      <BlurText text="Aufwärmrunde" className="mt-riesig" startVerzoegerungMs={TEXT_START_MS} delay={120} direction="bottom" />
      <p className="mt-hinweis kino-einblenden" style={verzoegert(TEXT_START_MS + 700)}>
        Alle Mitspieler in ein Match — danach steht der Spielplan
      </p>
    </div>
  )
}

function FolieSieger({ matchtag }: { matchtag: MatchtagStand }) {
  const stand = endstand(matchtag)
  const sieger = stand.find((z) => z.spieler.id === matchtag.siegerId) ?? stand[0]
  const name = sieger?.spieler.name ?? spielerName(matchtag, matchtag.siegerId ?? '')
  const bilanz = spielerBilanzen(matchtag).find((b) => b.spieler.id === sieger?.spieler.id)
  const verfolger = stand.filter((z) => z.spieler.id !== sieger?.spieler.id).slice(0, 2)

  const werte: { titel: string; wert: number; stellen: number }[] = []
  if (bilanz) {
    werte.push({ titel: 'Punkte', wert: sieger?.punkte ?? 0, stellen: 0 })
    werte.push({ titel: 'Siege', wert: sieger?.siege ?? 0, stellen: 0 })
    if (typeof bilanz.schnitt === 'number' && Number.isFinite(bilanz.schnitt)) werte.push({ titel: 'Ø', wert: bilanz.schnitt, stellen: 1 })
    if (bilanz.count180 > 0) werte.push({ titel: '× 180', wert: bilanz.count180, stellen: 0 })
    if (bilanz.hoechstesFinish !== null) werte.push({ titel: 'Finish', wert: bilanz.hoechstesFinish, stellen: 0 })
  }

  // Der Name baut sich Buchstabe fuer Buchstabe auf; alles Weitere folgt, wenn
  // er steht.
  const nachName = TEXT_START_MS + name.length * 70

  return (
    <div className="mt-folie mt-sieger">
      <span className="kino-strich" />
      <span className="mt-kicker mt-kicker--abstand kino-einblenden" style={verzoegert(TEXT_START_MS - 200)}>
        {matchtag.titel || 'Matchtag'} entschieden
      </span>
      <div className="mt-name-rahmen" style={zeichenVariable(name)}>
        <BlurText
          text={name}
          animateBy="letters"
          className="mt-siegername"
          startVerzoegerungMs={TEXT_START_MS}
          delay={70}
          direction="bottom"
        />
      </div>
      <p className="mt-siegerzeile kino-einblenden" style={verzoegert(nachName + 400)}>
        Sieger des Abends
      </p>
      {werte.length > 0 && (
        <div className="mt-siegerwerte kino-einblenden" style={verzoegert(nachName + 700)}>
          {werte.map((w) => (
            <span className="mt-siegerwert" key={w.titel}>
              <CountUp
                to={w.wert}
                nachkommastellen={w.stellen}
                duration={1.6}
                delay={(nachName + 900) / 1000}
                className="mt-siegerwert-zahl"
              />
              {w.titel}
            </span>
          ))}
        </div>
      )}
      {verfolger.length > 0 && (
        <div className="mt-podest kino-einblenden" style={verzoegert(nachName + 1200)}>
          {verfolger.map((z) => (
            <span className="mt-podest-platz" key={z.spieler.id}>
              <span className="mt-podest-nummer">{z.platz}</span>
              <span className="mt-podest-name">{z.spieler.name}</span>
              <span className="mt-podest-punkte">{z.punkte} Pkt</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function Folie({ art, matchtag }: { art: FolienArt; matchtag: MatchtagStand }) {
  switch (art) {
    case 'jetzt':
      return <FolieJetzt matchtag={matchtag} />
    case 'tabelle':
      return <FolieTabelle matchtag={matchtag} />
    case 'spielplan':
      return <FolieSpielplan matchtag={matchtag} />
    case 'statistik':
      return <FolieStatistik matchtag={matchtag} />
    case 'analyse':
      return <FolieAnalyse matchtag={matchtag} />
    case 'heatmap':
      return <FolieHeatmap matchtag={matchtag} />
    case 'aufwaermen':
      return <FolieAufwaermen matchtag={matchtag} />
    case 'sieger':
      return <FolieSieger matchtag={matchtag} />
  }
}

/** Wie lange eine Folie steht. Timer und Fortschrittslinie lesen dieselbe Zahl. */
function standzeitVon(art: string): number {
  if (art === 'jetzt') return TAKT_JETZT_MS
  if (art === 'analyse' || art === 'heatmap' || art === 'sieger') return TAKT_LANG_MS
  return TAKT_MS
}

export function Matchtag({ matchtag }: { matchtag: MatchtagStand }) {
  const folien = folienFuer(matchtag)
  // ?mtfolie=N haelt eine Folie fest - fuer Bildschirmfotos.
  const festgehalten = matchtagFolieParam()
  const [index, setIndex] = useState(0)

  // Beginnt der Matchtag eine neue Phase, aendert sich die Folienliste. Dann
  // von vorn, statt in einem Index zu stehen, den es nicht mehr gibt - noch
  // WAEHREND des Renders zuruecksetzen (State-Herleitung), sonst zeigt genau
  // dieser eine Render die neue Liste noch mit dem alten Index.
  const schluessel = folien.join('|')
  const [liste, setListe] = useState(schluessel)
  if (liste !== schluessel) {
    setListe(schluessel)
    setIndex(0)
  }

  useEffect(() => {
    if (festgehalten !== null) return
    if (folien.length <= 1) return
    const weiter = window.setTimeout(
      () => setIndex((i) => (i + 1) % folien.length),
      standzeitVon(folien[index % folien.length] ?? ''),
    )
    return () => window.clearTimeout(weiter)
  }, [index, schluessel, folien, festgehalten])

  const art = folien.length === 0 ? undefined : folien[(festgehalten ?? index) % folien.length]
  // Schluessel "art|index": derselbe Wert traegt die Folie erst als ankommende,
  // dann als ausblendende - React behaelt dabei dieselbe Instanz.
  const folienSchluessel = art === undefined ? '' : `${art}|${index}`
  const vorige = useVorige(folienSchluessel)

  if (art === undefined) return null
  const vorigeArt = vorige ? (vorige.split('|')[0] as FolienArt | undefined) : undefined

  return (
    <KinoBuehne lage={LAGE[art]} hell={art === 'sieger'}>
      {vorige && vorigeArt && (
        <div className="kino-folie kino-folie--verlassend" key={vorige}>
          <Folie art={vorigeArt} matchtag={matchtag} />
        </div>
      )}
      <div className="kino-folie kino-folie--ankommend" key={folienSchluessel}>
        <Folie art={art} matchtag={matchtag} />
      </div>

      {/* Kopfzeile ueber jeder Folie: wo der Abend steht und wer als
          naechstes dran ist. */}
      <div className="mt-kopf">
        <Roadmap matchtag={matchtag} />
        <span className="mt-status-text">{statusText(matchtag)}</span>
      </div>

      {festgehalten === null && folien.length > 1 && (
        <Fortschritt dauerMs={standzeitVon(art)} schluessel={folienSchluessel} />
      )}
    </KinoBuehne>
  )
}
