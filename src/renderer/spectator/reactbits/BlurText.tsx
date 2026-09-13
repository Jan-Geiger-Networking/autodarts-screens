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
      (reduziert
        ? { opacity: 0 }
        : direction === 'top'
          ? { filter: 'blur(10px)', opacity: 0, y: -50 }
          : { filter: 'blur(10px)', opacity: 0, y: 50 }) as Record<string, string | number>,
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
            initial={fromSnapshot as unknown as TargetAndTransition}
            animate={(inView ? animateKeyframes : fromSnapshot) as unknown as TargetAndTransition}
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
