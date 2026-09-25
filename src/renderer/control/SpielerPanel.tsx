// Spieler-Verwaltung im Control-Fenster. Die Liste fuellt sich von selbst:
// jeder Spieler, der in einem Match auftaucht, wird gemerkt (siehe
// src/main/spielerDienst.ts). Hier bekommt er sein Profilbild.
//
// Ein ausgesuchtes Bild wird nicht blind uebernommen: der Nutzer schiebt es
// im runden Ausschnitt zurecht und zoomt, erst dann entsteht daraus ein
// quadratisches 256er-JPEG. Alles im Browser per Canvas, ohne Bibliothek.

import { useEffect, useRef, useState, type PointerEvent } from 'react'
import type { SpielerProfil } from '../../main/spielerDienst'

/** Kantenlaenge des Ausschnitts auf dem Bildschirm und des gespeicherten Bildes. */
const ANSICHT = 280
const AUSGABE = 256

type Lage = { zoom: number; x: number; y: number }

/**
 * Haelt das Bild so, dass der Ausschnitt immer ganz bedeckt ist. x/y sind
 * die Verschiebung der Bildmitte gegen die Ausschnittmitte in Pixeln der
 * Ansicht.
 */
function begrenzt(bild: HTMLImageElement, lage: Lage): Lage {
  const massstab = Math.max(ANSICHT / bild.naturalWidth, ANSICHT / bild.naturalHeight) * lage.zoom
  const spielX = Math.max(0, (bild.naturalWidth * massstab - ANSICHT) / 2)
  const spielY = Math.max(0, (bild.naturalHeight * massstab - ANSICHT) / 2)
  return {
    zoom: lage.zoom,
    x: Math.min(spielX, Math.max(-spielX, lage.x)),
    y: Math.min(spielY, Math.max(-spielY, lage.y)),
  }
}

function zeichnen(ziel: HTMLCanvasElement, bild: HTMLImageElement, lage: Lage, kante: number): void {
  const ctx = ziel.getContext('2d')
  if (!ctx) return
  const faktor = kante / ANSICHT
  const massstab = Math.max(ANSICHT / bild.naturalWidth, ANSICHT / bild.naturalHeight) * lage.zoom * faktor
  const breite = bild.naturalWidth * massstab
  const hoehe = bild.naturalHeight * massstab
  ctx.fillStyle = '#0f1a2e'
  ctx.fillRect(0, 0, kante, kante)
  ctx.drawImage(bild, (kante - breite) / 2 + lage.x * faktor, (kante - hoehe) / 2 + lage.y * faktor, breite, hoehe)
}

function Zuschnitt({
  datei,
  abbrechen,
  fertig,
}: {
  datei: File
  abbrechen: () => void
  fertig: (foto: string) => void
}) {
  const leinwand = useRef<HTMLCanvasElement>(null)
  const [bild, setBild] = useState<HTMLImageElement | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [lage, setLage] = useState<Lage>({ zoom: 1, x: 0, y: 0 })
  const ziehen = useRef<{ x: number; y: number; lage: Lage } | null>(null)

  useEffect(() => {
    const adresse = URL.createObjectURL(datei)
    const neu = new Image()
    neu.onload = () => setBild(neu)
    neu.onerror = () => setFehler('Das Bild lässt sich nicht öffnen.')
    neu.src = adresse
    return () => URL.revokeObjectURL(adresse)
  }, [datei])

  useEffect(() => {
    if (bild && leinwand.current) zeichnen(leinwand.current, bild, lage, ANSICHT)
  }, [bild, lage])

  function lageSetzen(neu: Lage): void {
    if (bild) setLage(begrenzt(bild, neu))
  }

  function runter(e: PointerEvent<HTMLCanvasElement>): void {
    e.currentTarget.setPointerCapture(e.pointerId)
    ziehen.current = { x: e.clientX, y: e.clientY, lage }
  }

  function bewegen(e: PointerEvent<HTMLCanvasElement>): void {
    const start = ziehen.current
    if (!start) return
    lageSetzen({ ...start.lage, x: start.lage.x + e.clientX - start.x, y: start.lage.y + e.clientY - start.y })
  }

  function speichern(): void {
    if (!bild) return
    const ausgabe = document.createElement('canvas')
    ausgabe.width = AUSGABE
    ausgabe.height = AUSGABE
    zeichnen(ausgabe, bild, lage, AUSGABE)
    fertig(ausgabe.toDataURL('image/jpeg', 0.85))
  }

  return (
    <div className="zuschnitt" role="dialog" aria-modal="true" aria-label="Profilbild zuschneiden">
      <div className="zuschnitt-kasten">
        <p className="hinweis">Bild mit der Maus verschieben, mit dem Regler oder dem Mausrad zoomen.</p>
        {fehler ? (
          <p className="hinweis">{fehler}</p>
        ) : (
          <div className="zuschnitt-ansicht" style={{ width: ANSICHT, height: ANSICHT }}>
            <canvas
              ref={leinwand}
              width={ANSICHT}
              height={ANSICHT}
              onPointerDown={runter}
              onPointerMove={bewegen}
              onPointerUp={() => (ziehen.current = null)}
              onWheel={(e) => lageSetzen({ ...lage, zoom: Math.min(4, Math.max(1, lage.zoom - e.deltaY * 0.002)) })}
            />
            {/* Der runde Rahmen zeigt, was auf den Screens zu sehen ist. */}
            <span className="zuschnitt-kreis" aria-hidden="true" />
          </div>
        )}
        <label className="feld">
          Zoom
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={lage.zoom}
            disabled={!bild}
            onChange={(e) => lageSetzen({ ...lage, zoom: Number(e.target.value) })}
          />
        </label>
        <div className="knopfreihe">
          <button type="button" onClick={speichern} disabled={!bild}>
            Übernehmen
          </button>
          <button type="button" onClick={abbrechen}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  )
}

export function SpielerPanel() {
  const [liste, setListe] = useState<SpielerProfil[] | null>(null)
  const [auswahl, setAuswahl] = useState<{ name: string; datei: File } | null>(null)
  const [meldung, setMeldung] = useState<string | null>(null)

  useEffect(() => {
    void window.app.spielerLesen().then(setListe)
    return window.app.beiSpieler(setListe)
  }, [])

  async function fotoSetzen(name: string, foto: string | null): Promise<void> {
    setMeldung(null)
    try {
      setListe(await window.app.spielerFotoSetzen(name, foto))
    } catch {
      setMeldung('Das Bild konnte nicht gespeichert werden.')
    }
  }

  if (!liste) return <p className="hinweis">Wird geladen …</p>

  return (
    <>
      <p className="hinweis">
        Jeder Spieler aus einem Autodarts-Match landet hier von selbst. Das Profilbild erscheint auf dem Player- und
        dem Zuschauer-Screen. Alles bleibt auf diesem Rechner.
      </p>
      {liste.length === 0 && <p className="hinweis">Noch keine Spieler — nach dem ersten Match stehen sie hier.</p>}
      <ul className="spielerliste">
        {liste.map((p) => (
          <li className="spielerzeile" key={p.name}>
            {p.foto ? (
              <img className="spielerzeile-bild" src={p.foto} alt="" />
            ) : (
              <span className="spielerzeile-bild spielerzeile-leer" aria-hidden="true" />
            )}
            <span className="spielerzeile-name">{p.name}</span>
            <label className="knopf-datei">
              Bild wählen
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const datei = e.target.files?.[0]
                  e.target.value = ''
                  if (datei) setAuswahl({ name: p.name, datei })
                }}
              />
            </label>
            {p.foto && (
              <button type="button" onClick={() => void fotoSetzen(p.name, null)}>
                Bild entfernen
              </button>
            )}
            <button type="button" onClick={() => void window.app.spielerEntfernen(p.name).then(setListe)}>
              Spieler löschen
            </button>
          </li>
        ))}
      </ul>
      {meldung && <p className="hinweis">{meldung}</p>}
      {auswahl && (
        <Zuschnitt
          datei={auswahl.datei}
          abbrechen={() => setAuswahl(null)}
          fertig={(foto) => {
            void fotoSetzen(auswahl.name, foto)
            setAuswahl(null)
          }}
        />
      )}
    </>
  )
}
