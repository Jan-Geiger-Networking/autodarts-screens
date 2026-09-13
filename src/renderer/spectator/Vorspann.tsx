// Vorspann im Kino-Stil: laeuft, solange kein Match aktiv ist (Basis-Szene
// 'idle' aus szene.ts) und kein Matchtag laeuft, und wiederholt sich endlos.
//
// Gestaltung: docs/superpowers/specs/2026-09-13-pausenscreen-kino-design.md,
// Abschnitt 5. Foto-Folien fahren langsam heran, die uebrigen stehen auf dem
// Verlauf der Buehne; die Schrift taucht aus der Unschaerfe auf, sobald die
// neue Folie halb eingeblendet ist. Wortlaut, Reihenfolge und Standzeiten
// stehen in vorspannFolien.ts.

import { useEffect, useState } from 'react'
import patchpanel from '../../../assets/vorspann-patchpanel.jpg'
import server from '../../../assets/vorspann-server.jpg'
import switchFoto from '../../../assets/vorspann-switch.jpg'
import BlurText from './reactbits/BlurText'
import { Fortschritt } from './Fortschritt'
import { KinoBuehne, UEBERBLENDUNG_MS, useVorige } from './KinoBuehne'
import {
  KONTAKT,
  PARTNER,
  VORSPANN_FOLIEN,
  haltenMsVon,
  lageVon,
  type FotoSchluessel,
  type VorspannFolie,
} from './vorspannFolien'
import { vorfuehrungAktiv, vorspannFolieParam } from './vorfuehrung'

/** Bilddatei und Fahrtrichtung je Foto - die Richtung wechselt von Foto zu Foto. */
const FOTOS: Record<FotoSchluessel, { src: string; fahrt: 'links' | 'rechts' }> = {
  patchpanel: { src: patchpanel, fahrt: 'links' },
  switch: { src: switchFoto, fahrt: 'rechts' },
  server: { src: server, fahrt: 'links' },
}

/** Der Text setzt ein, wenn die neue Folie etwa halb eingeblendet ist. */
const TEXT_START_MS = 700

export function Vorspann() {
  // ?vorfuehrung&folie=N haelt den Vorspann auf Folie N fest (gerade Indizes
  // sind Leistungen, ungerade die Zwischenfolie) - siehe vorfuehrung.ts.
  const eingefroreneFolie = vorfuehrungAktiv() ? vorspannFolieParam() : null
  const [aktuell, setAktuell] = useState(() =>
    eingefroreneFolie !== null ? Math.max(0, Math.min(eingefroreneFolie, VORSPANN_FOLIEN.length - 1)) : 0,
  )
  const vorige = useVorige(aktuell)

  useEffect(() => {
    if (eingefroreneFolie !== null) return
    // Selbst nachplanender Timer: Leistungs- und Zwischenfolie stehen
    // unterschiedlich lange.
    const timer = window.setTimeout(
      () => setAktuell((bisher) => (bisher + 1) % VORSPANN_FOLIEN.length),
      haltenMsVon(VORSPANN_FOLIEN[aktuell]!),
    )
    return () => window.clearTimeout(timer)
  }, [eingefroreneFolie, aktuell])

  const folie = VORSPANN_FOLIEN[aktuell]!

  return (
    <KinoBuehne lage={lageVon(folie)}>
      {/* Derselbe Schluessel in beiden Rollen: die alte Folie bleibt dieselbe
          Instanz und blendet nur aus, statt neu aufgebaut zu werden. */}
      {vorige !== null && (
        <FolieAnzeige key={`folie-${vorige}`} folie={VORSPANN_FOLIEN[vorige]!} rolle="verlassend" />
      )}
      <FolieAnzeige key={`folie-${aktuell}`} folie={folie} rolle="ankommend" />

      <Fortschritt dauerMs={haltenMsVon(folie)} schluessel={`folie-${aktuell}`} />

      <div className="kino-fuss">
        <div className="kino-partner">
          {PARTNER.map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
        <div className="kino-kontakt">{KONTAKT}</div>
      </div>
    </KinoBuehne>
  )
}

function FolieAnzeige({ folie, rolle }: { folie: VorspannFolie; rolle: 'ankommend' | 'verlassend' }) {
  const klasse = `kino-folie kino-folie--${rolle}`

  if (folie.art === 'signal') {
    return (
      <div className={klasse}>
        <div className="kino-signal">
          <BlurText
            text="Gleich geht's weiter"
            className="kino-signal-text"
            startVerzoegerungMs={TEXT_START_MS}
            delay={140}
            direction="bottom"
          />
        </div>
      </div>
    )
  }

  const foto = folie.foto ? FOTOS[folie.foto] : null

  return (
    <div className={klasse}>
      {foto && (
        <>
          <img
            className={`kino-foto kino-foto--${foto.fahrt}`}
            src={foto.src}
            alt=""
            style={{ animationDuration: `${haltenMsVon(folie) + UEBERBLENDUNG_MS}ms` }}
          />
          <div className="kino-foto-schleier" />
        </>
      )}
      <div className="kino-text">
        <span className="kino-strich" />
        <div className={`kino-wort kino-wort--${folie.groesse}`}>
          {folie.zeilen.map((zeile, i) => (
            <BlurText
              key={zeile}
              text={zeile}
              startVerzoegerungMs={TEXT_START_MS + i * 250}
              delay={120}
              direction="bottom"
            />
          ))}
        </div>
        {folie.unterzeile && (
          <BlurText
            text={folie.unterzeile}
            className="kino-unterzeile"
            startVerzoegerungMs={TEXT_START_MS + folie.zeilen.length * 250 + 200}
            delay={40}
            direction="bottom"
          />
        )}
      </div>
    </div>
  )
}
