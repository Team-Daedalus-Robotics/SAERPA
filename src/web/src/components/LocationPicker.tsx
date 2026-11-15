import { useEffect, useMemo, useState } from 'react';
import { ESTADOS } from '../data/locations';
import { useMunicipios } from '../hooks/consultas';
import type { Estado, Municipio } from '../types';

interface Propriedades {
  estado: Estado | null;
  municipio: Municipio | null;
  onEstado: (estado: Estado | null) => void;
  onMunicipio: (municipio: Municipio | null) => void;
}

/** Seleção de estado + cidade (com busca) cobrindo todo o Brasil */
export default function LocationPicker({ estado, municipio, onEstado, onMunicipio }: Propriedades) {
  const { data: municipios = [] } = useMunicipios(estado?.uf);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery('');
  }, [estado]);

  useEffect(() => {
    setQuery(municipio?.nome ?? '');
  }, [municipio]);

  const filtered = useMemo(() => {
    const consulta = normalizar(query);
    if (!consulta || consulta === normalizar(municipio?.nome ?? '')) return municipios.slice(0, 60);
    // nomes que começam com o texto digitado aparecem primeiro
    const starts = municipios.filter((candidato) => normalizar(candidato.nome).startsWith(consulta));
    const contains = municipios.filter((candidato) => !normalizar(candidato.nome).startsWith(consulta) && normalizar(candidato.nome).includes(consulta));
    return [...starts, ...contains].slice(0, 60);
  }, [query, municipios, municipio]);

  return (
    <div className="loc-bar">
      <label className="loc-field uf">
        <span>Estado</span>
        <select
          value={estado?.uf ?? ''}
          onChange={(evento) => onEstado(ESTADOS.find((candidato) => candidato.uf === evento.target.value) ?? null)}
        >
          <option value="">Escolha o estado…</option>
          {ESTADOS.map((opcao) => (
            <option key={opcao.uf} value={opcao.uf}>{opcao.nome} ({opcao.uf})</option>
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
          onChange={(evento) => { setQuery(evento.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          autoComplete="off"
        />
        {open && estado && filtered.length > 0 && (
          <ul className="loc-list" role="listbox">
            {filtered.map((candidato) => (
              <li key={candidato.codigoIbge}>
                <button
                  type="button"
                  onMouseDown={(evento) => evento.preventDefault()}
                  onClick={() => { onMunicipio(candidato); setOpen(false); }}
                >
                  {candidato.nome}
                </button>
              </li>
            ))}
          </ul>
        )}
      </label>
    </div>
  );
}

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
