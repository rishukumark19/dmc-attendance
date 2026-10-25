import React, { useRef, useState, useEffect } from 'react';
import './HeroAmbientGlow.css';

/**
 * HeroAmbientGlow
 * Replicates the hero stage ambient floating glow and cursor-responsive parallax:
 * - Floating blurred radial-gradient glow element using smooth CSS keyframe animation.
 * - Dynamic mouse parallax hover effect that tracks and shifts slightly with cursor position.
 * - Soft specular sheen overlay for realistic glass/light depth.
 */
export default function HeroAmbientGlow({
  children,
  className = '',
  glowColor = 'rgba(59, 130, 246, 0.35)', // Electric Civic Blue
  secondaryGlowColor = 'rgba(45, 212, 191, 0.25)', // Teal / Emerald
  size = 420,
  blur = 60,
  enableParallax = true,
  enableSheen = true,
}) {
  const stageRef = useRef(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!enableParallax) return;

    const handleMouseMove = (e) => {
      if (!stageRef.current) return;
      const rect = stageRef.current.getBoundingClientRect();
      // Calculate normalized mouse position (-0.5 to 0.5)
      const mouseX = (e.clientX - rect.left) / rect.width - 0.5;
      const mouseY = (e.clientY - rect.top) / rect.height - 0.5;

      // Parallax shift distance
      const shiftX = mouseX * 36;
      const shiftY = mouseY * 36;

      setOffset({ x: shiftX, y: shiftY });
    };

    const handleMouseLeave = () => {
      setOffset({ x: 0, y: 0 });
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [enableParallax]);

  return (
    <div ref={stageRef} className={`s1-hero-stage ${className}`}>
      {/* ── Ambient Radial Gradient Glow with Float Animation & Parallax ── */}
      <div
        className="s1-hero-stage__ambient-glow"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          filter: `blur(${blur}px)`,
          background: `radial-gradient(circle, ${glowColor} 0%, ${secondaryGlowColor} 45%, rgba(0, 0, 0, 0) 72%)`,
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
        }}
        aria-hidden="true"
      />

      {/* ── Secondary Subtle Floating Glow Orb for Organic Motion ── */}
      <div
        className="s1-hero-stage__secondary-glow"
        style={{
          width: `${size * 0.75}px`,
          height: `${size * 0.75}px`,
          filter: `blur(${blur * 1.1}px)`,
          background: `radial-gradient(circle, ${secondaryGlowColor} 0%, rgba(0, 0, 0, 0) 68%)`,
          transform: `translate3d(${-offset.x * 0.7}px, ${-offset.y * 0.7}px, 0)`,
        }}
        aria-hidden="true"
      />

      {/* ── Light Sheen / Specular Overlay ── */}
      {enableSheen && <div className="s1-hero-stage__sheen" aria-hidden="true" />}

      {/* ── Stage Content ── */}
      <div className="s1-hero-stage__content">
        {children}
      </div>
    </div>
  );
}
