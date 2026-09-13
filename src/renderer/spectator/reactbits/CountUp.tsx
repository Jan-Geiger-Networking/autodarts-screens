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
