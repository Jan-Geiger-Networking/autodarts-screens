# Pausenscreen im Kino-Stil Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vorspann und Matchtag-Folien des Zuschauer-Screens im Kino-Stil neu gestalten, mit React-Bits-Komponenten (Grainient, BlurText, CountUp, Noise).

**Architecture:** Eine gemeinsame `KinoBuehne` trägt beide Pausenbildschirme: WebGL-Verlauf mit CSS-Ersatz, Vignette, Logo und „Spielpause“. Die React-Bits-Komponenten liegen als angepasster Quelltext in `src/renderer/spectator/reactbits/`. Die Logik (welche Folie wann, Tabelle, Statistik) bleibt unangetastet, neu ist nur die Darstellung. Das Pausenscreen-CSS wandert aus `App.css` in eine eigene `kino.css`.

**Tech Stack:** Electron 44, React 19, TypeScript 7 (strict, `noUncheckedIndexedAccess`), Vite 7, Vitest 5, neu `motion` ^13.2.0 und `ogl` ^1.0.11.

**Spec:** `docs/superpowers/specs/2026-09-13-pausenscreen-kino-design.md`

## Global Constraints

- **Wortlaut des Vorspanns bleibt wörtlich.** Die 8 Leistungen, jeweils Zeilen und Unterzeile:
  - Netzwerk / infrastruktur
  - Glasfaser (Internetanbindung)
  - Video / überwachung
  - Hosting (Betrieb auf eigener Infrastruktur in deutschen Rechenzentren)
  - Monitoring (Cloudflare Zero Trust · SSH Bastion)
  - Backup
  - Support und / Störungsannahme
  - Windows- / Lizenzen

  Ebenfalls wörtlich:
  - Partner: `Cisco, Juniper, TP-Link, Ubiquiti, Backblaze`
  - Kontakt: `jgnet.eu · hey@bsbnet.eu · +49 5222 9179070`
  - Zwischenfolie: `Gleich geht's weiter`
- **Standzeiten:**
  - Vorspann: 6500 ms je Leistung, 2400 ms je Zwischenfolie.
  - Matchtag: 15000 ms, bei `jetzt`, `analyse`, `heatmap` und `sieger` 20000 ms.
- **Überblendung** zwischen Folien: 1500 ms.
- **Farben:** Grün (`--jg-accent`) nur als Signal, Weiß (`--jg-text`) für Inhalte, Grau (`--jg-muted*`) für Nebensachen. Kein Amber und kein Rot im Pausenscreen.
- **Einheiten:** nur vh/vw. Keine px-Größen außer 1-px-Linien.
- **React Bits:** fester Stand `3a1c7f2f9f94ed833934ab5c2635760b9e644583`, TS-CSS-Varianten. Jede übernommene Datei beginnt mit einem Herkunftskopf: Quelle, Commit, Lizenz MIT + Commons Clause.
- **WebGL:**
  - Pixeldichte höchstens `0.5`.
  - Beim Aushängen wird der Kontext freigegeben.
  - Ohne WebGL 2 steht ein CSS-Verlauf.
- **Reduzierte Bewegung:**
  - Grainient und Noise stehen still, BlurText blendet ohne Unschärfe ein, CountUp zeigt sofort den Endwert.
  - Fotos fahren nicht, die Überblendung (nur Deckkraft) bleibt.
- **Nicht anfassen:**
  - Szenen und Anzeigen: Live-Match, Start, Anfangsermittlung, Intro, Einblendungen und die Statistikleiste.
  - Dateien: `szene.ts`, `matchtagFolien.ts` und `src/shared/matchtag.ts`.
- **Code-Kommentare** auf Deutsch ohne Umlaute (ae/oe/ue/ss), wie im übrigen Code. Sichtbare Texte mit Umlauten.
- **Commits** auf Deutsch, Präfix `feat:`/`fix:`/`docs:`, am Ende die zwei Zeilen:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01RTjz7GMwcw3FxwhhSJb8ea
  ```
- **Abschluss jeder Aufgabe:**
  - `npm run typecheck` ohne Fehler.
  - `npx vitest run` grün. Vor dem Plan waren es 378 Tests, nach Aufgabe 2 sind es 384.

## Dateiübersicht

| Datei | Verantwortung |
|---|---|
| `src/renderer/spectator/reactbits/LICENSE.md` | Lizenztext React Bits (MIT + Commons Clause) |
| `src/renderer/spectator/reactbits/Grainient.tsx` + `.css` | WebGL-Verlauf mit Korn: gedeckelt, gleitend, gibt den Kontext frei |
| `src/renderer/spectator/reactbits/BlurText.tsx` | Text taucht aus der Unschärfe auf, mit Startverzögerung |
| `src/renderer/spectator/reactbits/CountUp.tsx` | Zahl zählt hoch, mit fester Nachkommazahl |
| `src/renderer/spectator/reactbits/Noise.tsx` + `.css` | Filmkorn über Fotos, sparsam |
| `src/renderer/spectator/KinoBuehne.tsx` | Bühne, WebGL-Prüfung, Überblend-Hook `useVorige` |
| `src/renderer/spectator/kino.css` | gesamtes Pausenscreen-CSS inkl. Fortschrittslinie |
| `src/renderer/spectator/vorspannFolien.ts` (+ `.test.ts`) | Folienliste des Vorspanns ohne Bild-Importe |
| `src/renderer/spectator/Vorspann.tsx` | Darstellung Vorspann |
| `src/renderer/spectator/Matchtag.tsx` | Darstellung Matchtag |
| `src/renderer/spectator/vorfuehrung.ts` | neue Parameter `ohnewebgl`, `mtaufwaermen` |
| `src/renderer/spectator/App.css` | alte Abschnitte für Vorspann, Matchtag und Fortschritt entfernt |
| `package.json`, `package-lock.json` | `motion`, `ogl` |
| `THIRD-PARTY-LICENSES.md`, `docs/ENTSCHEIDUNGEN.md`, `CHANGELOG.md` | Doku |

## Prüfumgebung (für die Sichtprüfungen in Aufgabe 2–4)

Vite ohne Electron starten (Bash, im Hintergrund):

```bash
cd F:/DEV/autodarts-screens && npx vite src/renderer --port 5260 --strictPort
```

Seite: `http://localhost:5260/spectator/index.html`.

Screenshots entstehen per Playwright-MCP (`mcp__plugin_playwright_playwright__browser_run_code_unsafe`) und landen in `F:/DEV/autodarts-screens/.superpowers/pruefung/`. Der Ordner `.superpowers/` steht in `.gitignore`.

Nach der Prüfung den Vite-Prozess beenden (PowerShell):

```powershell
$c = Get-NetTCPConnection -LocalPort 5260 -State Listen -ErrorAction SilentlyContinue; if ($c) { Stop-Process -Id $c[0].OwningProcess -Confirm:$false }
```

---

### Task 1: React-Bits-Komponenten und Abhängigkeiten

**Files:**
- Modify: `package.json`, `package-lock.json` (per `npm install`)
- Create: `src/renderer/spectator/reactbits/LICENSE.md`
- Create: `src/renderer/spectator/reactbits/Grainient.tsx`
- Create: `src/renderer/spectator/reactbits/Grainient.css`
- Create: `src/renderer/spectator/reactbits/BlurText.tsx`
- Create: `src/renderer/spectator/reactbits/CountUp.tsx`
- Create: `src/renderer/spectator/reactbits/Noise.tsx`
- Create: `src/renderer/spectator/reactbits/Noise.css`

**Interfaces:**
- Consumes: nichts.
- Produces (jeweils Default-Export):
  - `Grainient(props)`: alle Original-Props, dazu `maxDpr?: number` (Vorgabe 0.5) und `stillstand?: boolean` (Vorgabe false). Genutzt werden `color1/2/3` (Hex-Text), `contrast`, `centerX`, `centerY`, `blendAngle`, `timeSpeed`, `warpSpeed`, `grainAmount` und `grainAnimated`.
  - `BlurText(props)`:
    - Props: `text: string`, `className?`, `animateBy?: 'words' | 'letters'`, `direction?: 'top' | 'bottom'`, `delay?: number` (ms je Segment), neu `startVerzoegerungMs?: number` (Vorgabe 0).
    - Rendert ein `<p>` mit `display:flex; flex-wrap:wrap`.
  - `CountUp(props)`:
    - Props: `to: number`, `from?`, `duration?` (Sekunden), `delay?` (Sekunden), `className?`, neu `nachkommastellen?: number`.
    - Rendert ein `<span>`.
  - `Noise(props)`:
    - Props: `patternSize?` (Vorgabe 512), `patternRefreshInterval?` (Vorgabe 6), `patternAlpha?` (Vorgabe 15), `stillstand?`.
    - Rendert `<canvas class="noise-overlay">`.

- [ ] **Step 1: Abhängigkeiten installieren**

```bash
cd F:/DEV/autodarts-screens && npm install motion@^13.2.0 ogl@^1.0.11
```

Expected: `package.json` enthält unter `dependencies` die Einträge `"motion": "^13.2.0"` und `"ogl": "^1.0.11"`.

- [ ] **Step 2: Lizenzdatei holen (wörtlich, fester Stand)**

```bash
cd F:/DEV/autodarts-screens && mkdir -p src/renderer/spectator/reactbits && curl -s -o src/renderer/spectator/reactbits/LICENSE.md https://raw.githubusercontent.com/DavidHDev/react-bits/3a1c7f2f9f94ed833934ab5c2635760b9e644583/LICENSE.md && head -3 src/renderer/spectator/reactbits/LICENSE.md
```

Expected: Zeile 1 lautet `MIT + Commons Clause License Condition v1.0`, Zeile 3 `Copyright (c) 2026 David Haz`.

- [ ] **Step 3: `Grainient.css` anlegen**

```css
/* Aus React Bits uebernommen: github.com/DavidHDev/react-bits,
   src/ts-default/Backgrounds/Grainient/Grainient.css,
   Commit 3a1c7f2f9f94ed833934ab5c2635760b9e644583.
   Lizenz: MIT + Commons Clause, siehe LICENSE.md in diesem Ordner. */
.grainient-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
```

- [ ] **Step 4: `Grainient.tsx` anlegen**

```tsx
// Aus React Bits uebernommen: github.com/DavidHDev/react-bits,
// src/ts-default/Backgrounds/Grainient/Grainient.tsx,
// Commit 3a1c7f2f9f94ed833934ab5c2635760b9e644583.
// Lizenz: MIT + Commons Clause, siehe LICENSE.md in diesem Ordner.
//
// Angepasst fuer den Pausenscreen (siehe
// docs/superpowers/specs/2026-09-13-pausenscreen-kino-design.md, Abschnitt 7):
//  - maxDpr deckelt die Aufloesung der Zeichenflaeche (Original: bis 2).
//  - stillstand zeichnet ein einzelnes Bild statt einer Schleife.
//  - Lage (centerX/centerY/blendAngle) und Farben gleiten zum neuen Wert,
//    statt zu springen - eine WebGL-Flaeche traegt alle Folien.
//  - Der WebGL-Kontext wird beim Aushaengen freigegeben.
//  - Anpassungen fuer noUncheckedIndexedAccess.

import React, { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Triangle } from 'ogl';
import './Grainient.css';

interface GrainientProps {
  timeSpeed?: number;
  colorBalance?: number;
  warpStrength?: number;
  warpFrequency?: number;
  warpSpeed?: number;
  warpAmplitude?: number;
  blendAngle?: number;
  blendSoftness?: number;
  rotationAmount?: number;
  noiseScale?: number;
  grainAmount?: number;
  grainScale?: number;
  grainAnimated?: boolean;
  contrast?: number;
  gamma?: number;
  saturation?: number;
  centerX?: number;
  centerY?: number;
  zoom?: number;
  color1?: string;
  color2?: string;
  color3?: string;
  lightMode?: boolean;
  className?: string;
  /** Hoechste Pixeldichte der Zeichenflaeche. 0.5 = halbe CSS-Aufloesung. */
  maxDpr?: number;
  /** Nur ein Bild zeichnen, keine Schleife (reduzierte Bewegung). */
  stillstand?: boolean;
}

const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [1, 1, 1];
  return [
    parseInt(result[1] ?? 'ff', 16) / 255,
    parseInt(result[2] ?? 'ff', 16) / 255,
    parseInt(result[3] ?? 'ff', 16) / 255
  ];
};

const vertex = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uTimeSpeed;
uniform float uColorBalance;
uniform float uWarpStrength;
uniform float uWarpFrequency;
uniform float uWarpSpeed;
uniform float uWarpAmplitude;
uniform float uBlendAngle;
uniform float uBlendSoftness;
uniform float uRotationAmount;
uniform float uNoiseScale;
uniform float uGrainAmount;
uniform float uGrainScale;
uniform float uGrainAnimated;
uniform float uContrast;
uniform float uGamma;
uniform float uSaturation;
uniform vec2 uCenterOffset;
uniform float uZoom;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uLightMode;
out vec4 fragColor;
#define S(a,b,t) smoothstep(a,b,t)
mat2 Rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);} 
vec2 hash(vec2 p){p=vec2(dot(p,vec2(2127.1,81.17)),dot(p,vec2(1269.5,283.37)));return fract(sin(p)*43758.5453);} 
float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);float n=mix(mix(dot(-1.0+2.0*hash(i+vec2(0.0,0.0)),f-vec2(0.0,0.0)),dot(-1.0+2.0*hash(i+vec2(1.0,0.0)),f-vec2(1.0,0.0)),u.x),mix(dot(-1.0+2.0*hash(i+vec2(0.0,1.0)),f-vec2(0.0,1.0)),dot(-1.0+2.0*hash(i+vec2(1.0,1.0)),f-vec2(1.0,1.0)),u.x),u.y);return 0.5+0.5*n;}
void mainImage(out vec4 o, vec2 C){
  float t=iTime*uTimeSpeed;
  vec2 uv=C/iResolution.xy;
  float ratio=iResolution.x/iResolution.y;
  vec2 tuv=uv-0.5+uCenterOffset;
  tuv/=max(uZoom,0.001);

  float degree=noise(vec2(t*0.1,tuv.x*tuv.y)*uNoiseScale);
  tuv.y*=1.0/ratio;
  tuv*=Rot(radians((degree-0.5)*uRotationAmount+180.0));
  tuv.y*=ratio;

  float frequency=uWarpFrequency;
  float ws=max(uWarpStrength,0.001);
  float amplitude=uWarpAmplitude/ws;
  float warpTime=t*uWarpSpeed;
  tuv.x+=sin(tuv.y*frequency+warpTime)/amplitude;
  tuv.y+=sin(tuv.x*(frequency*1.5)+warpTime)/(amplitude*0.5);

  vec3 colLav=uColor1;
  vec3 colOrg=uColor2;
  vec3 colDark=uColor3;
  float b=uColorBalance;
  float s=max(uBlendSoftness,0.0);
  mat2 blendRot=Rot(radians(uBlendAngle));
  float blendX=(tuv*blendRot).x;
  float edge0=-0.3-b-s;
  float edge1=0.2-b+s;
  float v0=0.5-b+s;
  float v1=-0.3-b-s;
  vec3 layer1=mix(colDark,colOrg,S(edge0,edge1,blendX));
  vec3 layer2=mix(colOrg,colLav,S(edge0,edge1,blendX));
  vec3 col=mix(layer1,layer2,S(v0,v1,tuv.y));

  vec2 grainUv=uv*max(uGrainScale,0.001);
  if(uGrainAnimated>0.5){grainUv+=vec2(iTime*0.05);} 
  float grain=fract(sin(dot(grainUv,vec2(12.9898,78.233)))*43758.5453);
  col+=(grain-0.5)*uGrainAmount;

  col=(col-0.5)*uContrast+0.5;
  float luma=dot(col,vec3(0.2126,0.7152,0.0722));
  col=mix(vec3(luma),col,uSaturation);
  col=pow(max(col,0.0),vec3(1.0/max(uGamma,0.001)));
  col=clamp(col,0.0,1.0);
  if(uLightMode>0.5){
    float energy=max(max(col.r,col.g),col.b);
    vec3 hue=col/max(energy,0.001);
    float chroma=length(col-vec3(dot(col,vec3(0.333333))));
    float coverage=clamp(0.12+chroma*1.15+energy*0.18,0.0,0.88);
    col=mix(vec3(1.0),clamp(hue*0.58+col*0.18,0.0,1.0),coverage);
  }

  o=vec4(col,1.0);
}
void main(){
  vec4 o=vec4(0.0);
  mainImage(o,gl_FragCoord.xy);
  fragColor=o;
}
`;

/** Werte, die beim Folienwechsel gleiten statt springen. */
type Gleitend = {
  center: Float32Array;
  winkel: number;
  farben: [Float32Array, Float32Array, Float32Array];
};

type GrainientCtx = {
  renderer: InstanceType<typeof Renderer>;
  program: InstanceType<typeof Program>;
  mesh: InstanceType<typeof Mesh>;
  aktuell: Gleitend;
  ziel: Gleitend;
  stillstand: boolean;
  start: () => void;
  stopp: () => void;
};
const ctxMap = new WeakMap<HTMLDivElement, GrainientCtx>();

/** Anteil je Bild, um den Lage und Farben zum Ziel gleiten (bei 60 Bildern/s gut eine Sekunde). */
const GLEITEN = 0.03;

type Uniform = { value: unknown };
const uniform = (program: InstanceType<typeof Program>, name: string): Uniform => {
  const u = (program.uniforms as Record<string, Uniform | undefined>)[name];
  if (!u) throw new Error(`Grainient: Uniform ${name} fehlt`);
  return u;
};

const naeher = (wert: number, ziel: number): number => wert + (ziel - wert) * GLEITEN;

/** Schiebt die aktuellen Werte ein Stueck zum Ziel. Die Arrays sind zugleich die Uniform-Werte. */
const gleiten = (aktuell: Gleitend, ziel: Gleitend) => {
  for (let i = 0; i < 2; i++) aktuell.center[i] = naeher(aktuell.center[i] ?? 0, ziel.center[i] ?? 0);
  aktuell.winkel = naeher(aktuell.winkel, ziel.winkel);
  aktuell.farben.forEach((farbe, f) => {
    const zielFarbe = ziel.farben[f];
    if (!zielFarbe) return;
    for (let k = 0; k < 3; k++) farbe[k] = naeher(farbe[k] ?? 0, zielFarbe[k] ?? 0);
  });
};

/** Uebernimmt das Ziel sofort (Stillstand). */
const springen = (aktuell: Gleitend, ziel: Gleitend) => {
  aktuell.center.set(ziel.center);
  aktuell.winkel = ziel.winkel;
  aktuell.farben.forEach((farbe, f) => {
    const quelle = ziel.farben[f];
    if (quelle) farbe.set(quelle);
  });
};

const Grainient: React.FC<GrainientProps> = ({
  timeSpeed = 0.25,
  colorBalance = 0.0,
  warpStrength = 1.0,
  warpFrequency = 5.0,
  warpSpeed = 2.0,
  warpAmplitude = 50.0,
  blendAngle = 0.0,
  blendSoftness = 0.05,
  rotationAmount = 500.0,
  noiseScale = 2.0,
  grainAmount = 0.1,
  grainScale = 2.0,
  grainAnimated = false,
  contrast = 1.5,
  gamma = 1.0,
  saturation = 1.0,
  centerX = 0.0,
  centerY = 0.0,
  zoom = 0.9,
  color1 = '#FF9FFC',
  color2 = '#5227FF',
  color3 = '#B497CF',
  lightMode = false,
  className = '',
  maxDpr = 0.5,
  stillstand = false
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Effect 1: WebGL-Kontext einmal aufbauen, pausieren ausserhalb des Bildes / bei verborgenem Fenster
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new Renderer({
      webgl: 2,
      alpha: true,
      antialias: false,
      dpr: Math.min(window.devicePixelRatio || 1, maxDpr)
    });

    const gl = renderer.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    container.appendChild(canvas);

    const aktuell: Gleitend = {
      center: new Float32Array([centerX, centerY]),
      winkel: blendAngle,
      farben: [
        new Float32Array(hexToRgb(color1)),
        new Float32Array(hexToRgb(color2)),
        new Float32Array(hexToRgb(color3))
      ]
    };
    const ziel: Gleitend = {
      center: new Float32Array(aktuell.center),
      winkel: aktuell.winkel,
      farben: [
        new Float32Array(aktuell.farben[0]),
        new Float32Array(aktuell.farben[1]),
        new Float32Array(aktuell.farben[2])
      ]
    };

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new Float32Array([1, 1]) },
        uTimeSpeed: { value: timeSpeed },
        uColorBalance: { value: colorBalance },
        uWarpStrength: { value: warpStrength },
        uWarpFrequency: { value: warpFrequency },
        uWarpSpeed: { value: warpSpeed },
        uWarpAmplitude: { value: warpAmplitude },
        uBlendAngle: { value: aktuell.winkel },
        uBlendSoftness: { value: blendSoftness },
        uRotationAmount: { value: rotationAmount },
        uNoiseScale: { value: noiseScale },
        uGrainAmount: { value: grainAmount },
        uGrainScale: { value: grainScale },
        uGrainAnimated: { value: grainAnimated ? 1.0 : 0.0 },
        uContrast: { value: contrast },
        uGamma: { value: gamma },
        uSaturation: { value: saturation },
        uCenterOffset: { value: aktuell.center },
        uZoom: { value: zoom },
        uColor1: { value: aktuell.farben[0] },
        uColor2: { value: aktuell.farben[1] },
        uColor3: { value: aktuell.farben[2] },
        uLightMode: { value: lightMode ? 1.0 : 0.0 }
      }
    });

    const mesh = new Mesh(gl, { geometry, program });

    const setSize = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      renderer.setSize(w, h);
      const res = uniform(program, 'iResolution').value as Float32Array;
      res[0] = gl.drawingBufferWidth;
      res[1] = gl.drawingBufferHeight;
      renderer.render({ scene: mesh });
    };

    let raf = 0;
    let isVisible = true;
    let isPageVisible = !document.hidden;
    const t0 = performance.now();

    const ctx: GrainientCtx = {
      renderer,
      program,
      mesh,
      aktuell,
      ziel,
      stillstand,
      start: () => {},
      stopp: () => {}
    };

    const loop = (t: number) => {
      gleiten(aktuell, ziel);
      uniform(program, 'uBlendAngle').value = aktuell.winkel;
      uniform(program, 'iTime').value = (t - t0) * 0.001;
      renderer.render({ scene: mesh });
      raf = requestAnimationFrame(loop);
    };

    const tryStart = () => {
      if (!ctx.stillstand && isVisible && isPageVisible && raf === 0) raf = requestAnimationFrame(loop);
    };
    const tryStop = () => {
      if (raf !== 0) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    ctx.start = tryStart;
    ctx.stopp = tryStop;
    ctxMap.set(container, ctx);

    const ro = new ResizeObserver(setSize);
    ro.observe(container);
    setSize();

    const io = new IntersectionObserver(
      (eintraege) => {
        const entry = eintraege[0];
        if (!entry) return;
        isVisible = entry.isIntersecting;
        if (isVisible) tryStart();
        else tryStop();
      },
      { threshold: 0 }
    );
    io.observe(container);

    const onVisibility = () => {
      isPageVisible = !document.hidden;
      if (isPageVisible) tryStart();
      else tryStop();
    };
    document.addEventListener('visibilitychange', onVisibility);

    tryStart();

    return () => {
      tryStop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      ctxMap.delete(container);
      try {
        container.removeChild(canvas);
      } catch {
        /* bereits entfernt */
      }
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, []); // Kontext einmal aufbauen

  // Effect 2: Props in Uniforms uebernehmen - Lage und Farben als Ziel, der Rest sofort
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ctx = ctxMap.get(container);
    if (!ctx) return;
    const { program } = ctx;

    uniform(program, 'uTimeSpeed').value = timeSpeed;
    uniform(program, 'uColorBalance').value = colorBalance;
    uniform(program, 'uWarpStrength').value = warpStrength;
    uniform(program, 'uWarpFrequency').value = warpFrequency;
    uniform(program, 'uWarpSpeed').value = warpSpeed;
    uniform(program, 'uWarpAmplitude').value = warpAmplitude;
    uniform(program, 'uBlendSoftness').value = blendSoftness;
    uniform(program, 'uRotationAmount').value = rotationAmount;
    uniform(program, 'uNoiseScale').value = noiseScale;
    uniform(program, 'uGrainAmount').value = grainAmount;
    uniform(program, 'uGrainScale').value = grainScale;
    uniform(program, 'uGrainAnimated').value = grainAnimated ? 1.0 : 0.0;
    uniform(program, 'uContrast').value = contrast;
    uniform(program, 'uGamma').value = gamma;
    uniform(program, 'uSaturation').value = saturation;
    uniform(program, 'uZoom').value = zoom;
    uniform(program, 'uLightMode').value = lightMode ? 1.0 : 0.0;

    ctx.ziel.center.set([centerX, centerY]);
    ctx.ziel.winkel = blendAngle;
    ctx.ziel.farben[0].set(hexToRgb(color1));
    ctx.ziel.farben[1].set(hexToRgb(color2));
    ctx.ziel.farben[2].set(hexToRgb(color3));

    ctx.stillstand = stillstand;
    if (stillstand) {
      ctx.stopp();
      springen(ctx.aktuell, ctx.ziel);
      uniform(program, 'uBlendAngle').value = ctx.aktuell.winkel;
      ctx.renderer.render({ scene: ctx.mesh });
    } else {
      ctx.start();
    }
  }, [
    timeSpeed, colorBalance, warpStrength, warpFrequency, warpSpeed,
    warpAmplitude, blendAngle, blendSoftness, rotationAmount, noiseScale,
    grainAmount, grainScale, grainAnimated, contrast, gamma, saturation,
    centerX, centerY, zoom, color1, color2, color3, lightMode, stillstand
  ]);

  return <div ref={containerRef} className={`grainient-container ${className}`.trim()} />;
};

export default Grainient;
```

- [ ] **Step 5: `BlurText.tsx` anlegen**

```tsx
// Aus React Bits uebernommen: github.com/DavidHDev/react-bits,
// src/ts-default/TextAnimations/BlurText/BlurText.tsx,
// Commit 3a1c7f2f9f94ed833934ab5c2635760b9e644583.
// Lizenz: MIT + Commons Clause, siehe LICENSE.md in diesem Ordner.
//
// Angepasst fuer den Pausenscreen:
//  - startVerzoegerungMs: der Text beginnt erst, wenn die Folie steht.
//  - Reduzierte Bewegung: nur Deckkraft, keine Unschaerfe, kein Versatz.
//  - Anpassungen fuer noUncheckedIndexedAccess und die Typen von motion.

import { motion, useReducedMotion, type TargetAndTransition, type Transition } from 'motion/react';
import { useEffect, useRef, useState, useMemo, type FC } from 'react';

type BlurTextProps = {
  text?: string;
  delay?: number;
  className?: string;
  animateBy?: 'words' | 'letters';
  direction?: 'top' | 'bottom';
  threshold?: number;
  rootMargin?: string;
  animationFrom?: Record<string, string | number>;
  animationTo?: Array<Record<string, string | number>>;
  easing?: (t: number) => number;
  onAnimationComplete?: () => void;
  stepDuration?: number;
  /** Wartezeit vor dem ersten Segment, in Millisekunden. */
  startVerzoegerungMs?: number;
};

const buildKeyframes = (
  from: Record<string, string | number>,
  steps: Array<Record<string, string | number>>
): Record<string, Array<string | number | undefined>> => {
  const keys = new Set<string>([...Object.keys(from), ...steps.flatMap(s => Object.keys(s))]);

  const keyframes: Record<string, Array<string | number | undefined>> = {};
  keys.forEach(k => {
    keyframes[k] = [from[k], ...steps.map(s => s[k])];
  });
  return keyframes;
};

const BlurText: FC<BlurTextProps> = ({
  text = '',
  delay = 200,
  className = '',
  animateBy = 'words',
  direction = 'top',
  threshold = 0.1,
  rootMargin = '0px',
  animationFrom,
  animationTo,
  easing = (t: number) => t,
  onAnimationComplete,
  stepDuration = 0.35,
  startVerzoegerungMs = 0
}) => {
  const elements = animateBy === 'words' ? text.split(' ') : text.split('');
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);
  const reduziert = useReducedMotion() === true;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (eintraege) => {
        if (eintraege[0]?.isIntersecting) {
          setInView(true);
          observer.unobserve(element);
        }
      },
      { threshold, rootMargin }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  const defaultFrom = useMemo<Record<string, string | number>>(
    () =>
      reduziert
        ? { opacity: 0 }
        : direction === 'top'
          ? { filter: 'blur(10px)', opacity: 0, y: -50 }
          : { filter: 'blur(10px)', opacity: 0, y: 50 },
    [direction, reduziert]
  );

  const defaultTo = useMemo<Array<Record<string, string | number>>>(
    () =>
      reduziert
        ? [{ opacity: 1 }]
        : [
            {
              filter: 'blur(5px)',
              opacity: 0.5,
              y: direction === 'top' ? 5 : -5
            },
            { filter: 'blur(0px)', opacity: 1, y: 0 }
          ],
    [direction, reduziert]
  );

  const fromSnapshot = animationFrom ?? defaultFrom;
  const toSnapshots = animationTo ?? defaultTo;

  const stepCount = toSnapshots.length + 1;
  const totalDuration = stepDuration * (stepCount - 1);
  const times = Array.from({ length: stepCount }, (_, i) => (stepCount === 1 ? 0 : i / (stepCount - 1)));

  return (
    <p ref={ref} className={className} style={{ display: 'flex', flexWrap: 'wrap' }}>
      {elements.map((segment, index) => {
        const animateKeyframes = buildKeyframes(fromSnapshot, toSnapshots);

        const spanTransition: Transition = {
          duration: totalDuration,
          times,
          delay: (startVerzoegerungMs + index * delay) / 1000,
          ease: easing
        };

        return (
          <motion.span
            key={index}
            initial={fromSnapshot as TargetAndTransition}
            animate={(inView ? animateKeyframes : fromSnapshot) as TargetAndTransition}
            transition={spanTransition}
            onAnimationComplete={index === elements.length - 1 ? onAnimationComplete : undefined}
            style={{
              display: 'inline-block',
              willChange: 'transform, filter, opacity'
            }}
          >
            {segment === ' ' ? '\u00A0' : segment}
            {animateBy === 'words' && index < elements.length - 1 && '\u00A0'}
          </motion.span>
        );
      })}
    </p>
  );
};

export default BlurText;
```

- [ ] **Step 6: `CountUp.tsx` anlegen**

```tsx
// Aus React Bits uebernommen: github.com/DavidHDev/react-bits,
// src/ts-default/TextAnimations/CountUp/CountUp.tsx,
// Commit 3a1c7f2f9f94ed833934ab5c2635760b9e644583.
// Lizenz: MIT + Commons Clause, siehe LICENSE.md in diesem Ordner.
//
// Angepasst fuer den Pausenscreen:
//  - nachkommastellen: feste Stellenzahl ("71.0" statt "71"), wie bisher
//    im Matchtag angezeigt.
//  - Reduzierte Bewegung: sofort der Endwert, kein Hochzaehlen.
//  - Anpassungen fuer noUncheckedIndexedAccess.

import { useInView, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import { useCallback, useEffect, useRef } from 'react';

interface CountUpProps {
  to: number;
  from?: number;
  direction?: 'up' | 'down';
  delay?: number;
  duration?: number;
  className?: string;
  startWhen?: boolean;
  separator?: string;
  onStart?: () => void;
  onEnd?: () => void;
  /** Feste Zahl an Nachkommastellen; ohne Angabe wie im Original aus from/to abgeleitet. */
  nachkommastellen?: number;
}

export default function CountUp({
  to,
  from = 0,
  direction = 'up',
  delay = 0,
  duration = 2,
  className = '',
  startWhen = true,
  separator = '',
  onStart,
  onEnd,
  nachkommastellen
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduziert = useReducedMotion() === true;
  const motionValue = useMotionValue(direction === 'down' ? to : from);

  const damping = 20 + 40 * (1 / duration);
  const stiffness = 100 * (1 / duration);

  const springValue = useSpring(motionValue, {
    damping,
    stiffness
  });

  const isInView = useInView(ref, { once: true, margin: '0px' });

  const getDecimalPlaces = (num: number): number => {
    const str = num.toString();
    if (str.includes('.')) {
      const decimals = str.split('.')[1] ?? '';
      if (parseInt(decimals) !== 0) {
        return decimals.length;
      }
    }
    return 0;
  };

  const maxDecimals = nachkommastellen ?? Math.max(getDecimalPlaces(from), getDecimalPlaces(to));

  const formatValue = useCallback(
    (latest: number) => {
      const hasDecimals = maxDecimals > 0;

      const options: Intl.NumberFormatOptions = {
        useGrouping: !!separator,
        minimumFractionDigits: hasDecimals ? maxDecimals : 0,
        maximumFractionDigits: hasDecimals ? maxDecimals : 0
      };

      const formattedNumber = Intl.NumberFormat('en-US', options).format(latest);

      return separator ? formattedNumber.replace(/,/g, separator) : formattedNumber;
    },
    [maxDecimals, separator]
  );

  useEffect(() => {
    if (ref.current) {
      const endwert = direction === 'down' ? from : to;
      const startwert = direction === 'down' ? to : from;
      ref.current.textContent = formatValue(reduziert ? endwert : startwert);
    }
  }, [from, to, direction, formatValue, reduziert]);

  useEffect(() => {
    if (reduziert) return;
    if (isInView && startWhen) {
      if (typeof onStart === 'function') {
        onStart();
      }

      const timeoutId = setTimeout(() => {
        motionValue.set(direction === 'down' ? from : to);
      }, delay * 1000);

      const durationTimeoutId = setTimeout(
        () => {
          if (typeof onEnd === 'function') {
            onEnd();
          }
        },
        delay * 1000 + duration * 1000
      );

      return () => {
        clearTimeout(timeoutId);
        clearTimeout(durationTimeoutId);
      };
    }
  }, [isInView, startWhen, motionValue, direction, from, to, delay, onStart, onEnd, duration, reduziert]);

  useEffect(() => {
    if (reduziert) return;
    const unsubscribe = springValue.on('change', (latest: number) => {
      if (ref.current) {
        ref.current.textContent = formatValue(latest);
      }
    });

    return () => unsubscribe();
  }, [springValue, formatValue, reduziert]);

  return <span className={className} ref={ref} />;
}
```

- [ ] **Step 7: `Noise.css` anlegen**

```css
/* Aus React Bits uebernommen: github.com/DavidHDev/react-bits,
   src/ts-default/Animations/Noise/Noise.css,
   Commit 3a1c7f2f9f94ed833934ab5c2635760b9e644583.
   Lizenz: MIT + Commons Clause, siehe LICENSE.md in diesem Ordner. */
.noise-overlay {
  position: absolute;
  left: 0;
  top: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
}
```

- [ ] **Step 8: `Noise.tsx` anlegen**

```tsx
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
```

- [ ] **Step 9: Typprüfung und Build**

Run: `cd F:/DEV/autodarts-screens && npm run typecheck && npm run build 2>&1 | tail -1`

Expected:
- `tsc` meldet keine Fehler, auch nicht in `reactbits/`. `tsconfig.json` schließt alle `src/**/*.tsx` ein, obwohl die Dateien noch nirgends eingebunden sind.
- Build endet mit `✓ built in`.
- Meldet `tsc` in `BlurText.tsx`, dass die Umwandlung nach `TargetAndTransition` fehlschlägt („Conversion of type … may be a mistake“): an beiden Stellen doppelt casten, mit `as unknown as TargetAndTransition`. Keine anderen Änderungen.

- [ ] **Step 10: Tests**

Run: `cd F:/DEV/autodarts-screens && npx vitest run 2>&1 | grep -E "Test Files|Tests "`
Expected: `Tests  378 passed (378)`

- [ ] **Step 11: Commit**

```bash
cd F:/DEV/autodarts-screens && git add package.json package-lock.json src/renderer/spectator/reactbits && git commit -q -F - <<'EOF'
feat: React-Bits-Komponenten fuer den Pausenscreen

Grainient, BlurText, CountUp und Noise aus React Bits (Commit 3a1c7f2)
als Quelltext unter src/renderer/spectator/reactbits/, mit eigener
Lizenzdatei (MIT + Commons Clause). Angepasst: Aufloesungsdeckel und
gleitende Lage/Farben fuer Grainient samt Kontextfreigabe, Startverzoegerung
fuer BlurText, feste Nachkommastellen fuer CountUp, ein sparsamerer Noise
und ueberall reduzierte Bewegung. Neu: motion und ogl.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RTjz7GMwcw3FxwhhSJb8ea
EOF
```

---

### Task 2: Vorspann im Kino-Stil

**Files:**
- Create: `src/renderer/spectator/vorspannFolien.ts`
- Test: `src/renderer/spectator/vorspannFolien.test.ts`
- Create: `src/renderer/spectator/KinoBuehne.tsx`
- Create: `src/renderer/spectator/kino.css`
- Modify: `src/renderer/spectator/Vorspann.tsx` (vollständig ersetzen)
- Modify: `src/renderer/spectator/vorfuehrung.ts` (neue Funktion `vorfuehrOhneWebgl`)
- Modify: `src/renderer/spectator/App.css` (Abschnitte „Vorspann“ und „Fortschrittsbalken der Diaschau“ entfernen)

**Interfaces:**
- Consumes (Task 1): `Grainient`, `BlurText` (`startVerzoegerungMs`), `Noise` (`stillstand`)
- Produces:
  - **`KinoBuehne.tsx`:**
    - `export type VerlaufLage = { centerX: number; centerY: number; blendAngle: number }`
    - `export const UEBERBLENDUNG_MS = 1500`
    - `export function KinoBuehne(props: { lage: VerlaufLage; hell?: boolean; children: ReactNode })`
    - `export function useVorige<T>(aktuell: T, dauerMs?: number): T | null`
  - **`kino.css`**, Klassen:
    - Bühne: `kino`, `kino--hell`, `kino-grund`, `kino-vignette`, `kino-logo`, `kino-pause`, `kino-pause-punkt`
    - Folien und Einblendungen: `kino-folie`, `kino-folie--ankommend`, `kino-folie--verlassend`, `kino-einblenden`, `kino-strich`
    - Fortschrittslinie: `fortschritt`, `fortschritt-balken`
  - **`vorfuehrung.ts`:** `export function vorfuehrOhneWebgl(): boolean`

- [ ] **Step 1: Failing test schreiben** – `src/renderer/spectator/vorspannFolien.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import {
  KONTAKT,
  LEISTUNGEN,
  PARTNER,
  SIGNAL_HALTEN_MS,
  SIGNAL_LAGE,
  TAKT_MS,
  VORSPANN_FOLIEN,
  haltenMsVon,
  lageVon,
} from './vorspannFolien'

describe('Vorspann-Folien', () => {
  it('fuehrt die acht Leistungen im freigegebenen Wortlaut und in fester Reihenfolge', () => {
    expect(LEISTUNGEN.map((l) => [l.zeilen, l.unterzeile ?? null])).toEqual([
      [['Netzwerk', 'infrastruktur'], null],
      [['Glasfaser'], 'Internetanbindung'],
      [['Video', 'überwachung'], null],
      [['Hosting'], 'Betrieb auf eigener Infrastruktur in deutschen Rechenzentren'],
      [['Monitoring'], 'Cloudflare Zero Trust · SSH Bastion'],
      [['Backup'], null],
      [['Support und', 'Störungsannahme'], null],
      [['Windows-', 'Lizenzen'], null],
    ])
  })

  it('setzt nach jeder Leistung die Zwischenfolie', () => {
    expect(VORSPANN_FOLIEN).toHaveLength(16)
    VORSPANN_FOLIEN.forEach((folie, i) => {
      expect(folie.art, `Folie ${i}`).toBe(i % 2 === 0 ? 'leistung' : 'signal')
    })
  })

  it('bebildert genau Netzwerkinfrastruktur, Glasfaser und Hosting', () => {
    expect(LEISTUNGEN.filter((l) => l.foto !== undefined).map((l) => [l.zeilen[0], l.foto])).toEqual([
      ['Netzwerk', 'patchpanel'],
      ['Glasfaser', 'switch'],
      ['Hosting', 'server'],
    ])
  })

  it('laesst Leistungen 6,5 s und die Zwischenfolie 2,4 s stehen', () => {
    expect(TAKT_MS).toBe(6500)
    expect(SIGNAL_HALTEN_MS).toBe(2400)
    expect(haltenMsVon(LEISTUNGEN[0]!)).toBe(6500)
    expect(haltenMsVon({ art: 'signal' })).toBe(2400)
  })

  it('gibt jeder Leistung eine eigene Lage des Verlaufs', () => {
    const lagen = new Set(LEISTUNGEN.map((l) => JSON.stringify(l.lage)))
    expect(lagen.size).toBe(8)
    expect(lageVon({ art: 'signal' })).toEqual(SIGNAL_LAGE)
    expect(lageVon(LEISTUNGEN[3]!)).toEqual(LEISTUNGEN[3]!.lage)
  })

  it('fuehrt Partner und Kontakt unveraendert', () => {
    expect(PARTNER).toEqual(['Cisco', 'Juniper', 'TP-Link', 'Ubiquiti', 'Backblaze'])
    expect(KONTAKT).toBe('jgnet.eu · hey@bsbnet.eu · +49 5222 9179070')
  })
})
```

- [ ] **Step 2: Test laufen lassen, er muss scheitern**

Run: `cd F:/DEV/autodarts-screens && npx vitest run src/renderer/spectator/vorspannFolien.test.ts 2>&1 | grep -E "FAIL|Error|Tests "`
Expected: `FAIL`, die Meldung nennt, dass `./vorspannFolien` nicht aufgelöst werden kann.

- [ ] **Step 3: `vorspannFolien.ts` anlegen**

```ts
// Die Folien des Vorspanns: Wortlaut, Reihenfolge, Standzeiten, Bebilderung.
//
// Wortlaut der Leistungsfolien stammt ausschliesslich aus der
// Anbieterkennzeichnung des Herausgebers und den Geschaeftsfeldern seiner
// eigenen Website (jgnet.eu) - keine Werbeversprechen, keine Zahlen, nichts
// hinzuerfunden. QInfo und WindowsTools bleiben aussen vor
// (erklaerungsbeduerftig ohne Kontext), Downtimes ist eine Statusseite und
// keine Leistung.
//
// Eigene Datei ohne Bild-Importe, damit Wortlaut und Zuordnung ohne Vite
// pruefbar sind - dieselbe Trennung wie matchtagFolien.ts und Matchtag.tsx.
// Die Bilddateien ordnet Vorspann.tsx den Foto-Schluesseln zu.

import type { VerlaufLage } from './KinoBuehne'

/** Standzeit einer Leistungsfolie. */
export const TAKT_MS = 6500
/** Kurzer Atemzug der Zwischenfolie zwischen zwei Leistungen. */
export const SIGNAL_HALTEN_MS = 2400

/** Schriftstufe nach laengster Zeile, von Hand vergeben. */
export type Groesse = 'riesig' | 'gross' | 'kompakt'
export type FotoSchluessel = 'patchpanel' | 'switch' | 'server'

export type Leistungsfolie = {
  art: 'leistung'
  /** 1-2 Zeilen; lange Woerter brechen von Hand an einer sinnvollen Stelle um. */
  zeilen: string[]
  groesse: Groesse
  unterzeile?: string
  /** Ohne Foto steht die Folie auf dem Verlauf der Buehne. */
  foto?: FotoSchluessel
  /** Wo der Verlauf auf dieser Folie sitzt - je Folie anders. */
  lage: VerlaufLage
}

/** Die Zwischenfolie traegt keine eigenen Daten - ihr Inhalt ist immer derselbe. */
export type Signalfolie = { art: 'signal' }

export type VorspannFolie = Leistungsfolie | Signalfolie

export const LEISTUNGEN: Leistungsfolie[] = [
  {
    art: 'leistung',
    zeilen: ['Netzwerk', 'infrastruktur'],
    groesse: 'kompakt',
    foto: 'patchpanel',
    lage: { centerX: -0.2, centerY: 0.1, blendAngle: 0 },
  },
  {
    art: 'leistung',
    zeilen: ['Glasfaser'],
    groesse: 'gross',
    unterzeile: 'Internetanbindung',
    foto: 'switch',
    lage: { centerX: 0.2, centerY: -0.1, blendAngle: 35 },
  },
  {
    art: 'leistung',
    zeilen: ['Video', 'überwachung'],
    groesse: 'gross',
    lage: { centerX: -0.25, centerY: -0.15, blendAngle: 70 },
  },
  {
    art: 'leistung',
    zeilen: ['Hosting'],
    groesse: 'riesig',
    unterzeile: 'Betrieb auf eigener Infrastruktur in deutschen Rechenzentren',
    foto: 'server',
    lage: { centerX: 0.15, centerY: 0.2, blendAngle: 110 },
  },
  {
    art: 'leistung',
    zeilen: ['Monitoring'],
    groesse: 'gross',
    unterzeile: 'Cloudflare Zero Trust · SSH Bastion',
    lage: { centerX: 0.3, centerY: 0.05, blendAngle: 150 },
  },
  {
    art: 'leistung',
    zeilen: ['Backup'],
    groesse: 'riesig',
    lage: { centerX: -0.1, centerY: 0.25, blendAngle: 200 },
  },
  {
    art: 'leistung',
    zeilen: ['Support und', 'Störungsannahme'],
    groesse: 'kompakt',
    lage: { centerX: 0.05, centerY: -0.25, blendAngle: 250 },
  },
  {
    art: 'leistung',
    zeilen: ['Windows-', 'Lizenzen'],
    groesse: 'gross',
    lage: { centerX: -0.3, centerY: 0, blendAngle: 300 },
  },
]

/** Lage des Verlaufs auf der Zwischenfolie. */
export const SIGNAL_LAGE: VerlaufLage = { centerX: 0, centerY: 0, blendAngle: 180 }

// Wortwunsch des Herausgebers woertlich uebernommen: "zwischen den Szenen mit
// meiner Werbung bitte immer so ein es geht gleich los screen zwischenbauen" -
// deshalb nach JEDER Leistung.
export const VORSPANN_FOLIEN: VorspannFolie[] = LEISTUNGEN.flatMap((l): VorspannFolie[] => [l, { art: 'signal' }])

export function haltenMsVon(folie: VorspannFolie): number {
  return folie.art === 'signal' ? SIGNAL_HALTEN_MS : TAKT_MS
}

export function lageVon(folie: VorspannFolie): VerlaufLage {
  return folie.art === 'signal' ? SIGNAL_LAGE : folie.lage
}

// Hersteller, mit denen der Herausgeber arbeitet - als schlichte Namenszeile
// statt als Logo-Reihe: echte Hersteller-Logos ohne Zustimmung nachzubauen
// waere markenrechtlich heikel.
export const PARTNER = ['Cisco', 'Juniper', 'TP-Link', 'Ubiquiti', 'Backblaze']

/** Kontaktdaten laut Spec 2026-09-09, Abschnitt 18.4. */
export const KONTAKT = 'jgnet.eu · hey@bsbnet.eu · +49 5222 9179070'
```

- [ ] **Step 4: `vorfuehrOhneWebgl` in `vorfuehrung.ts` ergänzen**

Direkt nach der Funktion `vorfuehrungEingefroren()` einfügen. Sie endet mit `return vorfuehrungAktiv() && parameter().has("schritt");` und `}`.

```ts

/**
 * ?ohnewebgl schaltet im Vorfuehrmodus den WebGL-Hintergrund des
 * Pausenscreens ab - so laesst sich der CSS-Ersatz begutachten, den ein
 * Rechner ohne WebGL 2 zu sehen bekommt.
 */
export function vorfuehrOhneWebgl(): boolean {
  return vorfuehrungAktiv() && parameter().has("ohnewebgl");
}
```

- [ ] **Step 5: `KinoBuehne.tsx` anlegen**

```tsx
// Gemeinsame Buehne des Pausenscreens (Vorspann und Matchtag), Stil "Kino".
// Siehe docs/superpowers/specs/2026-09-13-pausenscreen-kino-design.md, Abschnitt 4.
//
//  - Grund: Grainient (WebGL) mit halber Aufloesung, darunter immer ein
//    CSS-Verlauf in denselben Farben. Ohne WebGL 2 bleibt nur der stehen.
//  - Vignette, Logo oben links, "Spielpause" oben rechts.
//  - Verlaesst der Zuschauer-Screen die Pause, haengt App.tsx die Buehne aus;
//    Grainient gibt dabei seinen WebGL-Kontext frei.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useReducedMotion } from 'motion/react'
import logoWeiss from '../../../assets/logo-white.png'
import Grainient from './reactbits/Grainient'
import { vorfuehrOhneWebgl } from './vorfuehrung'
import './kino.css'

/** Wo der Verlauf sitzt. Werte wie Grainient: Versatz -0.5..0.5, Winkel in Grad. */
export type VerlaufLage = { centerX: number; centerY: number; blendAngle: number }

/** Dauer der Ueberblendung zwischen zwei Folien - muss zu kino.css passen. */
export const UEBERBLENDUNG_MS = 1500

/**
 * Farben des Verlaufs. "normal" bleibt sehr dunkel, damit weisse Schrift
 * darauf aus dem ganzen Raum lesbar ist; "hell" traegt die Siegerfolie.
 */
const FARBEN = {
  normal: { color1: '#0f5132', color2: '#020617', color3: '#073642', contrast: 1.35 },
  hell: { color1: '#16a34a', color2: '#052e16', color3: '#0e7490', contrast: 1.2 },
} as const

let webgl2Ergebnis: boolean | null = null

/** Einmal je Programmlauf pruefen, ob WebGL 2 zur Verfuegung steht. */
function webgl2Verfuegbar(): boolean {
  if (vorfuehrOhneWebgl()) return false
  if (webgl2Ergebnis === null) {
    try {
      const gl = document.createElement('canvas').getContext('webgl2')
      webgl2Ergebnis = gl !== null
      gl?.getExtension('WEBGL_lose_context')?.loseContext()
    } catch {
      webgl2Ergebnis = false
    }
  }
  return webgl2Ergebnis
}

export function KinoBuehne({ lage, hell = false, children }: { lage: VerlaufLage; hell?: boolean; children: ReactNode }) {
  const stillstand = useReducedMotion() === true
  const [webgl] = useState(webgl2Verfuegbar)
  const farben = hell ? FARBEN.hell : FARBEN.normal

  return (
    <div className={`kino${hell ? ' kino--hell' : ''}`}>
      <div className="kino-grund" aria-hidden="true">
        {webgl && (
          <Grainient
            color1={farben.color1}
            color2={farben.color2}
            color3={farben.color3}
            contrast={farben.contrast}
            centerX={lage.centerX}
            centerY={lage.centerY}
            blendAngle={lage.blendAngle}
            timeSpeed={0.12}
            warpSpeed={1.2}
            grainAmount={0.07}
            grainAnimated
            maxDpr={0.5}
            stillstand={stillstand}
          />
        )}
      </div>
      <div className="kino-vignette" aria-hidden="true" />
      {children}
      <img className="kino-logo" src={logoWeiss} alt="JGNet" />
      <div className="kino-pause">
        <span className="kino-pause-punkt" />
        Spielpause
      </div>
    </div>
  )
}

/**
 * Haelt den vorigen Wert fuer die Dauer der Ueberblendung fest: so kann die
 * alte Folie ausblenden, waehrend die neue einblendet. Danach null.
 */
export function useVorige<T>(aktuell: T, dauerMs: number = UEBERBLENDUNG_MS): T | null {
  const [vorige, setVorige] = useState<T | null>(null)
  const letzte = useRef(aktuell)
  useEffect(() => {
    if (Object.is(letzte.current, aktuell)) return
    setVorige(letzte.current)
    letzte.current = aktuell
    const zeit = window.setTimeout(() => setVorige(null), dauerMs)
    return () => window.clearTimeout(zeit)
  }, [aktuell, dauerMs])
  return vorige
}
```

- [ ] **Step 6: Test laufen lassen, er muss bestehen**

Run: `cd F:/DEV/autodarts-screens && npx vitest run src/renderer/spectator/vorspannFolien.test.ts 2>&1 | grep -E "FAIL|Tests "`
Expected: `Tests  6 passed (6)`

- [ ] **Step 7: `kino.css` anlegen**

```css
/* Pausenscreen im Stil "Kino" - Vorspann und Matchtag.
   Siehe docs/superpowers/specs/2026-09-13-pausenscreen-kino-design.md.
   Alles in vh/vw, damit 1080p und 4K gleich wirken. Gruen nur als Signal,
   Weiss fuer Inhalte, Grau fuer Nebensachen - kein Amber, kein Rot. */

/* ─── Buehne ─────────────────────────────────────────────────────── */

.kino {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--jg-bg);
  color: var(--jg-text);
  font-family: var(--jg-font-display);
}

.kino p {
  margin: 0;
}

/* Unterlage und Ersatz fuer Grainient: dieselben Farben als ruhiger Verlauf.
   Mit WebGL deckt die Zeichenflaeche ihn zu, ohne steht nur er. */
.kino-grund {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(60% 70% at 20% 85%, rgba(15, 81, 50, 0.55) 0%, transparent 70%),
    radial-gradient(55% 65% at 85% 10%, rgba(7, 54, 66, 0.6) 0%, transparent 70%),
    var(--jg-bg);
}

.kino--hell .kino-grund {
  background:
    radial-gradient(70% 80% at 50% 100%, rgba(22, 163, 74, 0.45) 0%, transparent 70%),
    radial-gradient(55% 65% at 85% 10%, rgba(14, 116, 144, 0.45) 0%, transparent 70%),
    #052e16;
}

.kino-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0, 0, 0, 0.6) 100%);
}

.kino-logo {
  position: absolute;
  top: 4vh;
  left: 3vw;
  z-index: 5;
  height: 6vh;
  width: auto;
}

.kino-pause {
  position: absolute;
  top: 4.6vh;
  right: 3vw;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 1vh;
  font-size: 2.2vh;
  font-weight: 700;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--jg-muted-strong);
}

.kino-pause-punkt {
  width: 1.2vh;
  height: 1.2vh;
  border-radius: 50%;
  background: var(--jg-accent);
  animation: kino-puls 1.8s ease-in-out infinite;
}

@keyframes kino-puls {
  50% {
    opacity: 0.3;
  }
}

/* ─── Folien und Ueberblendung (UEBERBLENDUNG_MS in KinoBuehne.tsx) ─── */

.kino-folie {
  position: absolute;
  inset: 0;
}

.kino-folie--ankommend {
  animation: kino-folie-ein 1500ms var(--jg-ease) both;
}

.kino-folie--verlassend {
  animation: kino-folie-aus 1500ms var(--jg-ease) both;
}

@keyframes kino-folie-ein {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes kino-folie-aus {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

/* Einzelne Elemente, die nach der Folie aus der Unschaerfe auftauchen.
   Die Verzoegerung kommt je Element als animation-delay aus dem Code. */
.kino-einblenden {
  animation: kino-einblenden 900ms var(--jg-ease) both;
}

@keyframes kino-einblenden {
  from {
    opacity: 0;
    filter: blur(12px);
    transform: translateY(1.5vh);
  }
  to {
    opacity: 1;
    filter: blur(0);
    transform: none;
  }
}

.kino-strich {
  display: block;
  width: 6vw;
  height: 0.55vh;
  background: var(--jg-accent);
}

/* ─── Vorspann ───────────────────────────────────────────────────── */

.kino-foto {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  animation-name: kino-fahrt-links;
  animation-timing-function: linear;
  animation-fill-mode: both;
}

.kino-foto--rechts {
  animation-name: kino-fahrt-rechts;
}

@keyframes kino-fahrt-links {
  from {
    transform: scale(1.02) translate(0, 0);
  }
  to {
    transform: scale(1.12) translate(-2%, -1.5%);
  }
}

@keyframes kino-fahrt-rechts {
  from {
    transform: scale(1.02) translate(0, 0);
  }
  to {
    transform: scale(1.12) translate(2%, -1.5%);
  }
}

/* Dunkler Verlauf links und unten: dort steht der Text. */
.kino-foto-schleier {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(2, 6, 23, 0.95) 0%, rgba(2, 6, 23, 0.7) 38%, rgba(2, 6, 23, 0.1) 75%),
    linear-gradient(0deg, rgba(2, 6, 23, 0.9) 0%, transparent 40%);
}

.kino-text {
  position: absolute;
  left: 6vw;
  bottom: 17vh;
  z-index: 2;
  width: 62vw;
}

.kino-text .kino-strich {
  margin-bottom: 3vh;
}

.kino-wort {
  font-weight: 800;
  line-height: 0.88;
  text-transform: uppercase;
}

.kino-wort--riesig {
  font-size: min(26vh, 14vw);
}

.kino-wort--gross {
  font-size: min(19vh, 10.5vw);
}

.kino-wort--kompakt {
  font-size: min(14vh, 7.6vw);
}

.kino-unterzeile {
  padding-top: 3.2vh;
  max-width: 52vw;
  font-family: var(--jg-font-body);
  font-size: 3vh;
  font-weight: 500;
  line-height: 1.35;
  color: var(--jg-muted-strong);
}

.kino-signal {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.kino-signal-text {
  justify-content: center;
  max-width: 90vw;
  font-size: min(20vh, 11vw);
  font-weight: 800;
  line-height: 0.9;
  text-transform: uppercase;
  color: var(--jg-text);
}

.kino-fuss {
  position: absolute;
  left: 6vw;
  right: 3vw;
  bottom: 4vh;
  z-index: 5;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 2vw;
}

.kino-partner {
  display: flex;
  font-size: 2vh;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--jg-muted);
}

.kino-partner span:not(:last-child)::after {
  content: '·';
  margin: 0 0.9vw;
  color: var(--jg-border-strong);
}

.kino-kontakt {
  font-family: var(--jg-font-mono);
  font-size: 1.6vh;
  letter-spacing: 0.02em;
  color: var(--jg-muted);
  white-space: nowrap;
}

/* ─── Fortschrittslinie (Fortschritt.tsx) ────────────────────────── */

.fortschritt {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9;
  height: 0.35vh;
  background: rgba(229, 236, 245, 0.08);
  overflow: hidden;
}

.fortschritt-balken {
  display: block;
  width: 100%;
  height: 100%;
  transform: scaleX(0);
  transform-origin: left center;
  background: var(--jg-accent);
  animation-name: fortschritt-laufen;
  animation-timing-function: linear;
  animation-fill-mode: both;
}

@keyframes fortschritt-laufen {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}

/* ─── Reduzierte Bewegung ────────────────────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  /* tokens.css kuerzt jede Animation auf 0.01ms. Die Ueberblendung bleibt
     trotzdem - sie aendert nur die Deckkraft und bewegt nichts. */
  .kino-folie--ankommend,
  .kino-folie--verlassend {
    animation-duration: 1500ms !important;
  }

  .kino-foto {
    animation: none !important;
    transform: scale(1.02);
  }

  .kino-pause-punkt {
    animation: none;
  }

  .fortschritt-balken {
    animation: none !important;
    transform: scaleX(1);
  }
}
```

- [ ] **Step 8: `Vorspann.tsx` vollständig ersetzen**

```tsx
// Vorspann im Kino-Stil: laeuft, solange kein Match aktiv ist (Basis-Szene
// 'idle' aus szene.ts) und kein Matchtag laeuft, und wiederholt sich endlos.
//
// Gestaltung: docs/superpowers/specs/2026-09-13-pausenscreen-kino-design.md,
// Abschnitt 5. Foto-Folien fahren langsam heran, die uebrigen stehen auf dem
// Verlauf der Buehne; die Schrift taucht aus der Unschaerfe auf, sobald die
// neue Folie halb eingeblendet ist. Wortlaut, Reihenfolge und Standzeiten
// stehen in vorspannFolien.ts.

import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import patchpanel from '../../../assets/vorspann-patchpanel.jpg'
import server from '../../../assets/vorspann-server.jpg'
import switchFoto from '../../../assets/vorspann-switch.jpg'
import BlurText from './reactbits/BlurText'
import Noise from './reactbits/Noise'
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
  const stillstand = useReducedMotion() === true
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
          <Noise patternAlpha={14} stillstand={stillstand} />
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
```

- [ ] **Step 9: Alte Vorspann- und Fortschritt-Abschnitte aus `App.css` entfernen**

Der Schnitt richtet sich nach den Kommentarmarken, nicht nach Zeilennummern:

```bash
cd F:/DEV/autodarts-screens && node -e "
const fs = require('fs');
const pfad = 'src/renderer/spectator/App.css';
let s = fs.readFileSync(pfad, 'utf8');
const vor = s.length;
function ausschneiden(anfangText, endeText) {
  const a = s.indexOf(anfangText);
  if (a < 0) throw new Error('Anfang fehlt: ' + anfangText);
  const e0 = s.indexOf(endeText, a);
  if (e0 < 0) throw new Error('Ende fehlt: ' + endeText);
  s = s.slice(0, a) + s.slice(s.lastIndexOf('/*', e0));
}
ausschneiden('/* ─── Vorspann ─', 'Statistikleiste: beide Spieler nebeneinander');
ausschneiden('/* ─── Fortschrittsbalken der Diaschau', 'Weicher, gerichteter Einzug statt eines harten Schnitts');
fs.writeFileSync(pfad, s);
console.log('entfernt:', vor - s.length, 'Zeichen');
" && grep -n "^\.vorspann\|^\.fortschritt" src/renderer/spectator/App.css
```

Expected:
- Das Skript meldet `entfernt: <Zahl über 7000> Zeichen`.
- `grep` gibt nichts aus, es gibt also keine Regel mehr für `.vorspann` oder `.fortschritt`.

- [ ] **Step 10: Typprüfung, Tests, Build**

Run: `cd F:/DEV/autodarts-screens && npm run typecheck && npx vitest run 2>&1 | grep -E "Test Files|Tests " && npm run build 2>&1 | tail -1`
Expected: Typecheck ohne Fehler, `Tests  384 passed (384)`, `✓ built in …`.

- [ ] **Step 11: Sichtprüfung Vorspann (1080p)**

Vite starten (siehe „Prüfumgebung“), dann per Playwright-MCP:

```js
async (page) => {
  const ziel = 'F:/DEV/autodarts-screens/.superpowers/pruefung';
  await page.setViewportSize({ width: 1920, height: 1080 });
  const ergebnisse = [];
  for (let folie = 0; folie < 16; folie++) {
    await page.goto(`http://localhost:5260/spectator/index.html?vorfuehrung&schritt=0&folie=${folie}`);
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${ziel}/vorspann-1080-${folie}.png` });
    ergebnisse.push(await page.evaluate(() => ({
      kino: !!document.querySelector('.kino'),
      canvasWebgl: !!document.querySelector('.grainient-container canvas'),
      text: document.querySelector('.kino-folie--ankommend')?.textContent?.trim().slice(0, 60),
      ueberRand: [...document.querySelectorAll('.kino-folie--ankommend p')].some((p) => p.getBoundingClientRect().right > innerWidth * 0.97),
    })));
  }
  return ergebnisse;
}
```

Expected für jede Folie:
- `kino: true`, `canvasWebgl: true` und `ueberRand: false`.
- `text` enthält den Wortlaut der Folie. Bei ungeraden Folien steht dort „Gleich geht's weiter“.

Dann jeden Screenshot mit dem Read-Werkzeug ansehen. Akzeptanz:
- **Folien 0, 2 und 6:** Das Foto füllt den Bildschirm, links liegt ein dunkler Verlauf. Das Wort steht unten links mit grünem Strich darüber.
- **Folien 4, 8, 10, 12 und 14:** dunkler, grün-petrolfarbener Verlauf ohne Foto.
- **Überall:**
  - Logo oben links, „● Spielpause“ oben rechts, Partner und Kontakt unten, dünne grüne Linie ganz unten.
  - Kein Text ist abgeschnitten, keiner überlappt Logo oder Fußzeile.
- **Ist der Verlauf zu hell** und die weiße Schrift schlecht lesbar: nur `FARBEN.normal` in `KinoBuehne.tsx` und die Werte in `.kino-grund` anpassen, dann erneut prüfen.

Danach 4K: dasselbe Skript mit `width: 3840, height: 2160` und Dateinamen `vorspann-4k-${folie}.png`, nur für die Folien 0, 1, 4 und 6. Akzeptanz: gleiche Aufteilung wie bei 1080p.

- [ ] **Step 12: Sichtprüfung reduzierte Bewegung und ohne WebGL**

```js
async (page) => {
  const ziel = 'F:/DEV/autodarts-screens/.superpowers/pruefung';
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('http://localhost:5260/spectator/index.html?vorfuehrung&schritt=0&folie=0');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${ziel}/vorspann-reduziert.png` });
  const reduziert = await page.evaluate(() => getComputedStyle(document.querySelector('.kino-foto')).animationName);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('http://localhost:5260/spectator/index.html?vorfuehrung&schritt=0&folie=4&ohnewebgl');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${ziel}/vorspann-ohne-webgl.png` });
  const ohne = await page.evaluate(() => ({
    grainient: document.querySelectorAll('.grainient-container').length,
    grund: getComputedStyle(document.querySelector('.kino-grund')).backgroundImage.slice(0, 30),
  }));
  return { reduziert, ohne };
}
```

Expected:
- `reduziert: 'none'`.
- `ohne.grainient: 0`, und `ohne.grund` beginnt mit `radial-gradient`.
- Screenshot „reduziert“: Der Text ist vollständig und scharf zu sehen.
- Screenshot „ohne WebGL“: dunkler Verlauf, der Text ist lesbar.

Vite-Prozess beenden (siehe „Prüfumgebung“).

- [ ] **Step 13: Commit**

```bash
cd F:/DEV/autodarts-screens && git add src/renderer/spectator/vorspannFolien.ts src/renderer/spectator/vorspannFolien.test.ts src/renderer/spectator/KinoBuehne.tsx src/renderer/spectator/kino.css src/renderer/spectator/Vorspann.tsx src/renderer/spectator/vorfuehrung.ts src/renderer/spectator/App.css && git commit -q -F - <<'EOF'
feat: Vorspann im Kino-Stil

Neue KinoBuehne fuer den Pausenscreen: Grainient-Verlauf mit halber
Aufloesung und CSS-Ersatz ohne WebGL 2, Vignette, Logo, Spielpause. Der
Vorspann steht darauf mit Fotos, die langsam heranfahren (Netzwerk-
infrastruktur, Glasfaser, Hosting), die uebrigen Leistungen auf dem
Verlauf, dessen Lage je Folie wandert. Schrift taucht aus der Unschaerfe
auf, Folien blenden weich ueber. Wortlaut und Zuordnung in
vorspannFolien.ts, mit Test. ?ohnewebgl zeigt den Ersatz.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RTjz7GMwcw3FxwhhSJb8ea
EOF
```

---

### Task 3: Matchtag als Titelsequenz

**Files:**
- Modify: `src/renderer/spectator/vorfuehrung.ts` (`mtaufwaermen`)
- Modify: `src/renderer/spectator/Matchtag.tsx` (vollständig ersetzen)
- Modify: `src/renderer/spectator/kino.css` (Abschnitt „Matchtag“ anhängen)
- Modify: `src/renderer/spectator/App.css` (Matchtag-Abschnitte entfernen)

**Interfaces:**
- Consumes:
  - **Task 1:** `BlurText`, `CountUp` mit den Props `to`, `nachkommastellen`, `duration`, `delay` und `className`.
  - **Task 2:**
    - `KinoBuehne`, `useVorige`, `type VerlaufLage`
    - aus `kino.css` die Klassen `kino-folie--ankommend`, `kino-folie--verlassend`, `kino-einblenden` und `kino-strich`
  - **`matchtagFolien.ts`:** `folienFuer(matchtag): FolienArt[]` und `type FolienArt`.
  - **`src/shared/matchtag.ts`:**
    - Funktionen: `endstand`, `naechstePaarung`, `spielerBilanzen`, `spielerName`, `statistiken`, `tabelle`
    - Typen: `type Matchtag`, `type Paarung`
- Produces:
  - **`Matchtag.tsx`:** `useMatchtag()` und `Matchtag({ matchtag })`, beide mit unveränderter Signatur. Beide nutzt `App.tsx`.
  - **Vorführmodus:** neuer Parameter `mtaufwaermen`.

- [ ] **Step 1: `mtaufwaermen` in `vorfuehrung.ts`**

In `vorfuehrMatchtag()` als erste Anweisung im Funktionskörper einfügen, vor `const namen = [...]`:

```ts
  // ?mtaufwaermen zeigt den Matchtag vor der ersten Runde - nur dort gibt es
  // die Folie "Aufwaermrunde", der uebrige Vorfuehr-Matchtag ist schon weiter.
  if (vorfuehrungAktiv() && parameter().has('mtaufwaermen')) {
    return matchtagStarten('Hüttenabend', '2026-09-11T19:00:00.000Z')
  }
```

In `vorfuehrMatchtagAktiv()` die `return`-Zeile ersetzen durch:

```ts
  return vorfuehrungAktiv() && (parameter().has('matchtag') || parameter().has('mtfolie') || parameter().has('mtaufwaermen'))
```

- [ ] **Step 2: `Matchtag.tsx` vollständig ersetzen**

```tsx
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

function FolieJetzt({ matchtag }: { matchtag: MatchtagStand }) {
  const naechste = naechstePaarung(matchtag)
  if (!naechste) return null
  const danach = matchtag.paarungen.filter((p) => p.siegerId === null && p.id !== naechste.id).slice(0, 3)
  const stechen = matchtag.phase === 'stechen'

  return (
    <div className="mt-folie mt-jetzt">
      <div className="mt-jetzt-paar">
        <span className="kino-strich" />
        <span className="mt-kicker">{stechen ? 'Stechen um den Sieg' : 'Als Nächstes'}</span>
        <BlurText
          text={spielerName(matchtag, naechste.aId)}
          className="mt-jetzt-name"
          startVerzoegerungMs={TEXT_START_MS}
          delay={120}
          direction="bottom"
        />
        <span className="mt-jetzt-gegen kino-einblenden" style={verzoegert(TEXT_START_MS + 500)}>
          gegen
        </span>
        <BlurText
          text={spielerName(matchtag, naechste.bId)}
          className="mt-jetzt-name"
          startVerzoegerungMs={TEXT_START_MS + 800}
          delay={120}
          direction="bottom"
        />
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
      <BlurText
        text={name}
        animateBy="letters"
        className="mt-siegername"
        startVerzoegerungMs={TEXT_START_MS}
        delay={70}
        direction="bottom"
      />
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
  // von vorn, statt in einem Index zu stehen, den es nicht mehr gibt.
  const schluessel = folien.join('|')
  useEffect(() => setIndex(0), [schluessel])

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
```

- [ ] **Step 3: Matchtag-Abschnitt an `kino.css` anhängen**

Ans Ende von `src/renderer/spectator/kino.css` anhängen, also hinter den Block `@media (prefers-reduced-motion: reduce)` aus Task 2:

```css

/* ─── Matchtag als Titelsequenz ──────────────────────────────────── */

.mt-kopf {
  position: absolute;
  top: 3.4vh;
  left: 50%;
  z-index: 6;
  width: 46vw;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.1vh;
}

.mt-roadmap {
  position: relative;
  width: 100%;
}

.mt-roadmap-linie {
  position: absolute;
  top: 0.6vh;
  left: 5%;
  right: 5%;
  height: 1px;
  background: rgba(229, 236, 245, 0.18);
}

.mt-roadmap-fuellung {
  display: block;
  height: 100%;
  background: var(--jg-accent);
  transition: width 1200ms var(--jg-ease);
}

.mt-roadmap-stationen {
  position: relative;
  display: flex;
  justify-content: space-between;
}

.mt-station {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9vh;
  font-size: 1.5vh;
  font-weight: 700;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--jg-muted);
}

.mt-station-punkt {
  width: 1.2vh;
  height: 1.2vh;
  border-radius: 50%;
  background: var(--jg-bg);
  border: 1px solid rgba(229, 236, 245, 0.35);
}

.mt-station.ist-vorbei {
  color: var(--jg-muted-strong);
}

.mt-station.ist-vorbei .mt-station-punkt,
.mt-station.ist-hier .mt-station-punkt {
  background: var(--jg-accent);
  border-color: var(--jg-accent);
}

.mt-station.ist-hier {
  color: var(--jg-accent);
}

.mt-status-text {
  max-width: 100%;
  font-size: 1.9vh;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--jg-muted-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Flaeche jeder Folie: unter dem Kopf, ueber der Fortschrittslinie. */
.mt-folie {
  position: absolute;
  left: 6vw;
  right: 6vw;
  top: 17vh;
  bottom: 8vh;
  display: flex;
  flex-direction: column;
}

.mt-titel {
  display: flex;
  flex-direction: column;
  margin-bottom: 4vh;
}

.mt-kicker {
  font-size: 2.4vh;
  font-weight: 700;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--jg-accent);
}

.mt-kicker--grau {
  color: var(--jg-muted);
}

.mt-kicker--abstand {
  margin: 2.5vh 0 1vh;
}

.mt-titel-gross {
  padding-top: 1vh;
  font-size: 9vh;
  font-weight: 800;
  line-height: 0.9;
  text-transform: uppercase;
}

/* Tabellenzeilen: filter auf <tr> wirkt nicht zuverlaessig - nur Deckkraft
   und Versatz. */
.mt-tabelle tr.kino-einblenden {
  animation-name: kino-einblenden-zeile;
}

@keyframes kino-einblenden-zeile {
  from {
    opacity: 0;
    transform: translateY(1.5vh);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

/* Folie: Als Naechstes */

.mt-jetzt-paar {
  position: absolute;
  left: 0;
  top: 5vh;
  max-width: 66vw;
  display: flex;
  flex-direction: column;
}

.mt-jetzt-paar .mt-kicker {
  margin: 2.5vh 0 1vh;
}

.mt-jetzt-name {
  font-size: min(22vh, 12vw);
  font-weight: 800;
  line-height: 0.86;
  text-transform: uppercase;
}

.mt-jetzt-gegen {
  margin: 2vh 0 1.6vh 0.4vw;
  font-size: 2.8vh;
  font-weight: 700;
  letter-spacing: 0.45em;
  text-transform: uppercase;
  color: var(--jg-muted);
}

.mt-danach {
  position: absolute;
  right: 0;
  bottom: 2vh;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1.2vh;
  text-align: right;
}

.mt-danach-zeile {
  font-size: 3.4vh;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--jg-muted-strong);
}

.mt-danach-zeile em {
  margin: 0 0.5vw;
  font-style: normal;
  font-size: 0.7em;
  color: var(--jg-muted);
}

/* Folie: Tabelle / Endstand und Analyse */

.mt-tabelle {
  width: 100%;
  border-collapse: collapse;
  font-size: 3.6vh;
  font-variant-numeric: tabular-nums;
}

.mt-tabelle th {
  padding: 0 1.2vw 1.4vh;
  font-size: 1.7vh;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--jg-muted);
  text-align: right;
}

.mt-tabelle td {
  padding: 1.1vh 1.2vw;
  color: var(--jg-text);
  text-align: right;
}

.mt-tabelle .mt-sp-platz {
  width: 4vw;
  text-align: left;
  color: var(--jg-muted);
}

.mt-tabelle .mt-sp-name {
  text-align: left;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.mt-punkte {
  font-weight: 800;
  color: var(--jg-accent);
}

/* Die Fuehrung (im Endstand: der Sieger) steht groesser, mit gruenem Strich. */
.mt-tabelle tr.ist-vorn td {
  font-size: 5vh;
  font-weight: 800;
}

.mt-tabelle tr.ist-vorn .mt-sp-platz {
  color: var(--jg-accent);
  box-shadow: inset 0.5vh 0 0 var(--jg-accent);
}

.mt-tabelle--dicht {
  font-size: 2.9vh;
}

.mt-tabelle--dicht td {
  padding: 0.7vh 1.2vw;
}

.mt-tabelle--dicht tr.ist-vorn td {
  font-size: 3.8vh;
}

.mt-analyse {
  font-size: 2.8vh;
}

.mt-analyse th {
  padding: 0 0.7vw 1.2vh;
  font-size: 1.5vh;
  letter-spacing: 0.14em;
}

.mt-analyse td {
  padding: 0.8vh 0.7vw;
}

/* Folie: Spielplan */

.mt-plan {
  display: grid;
  gap: 1.2vh 5vw;
}

.mt-plan--2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.mt-plan--3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.mt-plan-zeile {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 7vw minmax(0, 1fr);
  align-items: baseline;
  gap: 1vw;
  padding: 0.6vh 0 0.6vh 1.2vw;
  font-size: 3.3vh;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--jg-text);
}

.mt-plan--3 .mt-plan-zeile {
  font-size: 2.6vh;
}

.mt-plan-name:first-child {
  text-align: right;
}

.mt-plan-mitte {
  text-align: center;
  font-size: 0.75em;
  letter-spacing: 0.12em;
  color: var(--jg-muted);
}

.mt-plan-zeile.ist-gespielt {
  color: var(--jg-muted);
}

.mt-plan-zeile.ist-gespielt .mt-plan-mitte {
  color: var(--jg-muted-strong);
}

.mt-plan-name.ist-sieger {
  color: var(--jg-text);
}

.mt-plan-zeile.ist-naechste {
  box-shadow: inset 0.35vh 0 0 var(--jg-accent);
}

.mt-plan-zeile.ist-naechste .mt-plan-mitte {
  color: var(--jg-accent);
}

/* Folie: Zahlen des Abends */

.mt-werte {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 3vw;
  margin-bottom: 5vh;
}

.mt-wert {
  display: flex;
  flex-direction: column;
  gap: 0.8vh;
}

.mt-wert-titel {
  font-size: 1.9vh;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--jg-muted);
}

.mt-wert-zahl {
  font-size: 14vh;
  font-weight: 800;
  line-height: 0.9;
  color: var(--jg-text);
  font-variant-numeric: tabular-nums;
}

.mt-wert-name {
  font-size: 3vh;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--jg-accent);
}

.mt-schnitte {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1vh 5vw;
  max-width: 70vw;
}

.mt-schnitte .mt-kicker {
  grid-column: 1 / -1;
  margin-bottom: 1vh;
}

.mt-schnitt-zeile {
  display: flex;
  justify-content: space-between;
  font-size: 3vh;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--jg-muted-strong);
}

.mt-schnitt-wert {
  color: var(--jg-text);
  font-variant-numeric: tabular-nums;
}

/* Folie: Heatmaps. Die Scheibe selbst (.heatmap) ist in App.css gestaltet. */

.mt-heatmaps {
  display: grid;
  gap: 3vh 3vw;
  align-content: start;
}

.mt-heatmaps-1,
.mt-heatmaps-2,
.mt-heatmaps-3,
.mt-heatmaps-5,
.mt-heatmaps-6 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.mt-heatmaps-4,
.mt-heatmaps-7,
.mt-heatmaps-8 {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.mt-heatmaps .heatmap {
  max-width: 26vh;
}

.mt-heatmaps-5 .heatmap,
.mt-heatmaps-6 .heatmap,
.mt-heatmaps-7 .heatmap,
.mt-heatmaps-8 .heatmap {
  max-width: 21vh;
}

.mt-heatkarte {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.6vh;
}

.mt-heatname {
  font-size: 2.8vh;
  font-weight: 700;
  text-transform: uppercase;
}

.mt-heatzahl {
  font-size: 1.8vh;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--jg-muted);
}

/* Folie: Aufwaermrunde */

.mt-aufwaermen {
  justify-content: center;
}

.mt-riesig {
  padding-top: 1.5vh;
  font-size: min(24vh, 13vw);
  font-weight: 800;
  line-height: 0.88;
  text-transform: uppercase;
}

.mt-hinweis {
  padding-top: 3vh;
  max-width: 55vw;
  font-family: var(--jg-font-body);
  font-size: 3vh;
  font-weight: 500;
  color: var(--jg-muted-strong);
}

/* Folie: Sieger */

.mt-sieger {
  justify-content: center;
}

/* Buchstabe fuer Buchstabe: BlurText setzt flex-wrap als Inline-Stil - ohne
   !important koennte ein Name mitten im Wort umbrechen. */
.mt-siegername {
  flex-wrap: nowrap !important;
  padding-top: 1.5vh;
  font-size: min(26vh, 14vw);
  font-weight: 800;
  line-height: 0.88;
  text-transform: uppercase;
}

.mt-siegerzeile {
  padding-top: 2vh;
  font-size: 3vh;
  font-weight: 700;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--jg-accent);
}

.mt-siegerwerte {
  display: flex;
  gap: 4vw;
  margin-top: 5vh;
}

.mt-siegerwert {
  display: flex;
  flex-direction: column;
  gap: 0.6vh;
  font-size: 2vh;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--jg-muted);
}

.mt-siegerwert-zahl {
  font-size: 9vh;
  font-weight: 800;
  line-height: 0.9;
  letter-spacing: 0;
  color: var(--jg-text);
  font-variant-numeric: tabular-nums;
}

.mt-podest {
  display: flex;
  gap: 4vw;
  margin-top: 5vh;
  font-size: 2.8vh;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--jg-muted-strong);
}

.mt-podest-nummer {
  margin-right: 1vw;
  color: var(--jg-muted);
}

.mt-podest-punkte {
  margin-left: 1vw;
  font-size: 0.8em;
  color: var(--jg-muted);
}

@media (prefers-reduced-motion: reduce) {
  .mt-roadmap-fuellung {
    transition: none;
  }
}
```

- [ ] **Step 4: Alte Matchtag-Abschnitte aus `App.css` entfernen**

```bash
cd F:/DEV/autodarts-screens && node -e "
const fs = require('fs');
const pfad = 'src/renderer/spectator/App.css';
let s = fs.readFileSync(pfad, 'utf8');
const vor = s.length;
function bisKommentar(anfangText, endeText) {
  const a = s.indexOf(anfangText);
  if (a < 0) throw new Error('Anfang fehlt: ' + anfangText);
  const e0 = s.indexOf(endeText, a);
  if (e0 < 0) throw new Error('Ende fehlt: ' + endeText);
  s = s.slice(0, a) + s.slice(s.lastIndexOf('/*', e0));
}
function bisRegel(anfangText, regelText) {
  const a = s.indexOf(anfangText);
  if (a < 0) throw new Error('Anfang fehlt: ' + anfangText);
  const e = s.indexOf(regelText, a);
  if (e < 0) throw new Error('Regel fehlt: ' + regelText);
  s = s.slice(0, a) + s.slice(e);
}
bisKommentar('/* ═══ Matchtag-Pausenbildschirm', 'Miss: ein Dart ausserhalb der Scheibe');
bisRegel('/* Matchtag: Statuszeile, Analyse, Heatmaps', '.heatmap {');
fs.writeFileSync(pfad, s);
console.log('entfernt:', vor - s.length, 'Zeichen');
" && grep -n "mt-\|bildschirm-matchtag" src/renderer/spectator/App.css; grep -n "^\.heatmap {\|^\.heat-kern" src/renderer/spectator/App.css
```

Expected:
- `entfernt: <Zahl über 15000> Zeichen`.
- Das erste `grep` gibt nichts aus.
- Das zweite `grep` findet `.heatmap {` und `.heat-kern circle {`. Beide bleiben, sie gestalten `shared/Heatmap.tsx`.

- [ ] **Step 5: Typprüfung, Tests, Build**

Run: `cd F:/DEV/autodarts-screens && npm run typecheck && npx vitest run 2>&1 | grep -E "Test Files|Tests " && npm run build 2>&1 | tail -1`
Expected: Typecheck ohne Fehler, `Tests  384 passed (384)`, `✓ built in …`.

- [ ] **Step 6: Sichtprüfung Matchtag**

Vite starten, dann per Playwright-MCP:

```js
async (page) => {
  const ziel = 'F:/DEV/autodarts-screens/.superpowers/pruefung';
  const basis = 'http://localhost:5260/spectator/index.html?vorfuehrung&schritt=0';
  const faelle = [
    ['mt-jetzt', '&mtfolie=0'], ['mt-tabelle', '&mtfolie=1'], ['mt-spielplan', '&mtfolie=2'],
    ['mt-statistik', '&mtfolie=3'], ['mt-analyse', '&mtfolie=4'], ['mt-heatmap', '&mtfolie=5'],
    ['mt-sieger', '&mtsieger&mtfolie=0'], ['mt-endstand', '&mtsieger&mtfolie=1'], ['mt-aufwaermen', '&mtaufwaermen'],
  ];
  await page.setViewportSize({ width: 1920, height: 1080 });
  const ergebnisse = [];
  for (const [name, param] of faelle) {
    await page.goto(basis + param);
    await page.waitForTimeout(4500);
    await page.screenshot({ path: `${ziel}/${name}-1080.png` });
    ergebnisse.push(await page.evaluate((n) => {
      const folie = document.querySelector('.kino-folie--ankommend .mt-folie');
      const kinder = folie ? [...folie.querySelectorAll('*')] : [];
      const unten = Math.max(0, ...kinder.map((k) => k.getBoundingClientRect().bottom));
      return {
        name: n,
        folie: !!folie,
        hell: !!document.querySelector('.kino--hell'),
        inhaltUnten: Math.round(unten),
        grenzeUnten: Math.round(innerHeight * 0.95),
        zahlen: [...document.querySelectorAll('.mt-wert-zahl, .mt-siegerwert-zahl')].map((z) => z.textContent),
      };
    }, name));
  }
  return ergebnisse;
}
```

Expected:
- `folie: true` in allen Fällen.
- `hell: true` nur bei `mt-sieger`. Bei `mt-endstand` steht `false`, denn dort läuft die Folie „Tabelle“ im beendeten Abend.
- `inhaltUnten ≤ grenzeUnten` in allen Fällen.
- `zahlen` bei `mt-statistik`: Endwerte mit fester Stellenzahl, z. B. `71.0`, `3`, `121`, `4`.

Screenshots mit dem Read-Werkzeug ansehen. Akzeptanz:
- **Kopf:** oben mittig dünne Linie mit Stationen und Statuszeile. Logo links, „● Spielpause“ rechts, keine Überlappung.
- **`mt-jetzt`:** grün „ALS NÄCHSTES“, darunter „MAREIKE“ riesig, „GEGEN“ klein, „KEVIN“ riesig. Rechts unten „DANACH“ mit Paarungen.
- **`mt-tabelle`:** Titel „TABELLE“ groß, Führungszeile(n) größer und mit grünem Strich links.
- **`mt-spielplan`:** zwei Spalten. Gespielte Partien grau mit Ergebnis, die nächste mit grünem Strich.
- **`mt-statistik`:** vier große Zahlen nebeneinander, grüne Namen darunter, darunter die Schnitt-Liste.
- **`mt-analyse`:** alle 11 Spalten lesbar, nichts abgeschnitten.
- **`mt-heatmap`:** Scheiben mit Namen darunter, nichts unter der Fortschrittslinie.
- **`mt-sieger`:** heller, grünerer Verlauf. Name riesig in einer Zeile, darunter Werte und Podest. Kein Konfetti, keine Strahlen.
- **`mt-endstand`:** Titel „ENDSTAND“, Siegerzeile größer mit grünem Strich.
- **`mt-aufwaermen`:** „AUFWÄRMRUNDE“ riesig, Hinweis darunter.

Zusätzlich in 4K (`3840×2160`) prüfen: `mt-jetzt`, `mt-tabelle` und `mt-sieger`, Dateinamen `…-4k.png`. Akzeptanz: gleiche Aufteilung.

Vite-Prozess beenden.

- [ ] **Step 7: Commit**

```bash
cd F:/DEV/autodarts-screens && git add src/renderer/spectator/Matchtag.tsx src/renderer/spectator/kino.css src/renderer/spectator/vorfuehrung.ts src/renderer/spectator/App.css && git commit -q -F - <<'EOF'
feat: Matchtag-Folien als Titelsequenz im Kino-Stil

Der Matchtag-Pausenbildschirm steht jetzt auf der KinoBuehne: Kopf mit
duenner Ablauflinie, jede Folie mit gruenem Kicker und grossem Titel,
linksbuendig. Als Naechstes mit riesigen Namen untereinander, Tabelle mit
hervorgehobener Fuehrung, Spielplan in zwei Spalten, Zahlen des Abends
hochzaehlend, Sieger Buchstabe fuer Buchstabe auf hellerem Verlauf -
Strahlen und Konfetti entfallen. Logik und Standzeiten unveraendert.
?mtaufwaermen zeigt die Aufwaermrunde. Alte Matchtag-Stile aus App.css
entfernt.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RTjz7GMwcw3FxwhhSJb8ea
EOF
```

---

### Task 4: Leistung prüfen und Doku

**Files:**
- Modify (nur wenn Step 1 es verlangt): `src/renderer/spectator/Vorspann.tsx`, `src/renderer/spectator/KinoBuehne.tsx`
- Modify: `THIRD-PARTY-LICENSES.md`
- Modify: `docs/ENTSCHEIDUNGEN.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: alles aus Task 1–3
- Produces: nichts für spätere Aufgaben

- [ ] **Step 1: Leistungsmessung (4K)**

Vite starten, dann per Playwright-MCP:

```js
async (page) => {
  const messen = async (url) => {
    await page.goto(url);
    await page.waitForTimeout(3000);
    return page.evaluate(() => new Promise((fertig) => {
      let bilder = 0;
      const lang = [];
      const po = new PerformanceObserver((liste) => liste.getEntries().forEach((e) => lang.push(Math.round(e.duration))));
      po.observe({ type: 'longtask', buffered: false });
      const start = performance.now();
      const zaehlen = () => {
        bilder++;
        if (performance.now() - start < 10000) requestAnimationFrame(zaehlen);
        else {
          po.disconnect();
          fertig({ bilderJeSekunde: Math.round(bilder / 10), langeAufgaben: lang.length, laengsteMs: Math.max(0, ...lang) });
        }
      };
      requestAnimationFrame(zaehlen);
    }));
  };
  await page.setViewportSize({ width: 3840, height: 2160 });
  const basis = 'http://localhost:5260/spectator/index.html?vorfuehrung&schritt=0';
  return {
    fotoFolie: await messen(basis + '&folie=0'),
    verlaufFolie: await messen(basis + '&folie=4'),
    matchtagTabelle: await messen(basis + '&mtfolie=1'),
  };
}
```

Expected in allen drei Messungen:
- `langeAufgaben ≤ 3` und `laengsteMs ≤ 200`.
- `bilderJeSekunde` wird nur notiert. Der Browser ohne Bildschirm rechnet WebGL in Software, siehe Spec, Abschnitt 8.

Falls die Grenzen überschritten werden:
1. In `Vorspann.tsx` das Filmkorn verkleinern: `<Noise patternAlpha={14} patternSize={384} stillstand={stillstand} />`, dann erneut messen.
2. Reicht das nicht, in `KinoBuehne.tsx` `maxDpr={0.35}` setzen und erneut messen.

Nur diese beiden Stellschrauben verwenden und die gewählten Werte im Commit nennen.

Vite-Prozess beenden.

- [ ] **Step 2: Versionen und Lizenzen der neuen Produktionspakete ermitteln**

```bash
cd F:/DEV/autodarts-screens && node -e "
const lock = require('./package-lock.json').packages;
const fs = require('fs');
for (const [pfad, p] of Object.entries(lock)) {
  if (!pfad || p.dev) continue;
  const name = pfad.replace(/^node_modules\//, '');
  if (!/^(motion|framer-motion|motion-dom|motion-utils|ogl|tslib)$/.test(name)) continue;
  const dateien = fs.readdirSync(pfad).filter((d) => /^licen[cs]e/i.test(d));
  const text = dateien[0] ? fs.readFileSync(pfad + '/' + dateien[0], 'utf8') : '';
  const zeile = text.split(/\r?\n/).find((z) => /copyright/i.test(z));
  const copyright = zeile ? zeile.trim() : '(keine Copyright-Zeile in der Lizenzdatei)';
  console.log('| ' + name + ' | ' + p.version + ' | ' + p.license + ' | ' + copyright + ' | \`' + pfad + '/' + (dateien[0] || '(keine Lizenzdatei)') + '\` |');
}
"
```

Expected: je eine fertige Tabellenzeile für mindestens `motion`, `framer-motion`, `motion-dom`, `motion-utils`, `ogl` und `tslib`.

- [ ] **Step 3: `THIRD-PARTY-LICENSES.md` ergänzen**

1. In der Tabelle unter „## Im Bauergebnis gebündelter Anwendungscode“ die Zeilen aus Step 2 **unverändert** direkt hinter der Zeile `| scheduler | … |` einfügen.
2. Direkt nach dem Absatz, der mit „`scheduler` ist keine direkte Abhängigkeit“ beginnt, einfügen:

```markdown
`framer-motion`, `motion-dom`, `motion-utils` und `tslib` sind keine direkten
Abhängigkeiten dieses Projekts, sondern Laufzeitabhängigkeiten von `motion`.

## Übernommener Quelltext aus React Bits

Unter `src/renderer/spectator/reactbits/` liegen angepasste Komponenten aus
React Bits (github.com/DavidHDev/react-bits, Commit
`3a1c7f2f9f94ed833934ab5c2635760b9e644583`): Grainient, BlurText, CountUp und
Noise. Sie stehen **nicht** unter der MIT-Lizenz dieses Repos, sondern unter
**MIT + Commons Clause**, Copyright (c) 2026 David Haz. Der Volltext liegt in
`src/renderer/spectator/reactbits/LICENSE.md`. Die Commons Clause erlaubt den
Einsatz als Teil einer Anwendung, verbietet aber, die Komponenten selbst zu
verkaufen, unterzulizenzieren oder einzeln weiterzugeben.
```

- [ ] **Step 4: `docs/ENTSCHEIDUNGEN.md` ergänzen**

Ans Dateiende anhängen:

```markdown

## Pausenscreen im Kino-Stil (unveröffentlicht)

**76. Pausenscreen mit React Bits statt nur CSS.** Vorspann und
Matchtag-Folien nutzen Grainient (WebGL über `ogl`), BlurText und CountUp
(beide `motion`) sowie Noise aus React Bits, als angepassten Quelltext in
`src/renderer/spectator/reactbits/`. Die Vorgabe „nur CSS“ aus 0.1.0-beta.2
gilt für diese beiden Bildschirme nicht mehr; Live-Match und Einblendungen
bleiben CSS. Die Komponenten stehen unter MIT + Commons Clause, nicht MIT wie
das Repo – eigene Lizenzdatei im Ordner. *Kosten bei Irrtum:* rund 200 KB
mehr im Bündel und eine WebGL-Fläche mit halber Auflösung, solange Pause ist;
ohne WebGL 2 steht ein CSS-Verlauf. Siehe
`docs/superpowers/specs/2026-09-13-pausenscreen-kino-design.md`.
```

- [ ] **Step 5: `CHANGELOG.md` ergänzen**

Direkt unter der Zeile `## [Unveröffentlicht]` einfügen, mit je einer Leerzeile davor und danach:

```markdown
### Geändert
- **Pausenscreen im Kino-Stil.** Vorspann und Matchtag-Folien auf dem
  Zuschauer-Screen sind neu gestaltet: Fotos mit langsamer Kamerafahrt, ein
  dunkler, fließender Verlauf mit Filmkorn, riesige Schrift, die aus der
  Unschärfe auftaucht. Der Matchtag erscheint als Titelsequenz – linksbündig,
  Namen groß, Zahlen zählen hoch
- Die Siegerfolie des Matchtags kommt ohne Strahlen und Konfetti aus; der
  Hintergrund wird dafür heller
- Folien blenden weich über statt zu fahren
- Im Layout „JGN Optimized" steht die Summe der Aufnahme im Vollbild in Grün,
  der Name darüber größer; „Am Wurf" liegt auf dunklem Grund mit grünem Namen

### Behoben
- Ein Miss steht in der Wurfleiste beider Player-Layouts rot
```

- [ ] **Step 6: Abschlussprüfung**

Run: `cd F:/DEV/autodarts-screens && npm run typecheck && npx vitest run 2>&1 | grep -E "Test Files|Tests " && npm run build 2>&1 | tail -1 && git status --short`

Expected:
- Typecheck ohne Fehler, `Tests  384 passed (384)`, `✓ built in …`.
- `git status` zeigt die drei Doku-Dateien. Hat Step 1 eine Stellschraube gebraucht, zusätzlich `Vorspann.tsx` und/oder `KinoBuehne.tsx`.

- [ ] **Step 7: Commit**

```bash
cd F:/DEV/autodarts-screens && git add THIRD-PARTY-LICENSES.md docs/ENTSCHEIDUNGEN.md CHANGELOG.md src/renderer/spectator/Vorspann.tsx src/renderer/spectator/KinoBuehne.tsx && git commit -q -F - <<'EOF'
docs: Fremdlizenzen, Entscheidung und Changelog zum Kino-Pausenscreen

motion (mit framer-motion, motion-dom, motion-utils, tslib) und ogl in
THIRD-PARTY-LICENSES.md, dazu der React-Bits-Ordner unter MIT + Commons
Clause. Entscheidung 76 hebt "nur CSS" fuer den Pausenscreen auf.
Changelog fuer den Kino-Pausenscreen und die Player-Farben.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RTjz7GMwcw3FxwhhSJb8ea
EOF
```
