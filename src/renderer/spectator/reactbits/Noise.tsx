// Aus React Bits uebernommen: github.com/DavidHDev/react-bits,
// src/ts-default/Animations/Noise/Noise.tsx,
// Commit 3a1c7f2f9f94ed833934ab5c2635760b9e644583.
// Lizenz: MIT + Commons Clause, siehe LICENSE.md in diesem Ordner.
//
// Angepasst fuer den Pausenscreen (siehe Spec, Abschnitt 7):
//  - Das Original rechnet jedes zweite Bild 1024 x 1024 Zufallswerte auf dem
//    Hauptthread (rund 4 Mio. Werte). Jetzt bestimmt patternSize die Flaeche
//    (Vorgabe 512) und gezeichnet wird jedes 6. Bild; der Bildpuffer wird
//    wiederverwendet statt je Bild neu angelegt.
//  - Weich skaliert statt pixelig - auf 4K saehe ein 512er-Muster sonst wie
//    Kacheln aus.
//  - stillstand: ein einziges Muster (reduzierte Bewegung).
//  - patternScaleX/patternScaleY entfallen (im Original ohne Wirkung).

import { useRef, useEffect, type FC } from 'react';
import './Noise.css';

interface NoiseProps {
  patternSize?: number;
  patternRefreshInterval?: number;
  patternAlpha?: number;
  stillstand?: boolean;
}

const Noise: FC<NoiseProps> = ({
  patternSize = 512,
  patternRefreshInterval = 6,
  patternAlpha = 15,
  stillstand = false
}) => {
  const grainRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = grainRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    canvas.width = patternSize;
    canvas.height = patternSize;
    const imageData = ctx.createImageData(patternSize, patternSize);
    const data = imageData.data;

    const drawGrain = () => {
      for (let i = 0; i < data.length; i += 4) {
        const value = Math.random() * 255;
        data[i] = value;
        data[i + 1] = value;
        data[i + 2] = value;
        data[i + 3] = patternAlpha;
      }
      ctx.putImageData(imageData, 0, 0);
    };

    let frame = 0;
    let animationId = 0;
    const loop = () => {
      if (frame % patternRefreshInterval === 0) {
        drawGrain();
      }
      frame++;
      animationId = window.requestAnimationFrame(loop);
    };

    if (stillstand) drawGrain();
    else loop();

    return () => {
      window.cancelAnimationFrame(animationId);
    };
  }, [patternSize, patternRefreshInterval, patternAlpha, stillstand]);

  return <canvas className="noise-overlay" ref={grainRef} />;
};

export default Noise;
