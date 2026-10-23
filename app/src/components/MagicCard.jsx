/**
 * MagicCard — Aceternity/Magic UI inspired mouse-tracking gradient glow.
 * Wrap any card content with this for a premium interactive feel.
 */
import { useRef, useState } from 'react';
import './MagicCard.css';

export default function MagicCard({ children, className = '', gradientColor = 'rgba(30,74,122,0.25)' }) {
  const cardRef = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  function handleMouseMove(e) {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  return (
    <div
      ref={cardRef}
      className={`magic-card ${className}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Mouse-following glow spotlight */}
      <div
        className="magic-spotlight"
        style={{
          left: pos.x,
          top: pos.y,
          opacity: hovered ? 1 : 0,
          background: `radial-gradient(350px circle at center, ${gradientColor}, transparent 70%)`,
        }}
      />
      <div className="magic-card-inner">{children}</div>
    </div>
  );
}
