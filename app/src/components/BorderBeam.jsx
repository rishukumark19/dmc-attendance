/**
 * BorderBeam — Magic UI inspired rotating conic-gradient border.
 * Wraps any element with an animated glowing border.
 */
import './BorderBeam.css';

export default function BorderBeam({
  children,
  className = '',
  size = 200,
  duration = 12,
  colorFrom = '#e8761a',
  colorTo = '#1e4a7a',
}) {
  return (
    <div
      className={`border-beam-wrap ${className}`}
      style={{
        '--beam-size': `${size}px`,
        '--beam-duration': `${duration}s`,
        '--beam-from': colorFrom,
        '--beam-to': colorTo,
      }}
    >
      <div className="border-beam-anim" />
      <div className="border-beam-inner">{children}</div>
    </div>
  );
}
