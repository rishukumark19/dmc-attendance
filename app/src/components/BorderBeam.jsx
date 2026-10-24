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
  colorFrom = 'rgba(16, 185, 129, 0.45)',
  colorTo = 'rgba(255, 255, 255, 0.8)',
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
