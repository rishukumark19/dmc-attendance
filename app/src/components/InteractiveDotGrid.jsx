import React, { useEffect, useRef } from 'react';

/**
 * InteractiveDotGrid — Light Mode Constellation & Particle Graph Network
 * Implements the 3-layer architecture:
 * 1. Base ambient radial gradients (soft cyan, civic blue, warm amber).
 * 2. Constellation / Particle Node Network (65 drifting particles with link distance, proximity physics, and triangle meshes).
 * 3. Interactive Cursor Spotlight (radial glow following mouse cursor brightening nearby nodes).
 */
export default function InteractiveDotGrid({
  particleCount = 65,
  linkDistance = 125,
  cursorGrabDistance = 165,
  gridSpacing = 36,
  dotRadius = 1.3,
  dotColor = 'rgba(100, 116, 139, 0.16)',
  nodeColor = '#2563eb', // Civic Blue in light mode
  accentColor = '#0284c7', // Sky Cyan
  className = '',
}) {
  const canvasRef = useRef(null);
  const mouseRef = useRef({
    x: -1000,
    y: -1000,
    targetX: -1000,
    targetY: -1000,
    active: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    
    // ─────────────────────────────────────────────────────────────
    // Background Architectural Dot Grid with Magnetic Liquid Physics
    // ─────────────────────────────────────────────────────────────
    let gridDots = [];
    function initGrid() {
      gridDots = [];
      const cols = Math.ceil(width / gridSpacing);
      const rows = Math.ceil(height / gridSpacing);
      const startX = (width % gridSpacing) / 2;
      const startY = (height % gridSpacing) / 2;

      for (let c = 0; c <= cols; c++) {
        const gx = startX + c * gridSpacing;
        for (let r = 0; r <= rows; r++) {
          const gy = startY + r * gridSpacing;
          gridDots.push({
            originX: gx,
            originY: gy,
            x: gx,
            y: gy,
            vx: 0,
            vy: 0,
          });
        }
      }
    }

    function resize() {
      if (!canvas) return;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
      initGrid();
    }
    resize();
    window.addEventListener('resize', resize);

    const handleMouseMove = (e) => {
      mouseRef.current.targetX = e.clientX;
      mouseRef.current.targetY = e.clientY;
      mouseRef.current.active = true;

      // Update CSS variables for container spotlight
      document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
      document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    // ─────────────────────────────────────────────────────────────
    // Constellation Graph Particles (drifting slowly with serene ambient speed)
    // ─────────────────────────────────────────────────────────────
    const particles = Array.from({ length: particleCount }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.12 + Math.random() * 0.16; // calm, tranquil ambient drift
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        originX: 0,
        originY: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 1.8 + Math.random() * 1.4,
        baseColor: Math.random() > 0.4 ? nodeColor : accentColor,
      };
    });

    // Wandering anchor nodes with concentric halo rings (slow ambient velocity)
    const anchorNodes = Array.from({ length: 6 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.07 + Math.random() * 0.09; // slow and majestic
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 3.8,
        haloRadius: 13,
        color: nodeColor,
      };
    });

    let pulse = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      pulse += 0.035;

      const mouse = mouseRef.current;
      if (mouse.active) {
        if (mouse.x === -1000) {
          mouse.x = mouse.targetX;
          mouse.y = mouse.targetY;
        } else {
          mouse.x += (mouse.targetX - mouse.x) * 0.2;
          mouse.y += (mouse.targetY - mouse.y) * 0.2;
        }
      }

      // ─────────────────────────────────────────────────────────────
      // 1. INTERACTIVE CURSOR SPOTLIGHT (Radial illumination)
      // ─────────────────────────────────────────────────────────────
      if (mouse.active && mouse.x > 0 && mouse.y > 0) {
        const spotlight = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 460);
        spotlight.addColorStop(0, 'rgba(37, 99, 235, 0.08)');
        spotlight.addColorStop(0.35, 'rgba(56, 189, 248, 0.04)');
        spotlight.addColorStop(0.7, 'rgba(37, 99, 235, 0.015)');
        spotlight.addColorStop(1, 'transparent');
        ctx.fillStyle = spotlight;
        ctx.fillRect(0, 0, width, height);
      }

      // ─────────────────────────────────────────────────────────────
      // 2. BACKGROUND DOT GRID (Anchor in place with subtle micro-shift on hover)
      // ─────────────────────────────────────────────────────────────
      const hoverRadius = 130;
      const subtleMaxShift = 3.2; // Keep at their place, very subtle 2-3px micro-shift

      gridDots.forEach((dot) => {
        let targetShiftX = 0;
        let targetShiftY = 0;
        let proximity = 0;

        if (mouse.active && mouse.x > 0 && mouse.y > 0) {
          const dx = mouse.x - dot.originX;
          const dy = mouse.y - dot.originY;
          const distSq = dx * dx + dy * dy;

          if (distSq < hoverRadius * hoverRadius) {
            const dist = Math.sqrt(distSq);
            proximity = 1 - dist / hoverRadius;

            // Smooth cosine / smoothstep micro-shift
            const smoothShift = Math.sin((proximity * Math.PI) / 2);

            if (dist > 0.001) {
              targetShiftX = (dx / dist) * smoothShift * subtleMaxShift;
              targetShiftY = (dy / dist) * smoothShift * subtleMaxShift;
            }
          }
        }

        // Soft, gentle spring interpolation to the micro-shift target
        const targetX = dot.originX + targetShiftX;
        const targetY = dot.originY + targetShiftY;

        const forceX = (targetX - dot.x) * 0.1;
        const forceY = (targetY - dot.y) * 0.1;

        dot.vx = (dot.vx + forceX) * 0.78;
        dot.vy = (dot.vy + forceY) * 0.78;

        dot.x += dot.vx;
        dot.y += dot.vy;

        // Keep dots circular and stable at their places, with gentle brightening & subtle size swell
        const currentRadius = dotRadius + proximity * 0.8; // subtle swell from 1.3 to ~2.1px
        const currentAlpha = 0.16 + proximity * 0.45; // subtle brightening

        ctx.fillStyle = proximity > 0.2 ? `rgba(37, 99, 235, ${currentAlpha})` : `rgba(100, 116, 139, ${currentAlpha})`;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, currentRadius, 0, Math.PI * 2);
        ctx.fill();
      });

      // ─────────────────────────────────────────────────────────────
      // 3. UPDATE & DRIFT PARTICLES (Gentle slow attraction, no rushing to center)
      // ─────────────────────────────────────────────────────────────
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around viewport edges
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;

        // Ultra-gentle proximity physics with mouse (keeps particles floating gracefully)
        if (mouse.active) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.hypot(dx, dy);

          if (dist < cursorGrabDistance && dist > 0) {
            // Very slow, soft pull (0.05 instead of 0.35) so they don't rush to center
            const pull = Math.pow(1 - dist / cursorGrabDistance, 2) * 0.06;
            p.vx += (dx / dist) * pull;
            p.vy += (dy / dist) * pull;
          }
        }

        // Viscous speed damping back to calm natural drift
        const curSpeed = Math.hypot(p.vx, p.vy);
        const naturalMaxSpeed = 0.22;
        if (curSpeed > naturalMaxSpeed) {
          p.vx *= 0.94;
          p.vy *= 0.94;
        }
      });

      // Update anchor nodes
      anchorNodes.forEach((node) => {
        node.x += node.vx;
        node.y += node.vy;

        if (node.x < -20) node.x = width + 20;
        if (node.x > width + 20) node.x = -20;
        if (node.y < -20) node.y = height + 20;
        if (node.y > height + 20) node.y = -20;
      });

      // ─────────────────────────────────────────────────────────────
      // 4. DRAW CONSTELLATION EDGES (Particle-to-Particle Links)
      // ─────────────────────────────────────────────────────────────
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);

          if (dist < linkDistance) {
            const edgeAlpha = (1 - dist / linkDistance) * 0.28;

            // Brighten edge if near cursor
            let extraGlow = 0;
            if (mouse.active) {
              const midX = (p1.x + p2.x) / 2;
              const midY = (p1.y + p2.y) / 2;
              const dCursor = Math.hypot(mouse.x - midX, mouse.y - midY);
              if (dCursor < 160) {
                extraGlow = (1 - dCursor / 160) * 0.35;
              }
            }

            ctx.strokeStyle = `rgba(37, 99, 235, ${edgeAlpha + extraGlow})`;
            ctx.lineWidth = extraGlow > 0 ? 1.3 : 1;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      // ─────────────────────────────────────────────────────────────
      // 5. INTERACTIVE CURSOR GRAB LINKS & TRIANGLE (Only a couple strings attached at a time)
      // ─────────────────────────────────────────────────────────────
      let grabbedParticles = [];
      if (mouse.active && mouse.x > 0 && mouse.y > 0) {
        particles.forEach((p) => {
          const dist = Math.hypot(mouse.x - p.x, mouse.y - p.y);
          if (dist < cursorGrabDistance) {
            const grabFactor = 1 - dist / cursorGrabDistance;
            grabbedParticles.push({ particle: p, dist, grabFactor });
          }
        });

        // Sort by distance and only keep the closest 2 (or at most 3) particles
        grabbedParticles.sort((a, b) => a.dist - b.dist);
        grabbedParticles = grabbedParticles.slice(0, 2);

        // Draw strings for only this couple of attached particles
        grabbedParticles.forEach((g) => {
          ctx.strokeStyle = `rgba(37, 99, 235, ${g.grabFactor * 0.5})`;
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.moveTo(mouse.x, mouse.y);
          ctx.lineTo(g.particle.x, g.particle.y);
          ctx.stroke();
        });

        // Form closed triangle mesh if both of the 2 attached particles are within link distance
        if (grabbedParticles.length === 2) {
          const g1 = grabbedParticles[0];
          const g2 = grabbedParticles[1];
          const d12 = Math.hypot(g1.particle.x - g2.particle.x, g1.particle.y - g2.particle.y);

          if (d12 < linkDistance * 1.25) {
            const triangleIntensity = (g1.grabFactor + g2.grabFactor) / 2;

            // Translucent light blue triangle wash
            ctx.fillStyle = `rgba(37, 99, 235, ${triangleIntensity * 0.08})`;
            ctx.beginPath();
            ctx.moveTo(mouse.x, mouse.y);
            ctx.lineTo(g1.particle.x, g1.particle.y);
            ctx.lineTo(g2.particle.x, g2.particle.y);
            ctx.closePath();
            ctx.fill();

            // Stroke outer edge between g1 and g2
            ctx.strokeStyle = `rgba(2, 132, 199, ${triangleIntensity * 0.35})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(g1.particle.x, g1.particle.y);
            ctx.lineTo(g2.particle.x, g2.particle.y);
            ctx.stroke();
          }
        }
      }

      // ─────────────────────────────────────────────────────────────
      // 6. DRAW CONSTELLATION PARTICLES (Nodes)
      // ─────────────────────────────────────────────────────────────
      particles.forEach((p) => {
        let size = p.radius;
        let color = p.baseColor;
        let glow = 0;

        if (mouse.active) {
          const dist = Math.hypot(mouse.x - p.x, mouse.y - p.y);
          if (dist < cursorGrabDistance) {
            const factor = 1 - dist / cursorGrabDistance;
            size = p.radius + factor * 2;
            color = '#2563eb';
            glow = factor * 10;
          }
        }

        ctx.fillStyle = color;
        if (glow > 0) {
          ctx.shadowColor = 'rgba(37, 99, 235, 0.5)';
          ctx.shadowBlur = glow;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // ─────────────────────────────────────────────────────────────
      // 7. DRAW WANDERING ANCHOR NODES WITH CONCENTRIC GLOW HALOS
      // ─────────────────────────────────────────────────────────────
      anchorNodes.forEach((node) => {
        const dynamicHalo = node.haloRadius + Math.sin(pulse + node.x) * 2;

        // Outer translucent aura
        ctx.fillStyle = 'rgba(37, 99, 235, 0.08)';
        ctx.beginPath();
        ctx.arc(node.x, node.y, dynamicHalo + 5, 0, Math.PI * 2);
        ctx.fill();

        // Concentric halo ring
        ctx.strokeStyle = 'rgba(37, 99, 235, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(node.x, node.y, dynamicHalo, 0, Math.PI * 2);
        ctx.stroke();

        // Core solid node
        ctx.fillStyle = node.color;
        ctx.shadowColor = 'rgba(37, 99, 235, 0.4)';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // ─────────────────────────────────────────────────────────────
      // 8. CURSOR TARGET NODE (Small glowing ring & dot)
      // ─────────────────────────────────────────────────────────────
      if (mouse.active && mouse.x > 0 && mouse.y > 0) {
        const cursorRing = 12 + Math.sin(pulse * 2) * 1.5;

        // Outer ring
        ctx.strokeStyle = 'rgba(37, 99, 235, 0.65)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, cursorRing, 0, Math.PI * 2);
        ctx.stroke();

        // Core dot
        ctx.fillStyle = '#2563eb';
        ctx.shadowColor = 'rgba(37, 99, 235, 0.6)';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 3.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [particleCount, linkDistance, cursorGrabDistance, gridSpacing, dotRadius, dotColor, nodeColor, accentColor]);

  return (
    <canvas
      ref={canvasRef}
      className={`interactive-dot-grid-canvas ${className}`}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 1,
      }}
      aria-hidden="true"
    />
  );
}
