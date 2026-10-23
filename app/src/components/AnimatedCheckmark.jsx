import React from 'react';
import { motion } from 'framer-motion';

export default function AnimatedCheckmark({ size = 48, color = '#16a34a', strokeWidth = 3 }) {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 52 52"
      className="animated-checkmark-svg"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
    >
      {/* Outer Circle */}
      <motion.circle
        cx="26"
        cy="26"
        r="24"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      />
      {/* Inner Checkmark Path */}
      <motion.path
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth + 0.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 27l8 8 16-16"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.35, delay: 0.25, ease: 'easeOut' }}
      />
    </motion.svg>
  );
}
