import confetti from 'canvas-confetti';

// ── Physics-Based Spring Curves (Meta Engineering standards) ──
export const springPhysics = {
  // Snappy for buttons & interactive elements
  snappy: { type: 'spring', stiffness: 450, damping: 28 },
  // Smooth for modals, dialogs, cards
  smooth: { type: 'spring', stiffness: 300, damping: 26 },
  // Gentle for floating elements & subtle reveals
  gentle: { type: 'spring', stiffness: 180, damping: 20 },
  // Bouncy for delight badges
  bouncy: { type: 'spring', stiffness: 500, damping: 15 },
};

// ── Gesture Presets ──
export const buttonPress = {
  whileHover: { scale: 1.02, transition: springPhysics.snappy },
  whileTap: { scale: 0.96, transition: springPhysics.snappy },
};

export const cardHover = {
  whileHover: { y: -4, transition: springPhysics.smooth },
};

// ── Delight Particles: Celebration Confetti Burst ──
export function triggerCelebration(originX = 0.5, originY = 0.6) {
  // Tricolor + gold palette
  const colors = ['#e8761a', '#ffffff', '#138808', '#2563eb', '#fbbf24'];

  confetti({
    particleCount: 50,
    angle: 60,
    spread: 55,
    origin: { x: originX - 0.1, y: originY },
    colors,
  });
  confetti({
    particleCount: 50,
    angle: 120,
    spread: 55,
    origin: { x: originX + 0.1, y: originY },
    colors,
  });
}
