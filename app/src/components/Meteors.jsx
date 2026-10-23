/**
 * Meteors — Magic UI meteor shower effect for hero sections.
 * Renders animated diagonal streaks across a container.
 */
import { useMemo } from 'react';
import './Meteors.css';

export default function Meteors({ count = 14 }) {
  const meteors = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 6}s`,
      duration: `${3 + Math.random() * 5}s`,
      size: `${1 + Math.random() * 1.5}px`,
      opacity: 0.4 + Math.random() * 0.4,
    })), [count]);

  return (
    <div className="meteors-wrap" aria-hidden="true">
      {meteors.map(m => (
        <span
          key={m.id}
          className="meteor"
          style={{
            left: m.left,
            animationDelay: m.delay,
            animationDuration: m.duration,
            width: m.size,
            opacity: m.opacity,
          }}
        />
      ))}
    </div>
  );
}
