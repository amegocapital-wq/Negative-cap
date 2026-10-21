/** Small shared UI primitives. */

import type { ReactNode } from 'react';

export function ScoreRing({ score, size = 52 }: { score: number; size?: number }) {
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * circumference;
  const color = score >= 74 ? '#c8ff4d' : score >= 60 ? '#a7e85f' : score >= 44 ? '#ffb340' : '#6d6d7c';

  return (
    <div className="score-ring" style={{ width: size, height: size }} aria-label={`Score ${score} out of 100`}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.09)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div className="score-ring-label">
        <div className="score-ring-num" style={{ color }}>
          {score}
        </div>
        <div className="score-ring-sub">score</div>
      </div>
    </div>
  );
}

export function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div className="bar-row">
      <span>{label}</span>
      <span className="bar-track">
        <span className="bar-fill" style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
      </span>
      <span className="mono" style={{ textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-head">
      <span className="section-title">{title}</span>
      {action}
    </div>
  );
}

export function Empty({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-art">{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 640, color: 'var(--text)' }}>{title}</div>
      <div className="small" style={{ maxWidth: 38 + 'ch' }}>
        {body}
      </div>
      {action}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="toggle"
      onClick={() => onChange(!checked)}
    />
  );
}

export function Stepper({
  value,
  min = 1,
  max = 10,
  onChange,
  label,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  label: string;
}) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Fewer">
        −
      </button>
      <span className="stepper-value">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="More">
        +
      </button>
    </div>
  );
}

export function Notice({ children, tone = 'warn' }: { children: ReactNode; tone?: 'warn' | 'error' }) {
  return <div className={`notice ${tone === 'error' ? 'notice-error' : ''}`}>{children}</div>;
}
