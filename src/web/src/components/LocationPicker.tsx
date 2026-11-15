import { useEffect, useMemo, useState } from 'react';
import { ESTADOS, loadMunicipios } from '../data/locations';
import type { Estado, Municipio } from '../types';

interface Props {
  estado: Estado | null;
  municipio: Municipio | null;
  onEstado: (e: Estado | null) => void;
  onMunicipio: (m: Municipio | null) => void;
}

/** Seleção de estado + cidade (com busca) cobrindo todo o Brasil */
export default function LocationPicker({ estado, municipio, onEstado, onMunicipio }: Props) {
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMunicipios([]);
    setQuery('');
    if (estado) loadMunicipios(estado.uf).then(setMunicipios);
  }, [estado]);

  useEffect(() => {
    setQuery(municipio?.nome ?? '');
  }, [municipio]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q || q === normalize(municipio?.nome ?? '')) return municipios.slice(0, 60);
    // nomes que começam com o texto digitado aparecem primeiro
    const starts = municipios.filter((m) => normalize(m.nome).startsWith(q));
    const contains = municipios.filter((m) => !normalize(m.nome).startsWith(q) && normalize(m.nome).includes(q));
    return [...starts, ...contains].slice(0, 60);
  }, [query, municipios, municipio]);

  return (
    <div className="loc-bar">
      <label className="loc-field uf">
        <span>Estado</span>
        <select
          value={estado?.uf ?? ''}
          onChange={(e) => onEstado(ESTADOS.find((s) => s.uf === e.target.value) ?? null)}
        >
          <option value="">Escolha o estado…</option>
          {ESTADOS.map((s) => (
            <option key={s.uf} value={s.uf}>{s.nome} ({s.uf})</option>
          ))}
        </select>
      </label>

      <label className="loc-field city">
        <span>Cidade</span>
        <input
          type="search"
          placeholder={estado ? 'Digite o nome da cidade' : 'Primeiro escolha o estado'}
          disabled={!estado}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          autoComplete="off"
        />
        {open && estado && filtered.length > 0 && (
          <ul className="loc-list" role="listbox">
            {filtered.map((m) => (
              <li key={m.codigoIbge}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { onMunicipio(m); setOpen(false); }}
                >
                  {m.nome}
                </button>
              </li>
            ))}
          </ul>
        )}
      </label>
    </div>
  );
}

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
