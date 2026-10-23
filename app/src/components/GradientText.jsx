/**
 * GradientText — Magic UI animated gradient text label.
 */
import './GradientText.css';

export default function GradientText({ children, className = '', colors = ['#e8761a', '#2563a8', '#138808', '#e8761a'] }) {
  const gradient = `linear-gradient(90deg, ${colors.join(', ')})`;
  return (
    <span
      className={`gradient-text ${className}`}
      style={{ '--gt-gradient': gradient, '--gt-size': `${colors.length * 100}%` }}
    >
      {children}
    </span>
  );
}
