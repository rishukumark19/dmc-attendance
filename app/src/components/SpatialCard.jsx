import React, { useRef, useState } from 'react';
import { motion, useSpring, useMotionValue, useTransform } from 'framer-motion';
import './SpatialCard.css';

/**
 * SpatialCard — VisionOS / Spatial Computing 3D interactive tilt & specular glint.
 * Blends seamlessly with Neumorphic surfaces to provide tangible depth and light refraction.
 */
export default function SpatialCard({
  children,
  className = '',
  style = {},
  maxTilt = 6,
  depth = 8,
  enableGlint = true,
  onClick,
}) {
  const cardRef = useRef(null);
  const [hovered, setHovered] = useState(false);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);

  // Smooth springs for VisionOS weightless inertia
  const rotateX = useSpring(rawY, { stiffness: 220, damping: 22 });
  const rotateY = useSpring(rawX, { stiffness: 220, damping: 22 });

  const [glintPos, setGlintPos] = useState({ x: 50, y: 50 });

  function handleMouseMove(e) {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const xPct = (mouseX / rect.width) - 0.5;
    const yPct = (mouseY / rect.height) - 0.5;

    rawX.set(xPct * maxTilt);
    rawY.set(-yPct * maxTilt);

    setGlintPos({
      x: Math.round((mouseX / rect.width) * 100),
      y: Math.round((mouseY / rect.height) * 100),
    });
  }

  function handleMouseEnter() {
    setHovered(true);
  }

  function handleMouseLeave() {
    setHovered(false);
    rawX.set(0);
    rawY.set(0);
  }

  return (
    <div
      style={{ perspective: 1200 }}
      className={`spatial-viewport ${className}`}
      onClick={onClick}
    >
      <motion.div
        ref={cardRef}
        className="spatial-card"
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
          ...style,
        }}
      >
        {enableGlint && (
          <div
            className="spatial-glint-surface"
            style={{
              opacity: hovered ? 1 : 0,
              background: `radial-gradient(380px circle at ${glintPos.x}% ${glintPos.y}%, rgba(255, 255, 255, 0.45), transparent 70%)`,
            }}
          />
        )}
        <div className="spatial-content-layer" style={{ transform: `translateZ(${depth}px)` }}>
          {children}
        </div>
      </motion.div>
    </div>
  );
}
