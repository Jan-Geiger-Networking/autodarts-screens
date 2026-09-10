import { useEffect, useRef, useState } from 'react'
import type { LegEntry, MatchState, Player, PlayerScore, Segment } from '../../shared/typen'
import logoWeiss from '../../../assets/logo-white.png'
import { ermittleBasis, szeneAusZustand, UEBERLAGERUNG_DAUER_MS, type Ueberlagerung } from './szene'
import { useAusblenden } from './useAusblenden'
import { useVorfuehrung, vorfuehrungAktiv, vorfuehrungEingefroren } from './vorfuehrung'
import { averageAnzeige, checkoutQuote, finishAnzeige, initialen } from './formatierung'
import '../shared/tokens.css'
import './App.css'

type BigMoment = Extract<Ueberlagerung, { art: 'bigMoment' }>
type MatchWin = Extract<Ueberlagerung, { art: 'matchWin' }>

// Muss zu den clip-path-Werten von .spielerkarte-links/-rechts in App.css
// passen (Keil-Zuschnitt: 97%/91% der jeweils eigenen Tafelbreite). Die
// Signalkante ist ein einzelnes Element, das genau diese geschertem
// Innenkante nachzeichnet - links oder rechts, je nach activePlayerId.
// Beide Polygone haben dieselbe Punktzahl, damit der Browser beim Wechsel
// zwischen ihnen interpoliert statt hart umzuschalten: das ist die eine
// bewegte Fahrt quer über die Mitte, kein zweites Element, keine Ueberblendung.
const SIGNALKANTE_LINKS = 'polygon(48% 0%, 49% 0%, 46% 100%, 45% 100%)'
const SIGNALKANTE_RECHTS = 'polygon(52% 0%, 51% 0%, 54% 100%, 55% 100%)'

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
  useEffect(() => {
    if (ueberlagerung?.art === 'bigMoment') setLetzterBigMoment(ueberlagerung)
    if (ueberlagerung?.art === 'matchWin') setLetzterMatchWin(ueberlagerung)
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
      {anzeige === 'idle' && (
        <div className="ruhezustand">
          <img className="ruhezustand-logo" src={logoWeiss} alt="JGNet" />
        </div>
      )}

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
        <SpielerRaster
          spieler={players}
          scores={scores}
          activePlayerId={activePlayerId}
          bust={zustand.bust}
          hervorgehobenerGewinner={hervorgehobenerGewinner}
        />
      )}

      {!intro && (
        <Statistikleiste spieler={aktiverSpieler} score={scoreVon(activePlayerId ?? '')} legHistory={zustand.legHistory} activePlayerId={activePlayerId} />
      )}
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

      <Mittelanzeige scoreA={scoreA} scoreB={scoreB} />

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

      {/* Der eine bewusste bewegte Moment im ganzen Screen: zeichnet die
          geschertem Innenkante der aktiven Tafel nach und faehrt bei jedem
          Wechsel per Formuebergang (clip-path) quer ueber die Mitte - ein
          Objekt, kein Ueberblenden. */}
      <div className="signalkante" style={{ clipPath: aktivIndex === 0 ? SIGNALKANTE_LINKS : SIGNALKANTE_RECHTS }} />
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

function Mittelanzeige({ scoreA, scoreB }: { scoreA: PlayerScore | undefined; scoreB: PlayerScore | undefined }) {
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
    </div>
  )
}

function SpielerRaster({
  spieler,
  scores,
  activePlayerId,
  bust,
  hervorgehobenerGewinner,
}: {
  spieler: Player[]
  scores: PlayerScore[]
  activePlayerId: string | null
  bust: boolean
  hervorgehobenerGewinner: string | undefined
}) {
  return (
    <div className="spielraster">
      {spieler.map((p) => {
        const score = scores.find((s) => s.playerId === p.id)
        const aktiv = p.id === activePlayerId
        const klassen = ['rasterkarte', aktiv && 'aktiv', hervorgehobenerGewinner === p.id && 'leg-gewonnen'].filter(Boolean).join(' ')
        return (
          <div key={p.id} className={klassen}>
            <Spielerfoto spieler={p} />
            <span className="spielername">{p.displayName}</span>
            <div className={`rasterkarte-rest${aktiv && bust ? ' bust' : ''}`}>{score?.remaining ?? 0}</div>
            <div className="rasterkarte-legs">
              <span className="statistik-label">Legs</span> {score?.legs ?? 0} <span className="statistik-label">Sätze</span> {score?.sets ?? 0}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Statistikleiste({
  spieler,
  score,
  legHistory,
  activePlayerId,
}: {
  spieler: Player | undefined
  score: PlayerScore | undefined
  legHistory: LegEntry[]
  activePlayerId: string | null
}) {
  if (!spieler || !score) return <div className="statistikleiste" />
  const verlauf = legHistory.filter((e) => e.playerId === activePlayerId)

  return (
    <div className="statistikleiste">
      <div className="statistikleiste-werte">
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
      <div className="statistikleiste-verlauf">
        {verlauf.map((eintrag, i) => (
          <span className="verlauf-eintrag" key={i}>
            {eintrag.scored}
          </span>
        ))}
      </div>
    </div>
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
          <span className="match-win-titel">Sieger</span>
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
