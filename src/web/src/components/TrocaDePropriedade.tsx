import type { Municipio } from '../types';
import { Icone } from './icones';
import { Sheet } from './ui';

interface PropriedadesDoCartao {
  municipio: Municipio;
  uf: string;
  quantidadeDeAreas: number | null;
  onTrocar: () => void;
}

function textoDasAreas(quantidade: number | null): string {
  if (quantidade === null) return 'Carregando as áreas…';
  if (quantidade === 0) return 'Nenhuma área marcada ainda';
  return quantidade === 1 ? '1 área marcada' : `${quantidade} áreas marcadas`;
}

/** Mostra a propriedade atual no lugar dos campos de estado e cidade */
export function CartaoDaPropriedade({ municipio, uf, quantidadeDeAreas, onTrocar }: PropriedadesDoCartao) {
  return (
    <div className="propriedade">
      <span className="propriedade-icone"><Icone nome="local" tamanho={22} /></span>
      <div className="propriedade-info">
        <small>Sua propriedade</small>
        <b>{municipio.nome}, {uf}</b>
        <span>{textoDasAreas(quantidadeDeAreas)}</span>
      </div>
      <button className="btn-outline" onClick={onTrocar}>Trocar de propriedade</button>
    </div>
  );
}

interface PropriedadesDoAviso {
  atual: { municipio: Municipio; uf: string };
  nova: { municipio: Municipio; uf: string } | null;
  enviando: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
}

/** Só existe uma propriedade por vez: trocar exclui a antiga (áreas e histórico incluídos) */
export function AvisoDeTroca({ atual, nova, enviando, onCancelar, onConfirmar }: PropriedadesDoAviso) {
  return (
    <Sheet open={nova !== null} onClose={enviando ? () => undefined : onCancelar}>
      {nova && (
        <div role="alertdialog" aria-labelledby="titulo-troca" aria-describedby="texto-troca">
          <h3 id="titulo-troca">Trocar de propriedade?</h3>
          <p>
            Você vai usar <b>{nova.municipio.nome}, {nova.uf}</b> no lugar de <b>{atual.municipio.nome}, {atual.uf}</b>.
          </p>
          <div className="aviso-perigo" id="texto-troca">
            <Icone nome="alerta" tamanho={20} />
            <span>
              <b>A propriedade antiga será excluída.</b> As áreas marcadas e o histórico de plantio de {atual.municipio.nome} serão apagados e não dá para desfazer.
            </span>
          </div>
          <div className="dialogo-acoes">
            <button className="btn-outline" autoFocus disabled={enviando} onClick={onCancelar}>Cancelar</button>
            <button className="btn perigo" disabled={enviando} onClick={onConfirmar}>{enviando ? 'Excluindo…' : 'Excluir e trocar'}</button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
