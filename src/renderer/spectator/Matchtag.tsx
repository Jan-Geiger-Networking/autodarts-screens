// Pausenbildschirm waehrend eines Matchtags.
//
// Loest den Vorspann ab, solange ein Turnier laeuft ("ab da aendert sich der
// pausenbildschirm mit statistik einblendungen und die liste wer wie viele
// punkte hat und am gewinnen ist"). Vier Folien im festen Takt, wie beim
// Vorspann - harter Schnitt statt Ueberblendung, damit es nach Uebertragung
// aussieht und nicht nach Diaschau:
//
//   1. JETZT       - welche Partie als naechstes einzurichten ist. Die
//                    wichtigste Folie, deshalb die erste und die laengste.
//   2. TABELLE     - wer wie viele Punkte hat und am Gewinnen ist.
//   3. SPIELPLAN   - wer gegen wen, gespielt und noch offen.
//   4. STATISTIK   - bestes Average, meiste 180er, hoechstes Finish.
//
// Sonderfaelle: die Aufwaermrunde bekommt eine eigene Folie (dort gibt es
// noch keinen Spielplan), und ein entschiedener Matchtag beginnt mit dem
// Sieger.
//
// Alle Zahlen kommen aus abgeschlossenen Partien (src/shared/matchtag.ts).
// Wo es keine Grundlage gibt, faellt die Kachel weg, statt eine Null zu
// zeigen, die nach Leistung aussieht.

import { useEffect, useState } from 'react'
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
import { folienFuer } from './matchtagFolien'
import { Fortschritt } from './Fortschritt'
import { Heatmap } from '../shared/Heatmap'
import { matchtagFolieParam, vorfuehrMatchtag, vorfuehrMatchtagAktiv } from './vorfuehrung'
import logoWeiss from '../../../assets/logo-white.png'

/** Standzeit einer Folie. Laenger als beim Vorspann: hier stehen Zahlen, die
 * man lesen koennen muss, keine Schlagworte. */
const TAKT_MS = 15000
/** Die Folie "Jetzt" bleibt laenger - danach richtet jemand das Match ein. */
const TAKT_JETZT_MS = 20000
/** Analyse und Heatmap tragen viel Inhalt und brauchen Lesezeit. */
const TAKT_LANG_MS = 20000

/** Der Matchtag-Stand aus dem Hauptprozess. */
export function useMatchtag(): MatchtagStand | null {
  const vorfuehrung = vorfuehrMatchtagAktiv()
  const [stand, setStand] = useState<MatchtagStand | null>(null)
  useEffect(() => {
    // Mit ?matchtag oder ?mtfolie=N kommt ein Beispiel-Matchtag zum Einsatz,
    // damit dieser Bildschirm auch ohne Scheibe und ohne Turnier
    // begutachtet werden kann. Ohne die Parameter bleibt es beim normalen
    // Vorspann - sonst liesse der sich nicht mehr ansehen.
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
 * match dann weis man wie lange grob noch").
 *
 * Die Stationen kommen aus dem Modus: im Huetten-Modus endet der Abend mit
 * zwei Endspielen, im Normalfall mit der Entscheidung an der Tabellenspitze
 * (notfalls einem Stechen). Erreicht ist eine Station ueber die PHASE, gefuellt
 * ist die Linie ueber die Zahl der gespielten Partien - beides sagt etwas
 * anderes, und beides zusammen beantwortet die Frage "wie lange noch".
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

function VsZeile({ matchtag, paarung, gross }: { matchtag: MatchtagStand; paarung: Paarung; gross?: boolean }) {
  const gespielt = paarung.siegerId !== null
  return (
    <div className={`mt-vs${gross ? ' mt-vs-gross' : ''}${gespielt ? ' ist-gespielt' : ''}`}>
      <span className={`mt-vs-name${paarung.siegerId === paarung.aId ? ' ist-sieger' : ''}`}>
        {spielerName(matchtag, paarung.aId)}
      </span>
      <span className="mt-vs-mitte">{gespielt ? `${paarung.legsA} : ${paarung.legsB}` : 'vs'}</span>
      <span className={`mt-vs-name${paarung.siegerId === paarung.bId ? ' ist-sieger' : ''}`}>
        {spielerName(matchtag, paarung.bId)}
      </span>
    </div>
  )
}

function FolieJetzt({ matchtag }: { matchtag: MatchtagStand }) {
  const naechste = naechstePaarung(matchtag)
  if (!naechste) return null
  const danach = matchtag.paarungen.filter((p) => p.siegerId === null && p.id !== naechste.id).slice(0, 3)
  const stechen = matchtag.phase === 'stechen'

  return (
    <div className="mt-folie mt-folie-jetzt">
      <span className="mt-eyebrow">{stechen ? 'Stechen um den Sieg' : 'Als Nächstes'}</span>
      <VsZeile matchtag={matchtag} paarung={naechste} gross />
      {danach.length > 0 && (
        <div className="mt-danach">
          <span className="mt-danach-titel">Danach</span>
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
    <div className="mt-folie mt-folie-tabelle">
      <span className="mt-eyebrow">{matchtag.titel || 'Matchtag'} · {beendet ? 'Endstand' : 'Tabelle'}</span>
      <table className="mt-tabelle">
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
          {zeilen.map((z) => (
            <tr
              key={z.spieler.id}
              className={
                beendet
                  ? z.spieler.id === matchtag.siegerId
                    ? 'ist-sieger'
                    : undefined
                  : z.punkte === fuehrend && z.gespielt > 0
                    ? 'ist-fuehrend'
                    : undefined
              }
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
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FolieSpielplan({ matchtag }: { matchtag: MatchtagStand }) {
  const offen = matchtag.paarungen.filter((p) => p.siegerId === null).length
  return (
    <div className="mt-folie mt-folie-spielplan">
      <span className="mt-eyebrow">
        Spielplan · {matchtag.paarungen.length - offen} von {matchtag.paarungen.length} gespielt
      </span>
      <div className="mt-plan">
        {matchtag.paarungen.map((p) => (
          <VsZeile matchtag={matchtag} paarung={p} key={p.id} />
        ))}
      </div>
    </div>
  )
}

function FolieStatistik({ matchtag }: { matchtag: MatchtagStand }) {
  const st = statistiken(matchtag)
  return (
    <div className="mt-folie mt-folie-statistik">
      <span className="mt-eyebrow">Zahlen des Abends</span>
      <div className="mt-kacheln">
        {st.bestesAverage && (
          <div className="mt-kachel">
            <span className="mt-kachel-titel">Bestes Average</span>
            <span className="mt-kachel-wert">{zahl(st.bestesAverage.wert)}</span>
            <span className="mt-kachel-name">{st.bestesAverage.spieler.name}</span>
          </div>
        )}
        {st.meiste180 && (
          <div className="mt-kachel">
            <span className="mt-kachel-titel">Meiste 180er</span>
            <span className="mt-kachel-wert">{st.meiste180.wert}</span>
            <span className="mt-kachel-name">{st.meiste180.spieler.name}</span>
          </div>
        )}
        {st.hoechstesFinish && (
          <div className="mt-kachel">
            <span className="mt-kachel-titel">Höchstes Finish</span>
            <span className="mt-kachel-wert">{st.hoechstesFinish.wert}</span>
            <span className="mt-kachel-name">{st.hoechstesFinish.spieler.name}</span>
          </div>
        )}
        {st.gesamt180 > 0 && (
          <div className="mt-kachel">
            <span className="mt-kachel-titel">180er gesamt</span>
            <span className="mt-kachel-wert">{st.gesamt180}</span>
            <span className="mt-kachel-name">alle zusammen</span>
          </div>
        )}
      </div>
      {st.schnitte.length > 0 && (
        <div className="mt-schnitte">
          <span className="mt-danach-titel">Schnitt über alle Partien</span>
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
    <div className="mt-folie mt-folie-analyse">
      <span className="mt-eyebrow">Spieleranalyse</span>
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
          {bilanzen.map((b) => (
            <tr key={b.spieler.id}>
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
 * Die Heatmap-Folie: jeder Spieler mit seiner Scheibe daneben, darauf alle
 * Pfeile des Abends als Waermebild. Wer keinen gemessenen Wurf hat, faellt
 * weg - eine leere Scheibe sagt nichts.
 */
function FolieHeatmap({ matchtag }: { matchtag: MatchtagStand }) {
  const mitWuerfen = matchtag.spieler.filter((s) => s.wuerfe.length > 0)
  return (
    <div className="mt-folie mt-folie-heatmap">
      <span className="mt-eyebrow">Wo die Pfeile landen</span>
      <div className={`mt-heatmaps mt-heatmaps-${Math.min(mitWuerfen.length, 8)}`}>
        {mitWuerfen.map((spieler) => (
          <div className="mt-heatkarte" key={spieler.id}>
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
    <div className="mt-folie mt-folie-jetzt">
      <span className="mt-eyebrow">{matchtag.titel || 'Matchtag'}</span>
      <p className="mt-riesig">Aufwärmrunde</p>
      <p className="mt-hinweis">Alle Mitspieler in ein Match — danach steht der Spielplan</p>
    </div>
  )
}

function FolieSieger({ matchtag }: { matchtag: MatchtagStand }) {
  const stand = endstand(matchtag)
  const sieger = stand.find((z) => z.spieler.id === matchtag.siegerId) ?? stand[0]
  const name = sieger?.spieler.name ?? spielerName(matchtag, matchtag.siegerId ?? '')
  const bilanz = spielerBilanzen(matchtag).find((b) => b.spieler.id === sieger?.spieler.id)
  const verfolger = stand.filter((z) => z.spieler.id !== sieger?.spieler.id).slice(0, 2)

  return (
    <div className="mt-folie mt-folie-sieger">
      {/* Strahlenkranz und Konfetti sind reine Zier - deshalb aria-hidden und
          deshalb unter dem Text. Beides steht still, wenn das Betriebssystem
          weniger Bewegung verlangt (siehe prefers-reduced-motion in App.css). */}
      <div className="mt-strahlen" aria-hidden="true" />
      <div className="mt-konfetti" aria-hidden="true">
        {Array.from({ length: 24 }, (_, i) => (
          <span className={`mt-schnipsel mt-schnipsel-${i % 4}`} key={i} style={{ left: `${(i * 4.1 + 2) % 100}%`, animationDelay: `${(i % 8) * 260}ms` }} />
        ))}
      </div>

      <span className="mt-eyebrow">{matchtag.titel || 'Matchtag'} entschieden</span>

      {/* Buchstabe fuer Buchstabe: der Name baut sich auf, statt einfach da zu
          sein. Leerzeichen bleiben als geschuetztes Leerzeichen stehen, sonst
          faellt der Abstand zwischen Vor- und Nachnamen weg. */}
      <p className="mt-siegername">
        {[...name].map((zeichen, i) => (
          <span className="mt-siegerzeichen" key={i} style={{ animationDelay: `${300 + i * 55}ms` }}>
            {zeichen === ' ' ? ' ' : zeichen}
          </span>
        ))}
      </p>
      <p className="mt-hinweis mt-siegerzeile">Sieger des Abends</p>

      {bilanz && (
        <div className="mt-siegerwerte">
          <span className="mt-siegerwert">
            <strong>{sieger?.punkte ?? 0}</strong> Punkte
          </span>
          <span className="mt-siegerwert">
            <strong>{sieger?.siege ?? 0}</strong> Siege
          </span>
          <span className="mt-siegerwert">
            <strong>{zahl(bilanz.schnitt)}</strong> Ø
          </span>
          {bilanz.count180 > 0 && (
            <span className="mt-siegerwert">
              <strong>{bilanz.count180}</strong> × 180
            </span>
          )}
          {bilanz.hoechstesFinish !== null && (
            <span className="mt-siegerwert">
              <strong>{bilanz.hoechstesFinish}</strong> Finish
            </span>
          )}
        </div>
      )}

      {verfolger.length > 0 && (
        <div className="mt-podest">
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

/** Wie lange eine Folie steht. Timer und Fortschrittsbalken lesen dieselbe Zahl. */
function standzeitVon(art: string): number {
  if (art === 'jetzt') return TAKT_JETZT_MS
  if (art === 'analyse' || art === 'heatmap' || art === 'sieger') return TAKT_LANG_MS
  return TAKT_MS
}

export function Matchtag({ matchtag }: { matchtag: MatchtagStand }) {
  const folien = folienFuer(matchtag)
  // ?mtfolie=N haelt eine Folie fest - fuer Bildschirmfotos, gleiche Idee
  // wie ?folie=N beim Vorspann.
  const festgehalten = matchtagFolieParam()
  const [index, setIndex] = useState(0)

  // Beginnt der Matchtag eine neue Phase (Aufwaermen -> Spielplan -> ...),
  // aendert sich die Folienliste. Dann von vorn, statt in einem Index zu
  // stehen, den es nicht mehr gibt.
  const schluessel = folien.join('|')
  useEffect(() => setIndex(0), [schluessel])

  // Eine Folie steht ihre Zeit ab und wird dann unmittelbar von der
  // naechsten abgeloest. Kein Ausblenden dazwischen: vorher lag zwischen zwei
  // Folien eine gute Sekunde Schwarz, weil erst ausgeblendet und danach neu
  // eingeblendet wurde.
  useEffect(() => {
    if (festgehalten !== null) return
    if (folien.length <= 1) return
    const weiter = window.setTimeout(
      () => setIndex((i) => (i + 1) % folien.length),
      standzeitVon(folien[index % folien.length] ?? ''),
    )
    return () => window.clearTimeout(weiter)
  }, [index, schluessel, folien, festgehalten])

  if (folien.length === 0) return null
  const art = folien[(festgehalten ?? index) % folien.length]!

  return (
    <div className="bildschirm-matchtag">
      <div className="mt-buehne" key={`${art}-${index}`}>
        {art === 'jetzt' && <FolieJetzt matchtag={matchtag} />}
        {art === 'tabelle' && <FolieTabelle matchtag={matchtag} />}
        {art === 'spielplan' && <FolieSpielplan matchtag={matchtag} />}
        {art === 'statistik' && <FolieStatistik matchtag={matchtag} />}
        {art === 'analyse' && <FolieAnalyse matchtag={matchtag} />}
        {art === 'heatmap' && <FolieHeatmap matchtag={matchtag} />}
        {art === 'aufwaermen' && <FolieAufwaermen matchtag={matchtag} />}
        {art === 'sieger' && <FolieSieger matchtag={matchtag} />}
      </div>

      {/* Kopfzeile ueber jeder Folie: wo der Abend steht (Roadmap) und wer als
          naechstes dran ist. Beides zusammen beantwortet die beiden Fragen,
          die im Raum stehen, ohne dass jemand fragen muss. */}
      <div className="mt-kopf">
        <Roadmap matchtag={matchtag} />
        <span className="mt-status-text">{statusText(matchtag)}</span>
      </div>

      {/* Der Balken unten zeigt, wann umgeblaettert wird. */}
      {festgehalten === null && folien.length > 1 && (
        <Fortschritt dauerMs={standzeitVon(art)} schluessel={`${art}-${index}`} />
      )}

      {/* Dauerhaftes Signal oben rechts, wie im Vorspann: es sagt jedem im
          Raum, dass gerade nicht gespielt wird. */}
      <div className="mt-signal">
        <span className="mt-signal-punkt" />
        Spielpause
      </div>

      <img className="bug" src={logoWeiss} alt="JGNet" />
    </div>
  )
}
