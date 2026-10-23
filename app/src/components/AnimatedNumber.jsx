import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

/**
 * AnimatedNumber — GSAP-powered counter that animates from 0 to value on mount.
 * @param {number|string} value  — The target value (numbers only for animation)
 * @param {string}        prefix — e.g. '₹'
 * @param {string}        suffix — e.g. 'h'
 * @param {number}        decimals — decimal places
 * @param {number}        duration — seconds
 */
export default function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 0, duration = 1.2 }) {
  const elRef = useRef(null);
  const objRef = useRef({ val: 0 });

  useEffect(() => {
    const numVal = parseFloat(value);
    if (isNaN(numVal)) {
      if (elRef.current) elRef.current.textContent = prefix + value + suffix;
      return;
    }

    const obj = objRef.current;
    obj.val = 0;

    const tween = gsap.to(obj, {
      val: numVal,
      duration,
      ease: 'power3.out',
      onUpdate: () => {
        if (elRef.current) {
          const display = decimals > 0
            ? obj.val.toFixed(decimals)
            : Math.round(obj.val).toLocaleString('en-IN');
          elRef.current.textContent = prefix + display + suffix;
        }
      },
    });

    return () => tween.kill();
  }, [value, prefix, suffix, decimals, duration]);

  return <span ref={elRef}>{prefix + '0' + suffix}</span>;
}
