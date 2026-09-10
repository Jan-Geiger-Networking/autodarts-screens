import { useEffect, useRef, useState } from 'react'
import type { LegEntry, MatchState, Player, PlayerScore, Segment } from '../../shared/typen'
import logoWeiss from '../../../assets/logo-white.png'
import { ermittleBasis, szeneAusZustand, UEBERLAGERUNG_DAUER_MS, type Ueberlagerung } from './szene'
import { useAusblenden } from './useAusblenden'
import { useVorfuehrung, vorfuehrungAktiv, vorfuehrungEingefroren } from './vorfuehrung'
import { Vorspann } from './Vorspann'
import { averageAnzeige, checkoutQuote, finishAnzeige, initialen } from './formatierung'
import { Dartscheibe } from './Dartscheibe'
import { legStatistik } from './statistik'
import { spielerAufteilen } from './aufteilung'
import '../shared/tokens.css'
import './App.css'

type BigMoment = Extract<Ueberlagerung, { art: 'bigMoment' }>
type MatchWin = Extract<Ueberlagerung, { art: 'matchWin' }>
type LegWin = Extract<Ueberlagerung, { art: 'legWin' }>

export function App() {
  // Vorfuehrmodus (?vorfuehrung in der Adresse) ersetzt window.app komplett -
  // der Screen laesst sich so ohne Hauptprozess begutachten, siehe
  // vorfuehrung.ts. Ausserhalb des Vorfuehrmodus liefert der Hook null und
  // stoert den echten Betrieb nicht.
  const vorfuehrung = vorfuehrungAktiv()
  const vorfuehrZustand = useVorfuehrung()
  const [echterZustand, setEchterZustand] = useState<MatchState | null>(null)

  useEffect(() => {
    if (vorfuehrung) return
    return window.app.beiZustand(setEchterZustand)
  }, [vorfuehrung])

  const zustand = vorfuehrung ? vorfuehrZustand : echterZustand

  // Ueberlagerungs-Zustandsmaschine: genau eine Ueberlagerung gleichzeitig.
  // Ein neues Ereignis ersetzt eine noch laufende sofort (Abkuerzen statt
  // Warteschlange, siehe Abschnitt 8 der Spec).
  const letzteSeqRef = useRef<number | null>(null)
  const timerRef = useRef<number | undefined>(undefined)
  const [ueberlagerung, setUeberlagerung] = useState<Ueberlagerung | null>(null)

  useEffect(() => {
    if (!zustand) return
    if (letzteSeqRef.current === null) {
      // Erste Momentaufnahme nach dem Oeffnen des Fensters: nicht rueckwirkend
      // ein Ereignis abspielen, das schon vor uns lag.
      letzteSeqRef.current = zustand.lastEvent?.seq ?? -1
      return
    }
    const ergebnis = szeneAusZustand(zustand, letzteSeqRef.current)
    letzteSeqRef.current = ergebnis.verarbeiteteSeq
    if (ergebnis.ueberlagerung) {
      const aktuelle = ergebnis.ueberlagerung
      window.clearTimeout(timerRef.current)
      setUeberlagerung(aktuelle)
      // Im auf einen Schritt eingefrorenen Vorfuehrmodus ist das Anhalten
      // dieses Moments der Zweck (Bildschirmfoto) - nicht automatisch wieder
      // verbergen, siehe vorfuehrungEingefroren().
      if (!vorfuehrungEingefroren()) {
        timerRef.current = window.setTimeout(() => setUeberlagerung(null), UEBERLAGERUNG_DAUER_MS[aktuelle.art])
      }
    }
  }, [zustand])

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  // bigMoment/matchWin brauchen ihre Daten auch waehrend der Ausfahr-Animation
  // noch, wenn `ueberlagerung` selbst schon wieder null ist - deshalb der
  // letzte Wert je Art getrennt gemerkt statt direkt aus `ueberlagerung` gelesen.
  const [letzterBigMoment, setLetzterBigMoment] = useState<BigMoment | null>(null)
  const [letzterMatchWin, setLetzterMatchWin] = useState<MatchWin | null>(null)
  const [letzterLegWin, setLetzterLegWin] = useState<LegWin | null>(null)
  useEffect(() => {
    if (ueberlagerung?.art === 'bigMoment') setLetzterBigMoment(ueberlagerung)
    if (ueberlagerung?.art === 'matchWin') setLetzterMatchWin(ueberlagerung)
    if (ueberlagerung?.art === 'legWin') setLetzterLegWin(ueberlagerung)
  }, [ueberlagerung])

  const basis = zustand ? ermittleBasis(zustand) : 'idle'

  // 'intro' geht nach ca. 8s von selbst in die normale Anzeige ueber (siehe
  // Szenen-Tabelle), unabhaengig davon, wie lange phase im MatchState noch
  // 'intro' bleibt - das Setzen von phase liegt beim Hauptprozess, ausserhalb
  // dieses Arbeitsbereichs.
  const [introAbgelaufen, setIntroAbgelaufen] = useState(false)
  useEffect(() => {
    setIntroAbgelaufen(false)
    if (basis !== 'intro') return
    const timer = window.setTimeout(() => setIntroAbgelaufen(true), 8000)
    return () => window.clearTimeout(timer)
  }, [basis, zustand?.matchId])

  const anzeige = basis === 'idle' ? 'idle' : basis === 'intro' && !introAbgelaufen ? 'intro' : 'scoreboard'

  return (
    <div className="bildschirm-zuschauer">
      {anzeige === 'idle' && <Vorspann />}

      {anzeige !== 'idle' && zustand && (
        <Spielstand
          zustand={zustand}
          intro={anzeige === 'intro'}
          hervorgehobenerGewinner={ueberlagerung?.art === 'legWin' ? ueberlagerung.spielerId : undefined}
        />
      )}

      {zustand && (
        <BigMomentSchicht
          ueberlagerung={letzterBigMoment}
          sichtbar={ueberlagerung?.art === 'bigMoment'}
          zustand={zustand}
        />
      )}

      {zustand && (
        <LegWinSchicht ueberlagerung={letzterLegWin} sichtbar={ueberlagerung?.art === 'legWin'} zustand={zustand} />
      )}

      {zustand && (
        <MatchWinSchicht
          ueberlagerung={letzterMatchWin}
          sichtbar={ueberlagerung?.art === 'matchWin'}
          zustand={zustand}
        />
      )}
    </div>
  )
}

function Spielstand({
  zustand,
  intro,
  hervorgehobenerGewinner,
}: {
  zustand: MatchState
  intro: boolean
  hervorgehobenerGewinner?: string
}) {
  const { players, scores, activePlayerId } = zustand
  const scoreVon = (id: string) => scores.find((s) => s.playerId === id)
  const aktiverSpieler = players.find((p) => p.id === activePlayerId)

  return (
    <div className={`spielstand${intro ? ' spielstand-intro' : ''}`}>
      <img className="bug" src={logoWeiss} alt="JGNet" />

      {players.length === 2 ? (
        <ZweiSpielerReihe
          spielerA={players[0]!}
          spielerB={players[1]!}
          scoreA={scoreVon(players[0]!.id)}
          scoreB={scoreVon(players[1]!.id)}
          activePlayerId={activePlayerId}
          bust={zustand.bust}
          checkout={zustand.checkout}
          currentThrow={zustand.currentThrow}
          currentThrowTotal={zustand.currentThrowTotal}
          hervorgehobenerGewinner={hervorgehobenerGewinner}
        />
      ) : (
        <SpielerSpalten
          spieler={players}
          scores={scores}
          activePlayerId={activePlayerId}
          bust={zustand.bust}
          hervorgehobenerGewinner={hervorgehobenerGewinner}
          darts={zustand.currentThrow}
        />
      )}

      {!intro && <Statistikleiste zustand={zustand} />}
    </div>
  )
}

function ZweiSpielerReihe({
  spielerA,
  spielerB,
  scoreA,
  scoreB,
  activePlayerId,
  bust,
  checkout,
  currentThrow,
  currentThrowTotal,
  hervorgehobenerGewinner,
}: {
  spielerA: Player
  spielerB: Player
  scoreA: PlayerScore | undefined
  scoreB: PlayerScore | undefined
  activePlayerId: string | null
  bust: boolean
  checkout: string[] | null
  currentThrow: Segment[]
  currentThrowTotal: number
  hervorgehobenerGewinner: string | undefined
}) {
  const aktivIndex = activePlayerId === spielerB.id ? 1 : 0

  return (
    <div className="spielreihe">
      <Spielerkarte
        seite="links"
        spieler={spielerA}
        score={scoreA}
        aktiv={activePlayerId === spielerA.id}
        bust={activePlayerId === spielerA.id && bust}
        checkoutWeg={activePlayerId === spielerA.id ? checkout : null}
        gewonnenesLeg={hervorgehobenerGewinner === spielerA.id}
        currentThrow={activePlayerId === spielerA.id ? currentThrow : []}
        currentThrowTotal={activePlayerId === spielerA.id ? currentThrowTotal : 0}
      />

      <Mittelanzeige scoreA={scoreA} scoreB={scoreB} darts={currentThrow} />

      <Spielerkarte
        seite="rechts"
        spieler={spielerB}
        score={scoreB}
        aktiv={activePlayerId === spielerB.id}
        bust={activePlayerId === spielerB.id && bust}
        checkoutWeg={activePlayerId === spielerB.id ? checkout : null}
        gewonnenesLeg={hervorgehobenerGewinner === spielerB.id}
        currentThrow={activePlayerId === spielerB.id ? currentThrow : []}
        currentThrowTotal={activePlayerId === spielerB.id ? currentThrowTotal : 0}
      />

      {/* Der eine bewusste bewegte Moment im ganzen Screen: ein gerader
          Balken an der Innenkante der aktiven Tafel, der bei jedem Wechsel
          per CSS-Transition (left) quer ueber die Fuge wandert - ein
          Objekt, kein Ueberblenden. Die Positionen selbst stehen in
          .signalkante-links/-rechts in App.css. */}
      <div className={`signalkante ${aktivIndex === 0 ? 'signalkante-links' : 'signalkante-rechts'}`} />
    </div>
  )
}

type SpielerkarteProps = {
  seite: 'links' | 'rechts'
  spieler: Player
  score: PlayerScore | undefined
  aktiv: boolean
  bust: boolean
  checkoutWeg: string[] | null
  gewonnenesLeg: boolean
  currentThrow: Segment[]
  currentThrowTotal: number
}

function Spielerkarte({ seite, spieler, score, aktiv, bust, checkoutWeg, gewonnenesLeg, currentThrow, currentThrowTotal }: SpielerkarteProps) {
  const rest = score?.remaining ?? 0
  const klassen = ['spielerkarte', `spielerkarte-${seite}`, aktiv && 'aktiv', gewonnenesLeg && 'leg-gewonnen'].filter(Boolean).join(' ')
  // Immer drei Steckplaetze zeigen, auch wenn der jeweilige Aufnahmezug
  // weniger Darts hatte (z.B. ein Finish mit nur einem Dart) - so ist auf
  // den ersten Blick klar, dass hier grundsaetzlich zu dritt geworfen wird.
  const wurfSlots = [0, 1, 2].map((i) => currentThrow[i]?.name ?? null)

  return (
    <div className={klassen}>
      <div className="spielerkarte-kopf">
        <Spielerfoto spieler={spieler} />
        <div className="spielerkarte-namensblock">
          <span className="spielername">{spieler.displayName}</span>
          {spieler.country && <span className="spielerland">{spieler.country}</span>}
        </div>
      </div>

      <div className="spielerkarte-rest-bereich">
        <div className={`spielerkarte-rest${bust ? ' bust' : ''}`}>{rest}</div>
      </div>

      <div className="spielerkarte-fuss">
        {/* Gruen faerbt hier ausschliesslich den Checkout-Weg ein, sonst
            nichts - die Rest-Punktzahl oben bleibt immer --jg-text/--jg-warning. */}
        {checkoutWeg && <div className="spielerkarte-checkout">{checkoutWeg.join(' · ')}</div>}
        {currentThrow.length > 0 && (
          <div className="spielerkarte-wurf">
            <div className="wurf-darts">
              {wurfSlots.map((name, i) => (
                <span className={`wurf-dart${name ? '' : ' leer'}`} key={i}>
                  {name ?? '–'}
                </span>
              ))}
            </div>
            <span className="wurf-gleich">=</span>
            <span className="wurf-summe">{currentThrowTotal}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function Spielerfoto({ spieler }: { spieler: Player }) {
  const quelle = spieler.photoPath ?? spieler.avatarUrl
  if (quelle) return <img className="spielerfoto" src={quelle} alt="" />
  return <div className="spielerfoto spielerfoto-initialen">{initialen(spieler.displayName)}</div>
}

function Mittelanzeige({
  scoreA,
  scoreB,
  darts,
}: {
  scoreA: PlayerScore | undefined
  scoreB: PlayerScore | undefined
  darts: Segment[]
}) {
  return (
    <div className="mittelanzeige">
      <div className="mittelanzeige-sets">
        {scoreA?.sets ?? 0}
        <span className="mittelanzeige-trenner">–</span>
        {scoreB?.sets ?? 0}
      </div>
      <div className="mittelanzeige-legs">
        {scoreA?.legs ?? 0}
        <span className="mittelanzeige-trenner">–</span>
        {scoreB?.legs ?? 0}
      </div>
      {/* Zeigt den laufenden Wurf dort, wo er auf der Scheibe gelandet ist -
          die Frage "wo ging der Wurf hin" beantwortet keine Zahlenreihe. */}
      <Dartscheibe darts={darts} />
    </div>
  )
}

function SpielerSpalten({
  spieler,
  scores,
  activePlayerId,
  bust,
  hervorgehobenerGewinner,
  darts,
}: {
  spieler: Player[]
  scores: PlayerScore[]
  activePlayerId: string | null
  bust: boolean
  hervorgehobenerGewinner: string | undefined
  darts: Segment[]
}) {
  const { links, rechts } = spielerAufteilen(spieler)

  const spalte = (liste: Player[], seite: 'links' | 'rechts') => (
    <div className={`spielspalte spielspalte-${seite}`}>
      {liste.map((p) => {
        const score = scores.find((s) => s.playerId === p.id)
        const aktiv = p.id === activePlayerId
        const klassen = ['rasterkarte', aktiv && 'aktiv', hervorgehobenerGewinner === p.id && 'leg-gewonnen']
          .filter(Boolean)
          .join(' ')
        return (
          <div key={p.id} className={klassen}>
            <Spielerfoto spieler={p} />
            <span className="spielername">{p.displayName}</span>
            <div className={`rasterkarte-rest${aktiv && bust ? ' bust' : ''}`}>{score?.remaining ?? 0}</div>
            <div className="rasterkarte-legs">
              <span className="statistik-label">Legs</span> {score?.legs ?? 0} <span className="statistik-label">Sätze</span>{' '}
              {score?.sets ?? 0}
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="spielspalten">
      {spalte(links, 'links')}
      <div className="spielmitte">
        <Dartscheibe darts={darts} />
      </div>
      {spalte(rechts, 'rechts')}
    </div>
  )
}

function Statistikleiste({ zustand }: { zustand: MatchState }) {
  const { players, scores, activePlayerId, legHistory } = zustand
  if (players.length === 0) return <div className="statistikleiste" />

  // Beide Spieler nebeneinander statt nur des aktiven: waehrend eines Wurfes
  // will man vergleichen koennen, ohne auf den Spielerwechsel zu warten
  // (Wunsch des Herausgebers: "mehr statistiken damit man daten zum angucken
  // hat"). Der aktive Spieler ist hervorgehoben, damit die Zuordnung bleibt.
  return (
    <div className="statistikleiste">
      {players.map((spieler) => {
        const score = scores.find((s) => s.playerId === spieler.id)
        const leg = legStatistik(legHistory, spieler.id)
        const aktiv = spieler.id === activePlayerId
        return (
          <div className={`statistikblock${aktiv ? ' aktiv' : ''}`} key={spieler.id}>
            <span className="statistikblock-name">{spieler.displayName}</span>
            <div className="statistikblock-werte">
              <Wert label="Ø Match" wert={averageAnzeige(score?.average3 ?? null)} />
              <Wert label="Checkout" wert={score ? checkoutQuote(score) : '—'} />
              <Wert label="180er" wert={String(score?.count180 ?? 0)} />
              <Wert label="Höchstes Finish" wert={finishAnzeige(score?.highestFinish ?? null)} />
            </div>
            <div className="statistikblock-werte statistikblock-leg">
              <Wert label="Ø Leg" wert={leg.schnitt === null ? '—' : leg.schnitt.toFixed(1)} />
              <Wert label="Darts" wert={String(leg.darts)} />
              <Wert label="Beste" wert={leg.beste === null ? '—' : String(leg.beste)} />
              <Wert label="100+" wert={String(leg.ueber100)} />
              <Wert label="140+" wert={String(leg.ueber140)} />
            </div>
          </div>
        )
      })}

      <div className="statistikleiste-verlauf">
        {legHistory
          .filter((e) => e.playerId === activePlayerId)
          .map((eintrag, i) => (
            <span className={`verlauf-eintrag${eintrag.bust ? ' verlauf-bust' : ''}`} key={i}>
              {eintrag.bust ? 'Bust' : eintrag.scored}
            </span>
          ))}
      </div>
    </div>
  )
}

function Wert({ label, wert }: { label: string; wert: string }) {
  return (
    <span className="wert">
      <span className="statistik-label">{label}</span>
      <span className="wert-zahl">{wert}</span>
    </span>
  )
}

function findeAbschlussWurf(zustand: MatchState, ueberlagerung: BigMoment): LegEntry | undefined {
  const treffer =
    ueberlagerung.anlass === 'oneEighty'
      ? (e: LegEntry) => e.playerId === ueberlagerung.spielerId && e.scored === 180
      : (e: LegEntry) => e.playerId === ueberlagerung.spielerId && e.remainingAfter === 0
  // Von hinten suchen: das jeweils juengste passende Ereignis im Verlauf.
  for (let i = zustand.legHistory.length - 1; i >= 0; i--) {
    const eintrag = zustand.legHistory[i]
    if (eintrag && treffer(eintrag)) return eintrag
  }
  return undefined
}

function BigMomentSchicht({ ueberlagerung, sichtbar, zustand }: { ueberlagerung: BigMoment | null; sichtbar: boolean; zustand: MatchState }) {
  const imBaum = useAusblenden(sichtbar, 500)
  if (!imBaum || !ueberlagerung) return null

  const spieler = zustand.players.find((p) => p.id === ueberlagerung.spielerId)
  const eintrag = findeAbschlussWurf(zustand, ueberlagerung)
  const zahl = ueberlagerung.anlass === 'oneEighty' ? '180' : finishAnzeige(eintrag?.scored ?? null)

  return (
    <div className={`vollbild big-moment big-moment-${ueberlagerung.anlass}${sichtbar ? ' zeigen' : ''}`}>
      <div className="big-moment-zahl">{zahl}</div>
      <div className="big-moment-name">{spieler?.displayName ?? ''}</div>
      {eintrag && eintrag.darts.length > 0 && (
        <div className="big-moment-weg">
          {eintrag.darts.map((dart, i) => (
            <span className="big-moment-dart" key={i}>
              {dart.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Leg-Gewinn: ausdruecklich benannt ("XXX hat das Leg gewonnen") statt nur
 * die Tafel des Gewinners hervorzuheben. Zeigt zusaetzlich den neuen
 * Leg-Stand und, wenn das Leg auf ein Doppel endete, den Finish-Weg - das
 * ist der Moment, den man im Fernsehen wiederholt sieht.
 */
function LegWinSchicht({ ueberlagerung, sichtbar, zustand }: { ueberlagerung: LegWin | null; sichtbar: boolean; zustand: MatchState }) {
  const imBaum = useAusblenden(sichtbar, 500)
  if (!imBaum || !ueberlagerung) return null

  const gewinner = zustand.players.find((p) => p.id === ueberlagerung.spielerId)
  if (!gewinner) return null

  // Letzte Aufnahme des Gewinners im gerade beendeten Leg: der Finish-Wurf.
  const finish = [...zustand.legHistory].reverse().find((e) => e.playerId === gewinner.id && e.remainingAfter === 0)

  return (
    <div className={`vollbild leg-win${sichtbar ? ' zeigen' : ''}`}>
      <div className="leg-win-balken">
        <span className="leg-win-name">{gewinner.displayName}</span>
        <span className="leg-win-text">hat das Leg gewonnen</span>
      </div>
      {finish && finish.darts.length > 0 && (
        <div className="leg-win-finish">
          <span className="statistik-label">Finish {finish.scored}</span>
          {finish.darts.map((dart, i) => (
            <span className="leg-win-dart" key={i} style={{ animationDelay: `${450 + i * 130}ms` }}>
              {dart.name}
            </span>
          ))}
        </div>
      )}
      <div className="leg-win-stand">
        {zustand.players.map((p, i) => (
          <span key={p.id}>
            {i > 0 && <span className="leg-win-trenner">–</span>}
            <span className={p.id === gewinner.id ? 'leg-win-zahl hervor' : 'leg-win-zahl'}>
              {zustand.scores.find((sc) => sc.playerId === p.id)?.legs ?? 0}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

function MatchWinSchicht({ ueberlagerung, sichtbar, zustand }: { ueberlagerung: MatchWin | null; sichtbar: boolean; zustand: MatchState }) {
  const imBaum = useAusblenden(sichtbar, 600)
  if (!imBaum || !ueberlagerung) return null

  const gewinner = zustand.players.find((p) => p.id === ueberlagerung.spielerId)

  return (
    <div className={`vollbild match-win${sichtbar ? ' zeigen' : ''}`}>
      {gewinner && (
        <div className="match-win-gewinner">
          <Spielerfoto spieler={gewinner} />
          <span className="match-win-name">{gewinner.displayName}</span>
          <span className="match-win-titel">hat das Match gewonnen</span>
        </div>
      )}
      <div className="match-win-statistik">
        {zustand.players.map((p) => {
          const score = zustand.scores.find((s) => s.playerId === p.id)
          if (!score) return null
          return (
            <div className="match-win-zeile" key={p.id}>
              <span className="match-win-zeile-name">{p.displayName}</span>
              <span>
                <span className="statistik-label">Ø</span> {averageAnzeige(score.average3)}
              </span>
              <span>
                <span className="statistik-label">CO</span> {checkoutQuote(score)}
              </span>
              <span>
                <span className="statistik-label">180er</span> {score.count180}
              </span>
              <span>
                <span className="statistik-label">HF</span> {finishAnzeige(score.highestFinish)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
