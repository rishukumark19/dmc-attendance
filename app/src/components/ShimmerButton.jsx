/**
 * ShimmerButton — Aceternity/Magic UI shimmer sweep on premium CTAs.
 * Used for Check In / Check Out buttons.
 */
import { motion } from 'framer-motion';
import './ShimmerButton.css';

export default function ShimmerButton({
  children,
  onClick,
  disabled,
  className = '',
  shimmerColor = 'rgba(255,255,255,0.4)',
  background = 'linear-gradient(145deg, #15803d, #166534)',
  shadow = '0 0 24px rgba(21,128,61,0.45)',
}) {
  return (
    <motion.button
      className={`shimmer-btn ${className}`}
      onClick={onClick}
      disabled={disabled}
      style={{ '--shimmer-color': shimmerColor, '--btn-bg': background, '--btn-shadow': shadow }}
      whileTap={{ scale: 0.95 }}
      whileHover={!disabled ? { scale: 1.02 } : {}}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
    >
      <span className="shimmer-sweep" />
      <span className="shimmer-content">{children}</span>
    </motion.button>
  );
}
