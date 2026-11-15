import type { ReactNode } from 'react';
import type { MoisturePoint } from '../types';

export function Icon({ d, children }: { d?: string; children?: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="ico" aria-hidden="true">
      {d && <path d={d} />}
      {children}
    </svg>
  );
}

export function Segmented<T extends string>({
  options, value, onChange, small, className = '',
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  small?: boolean;
  className?: string;
}) {
  return (
    <div className={`seg ${small ? 'small' : ''} ${className}`} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          className={`seg-btn ${o.value === value ? 'active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Sparkline({ series }: { series: MoisturePoint[] }) {
  const W = 160, H = 48, pad = 4;
  const vals = series.map((p) => p.value);
  const min = Math.min(...vals) - 0.01;
  const max = Math.max(...vals) + 0.01;
  const pts = vals.map((v, i) => [
    pad + (i / (vals.length - 1)) * (W - 2 * pad),
    H - pad - ((v - min) / (max - min)) * (H - 2 * pad),
  ]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  const last = pts[pts.length - 1];
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-label="Umidade nos últimos 30 dias">
      <path d={`${line} L${last[0]},${H} L${pts[0][0]},${H} Z`} fill="#2f6b45" opacity=".12" />
      <path d={line} fill="none" stroke="#2f6b45" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="3" fill="#e4572e" />
    </svg>
  );
}

export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="sheet" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet-body">
        <button className="icon-btn sheet-close" onClick={onClose} aria-label="Fechar">
          <Icon d="M6 6l12 12M18 6L6 18" />
        </button>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="empty">
      <span className="empty-icon">{icon}</span>
      <b>{title}</b>
      <p>{text}</p>
    </div>
  );
}

/** Título numerado de cada passo (1, 2, 3) */
export function StepTitle({ n, title, sub }: { n: number; title: string; sub?: string }) {
  return (
    <div className="step-title">
      <span className="step-n">{n}</span>
      <div>
        <h2>{title}</h2>
        {sub && <span className="step-sub">{sub}</span>}
      </div>
    </div>
  );
}
