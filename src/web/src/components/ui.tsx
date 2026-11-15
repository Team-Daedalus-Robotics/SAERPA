import type { ReactNode } from 'react';
import type { MoisturePoint } from '../types';
import { Icone, type NomeDeIcone } from './icones';

export function Icon({ caminho, children }: { caminho?: string; children?: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="ico" aria-hidden="true">
      {caminho && <path d={caminho} />}
      {children}
    </svg>
  );
}

export function Segmented<T extends string>({
  options, value, onChange, small, className = '',
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (valor: T) => void;
  small?: boolean;
  className?: string;
}) {
  return (
    <div className={`seg ${small ? 'small' : ''} ${className}`} role="tablist">
      {options.map((opcao) => (
        <button
          key={opcao.value}
          role="tab"
          aria-selected={opcao.value === value}
          className={`seg-btn ${opcao.value === value ? 'active' : ''}`}
          onClick={() => onChange(opcao.value)}
        >
          {opcao.label}
        </button>
      ))}
    </div>
  );
}

export function Sparkline({ series }: { series: MoisturePoint[] }) {
  const largura = 160, altura = 48, margem = 4;
  const valores = series.map((ponto) => ponto.value);
  const minimo = Math.min(...valores) - 0.01;
  const maximo = Math.max(...valores) + 0.01;
  const pontos = valores.map((valor, indice) => [
    margem + (indice / (valores.length - 1)) * (largura - 2 * margem),
    altura - margem - ((valor - minimo) / (maximo - minimo)) * (altura - 2 * margem),
  ]);
  const linha = pontos.map((ponto, indice) => `${indice ? 'L' : 'M'}${ponto[0].toFixed(1)},${ponto[1].toFixed(1)}`).join('');
  const ultimoPonto = pontos[pontos.length - 1];
  return (
    <svg className="spark" viewBox={`0 0 ${largura} ${altura}`} preserveAspectRatio="none" aria-label="Umidade nos últimos 30 dias">
      <path d={`${linha} L${ultimoPonto[0]},${altura} L${pontos[0][0]},${altura} Z`} fill="#2f6b45" opacity=".12" />
      <path d={linha} fill="none" stroke="#2f6b45" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
      <circle cx={ultimoPonto[0]} cy={ultimoPonto[1]} r="3" fill="#1b7f45" />
    </svg>
  );
}

export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="sheet" onClick={(evento) => evento.target === evento.currentTarget && onClose()}>
      <div className="sheet-body">
        <button className="icon-btn sheet-close" onClick={onClose} aria-label="Fechar">
          <Icon caminho="M6 6l12 12M18 6L6 18" />
        </button>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ icone, title, text }: { icone: NomeDeIcone; title: string; text: string }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icone nome={icone} tamanho={26} /></span>
      <b>{title}</b>
      <p>{text}</p>
    </div>
  );
}

/** Título numerado de cada passo (1, 2, 3) */
export function StepTitle({ numero, title, subtitulo }: { numero: number; title: string; subtitulo?: string }) {
  return (
    <div className="step-title">
      <span className="step-n">{numero}</span>
      <div>
        <h2>{title}</h2>
        {subtitulo && <span className="step-sub">{subtitulo}</span>}
      </div>
    </div>
  );
}
