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
//  - Scheitert WebGL beim Anlegen, bleibt die Flaeche leer statt zu werfen.

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

    let renderer: InstanceType<typeof Renderer>;
    try {
      renderer = new Renderer({
        webgl: 2,
        alpha: true,
        antialias: false,
        dpr: Math.min(window.devicePixelRatio || 1, maxDpr)
      });
    } catch {
      // Kein Kontext zu bekommen (this.gl bleibt null) laesst ogl im
      // Konstruktor werfen ('this.gl.renderer = this' auf null) - Flaeche
      // bleibt dann einfach leer, statt die React-Wurzel zu leeren.
      return;
    }
    if (!renderer.isWebgl2) return; // Shader brauchen WebGL 2 (#version 300 es)

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

    if (!program.uniformLocations) {
      // Linken gescheitert - ogl setzt uniformLocations nur bei Erfolg
      // (Program.js/setShaders bricht bei LINK_STATUS false vorher ab).
      // Ohne diese Pruefung wuerde program.use() gleich darauf auf
      // undefined.forEach() werfen. Flaeche bleibt leer statt zu werfen.
      try {
        container.removeChild(canvas);
      } catch {
        /* bereits entfernt */
      }
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return;
    }

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

    // Der Kontext kann im Betrieb verloren gehen (Treiberwechsel, zu viele
    // Kontexte offen). Ohne dies liefe die Schleife nutzlos gegen einen
    // toten Kontext weiter.
    const onContextLost = () => tryStop();
    canvas.addEventListener('webglcontextlost', onContextLost);

    tryStart();

    return () => {
      tryStop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onContextLost);
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
