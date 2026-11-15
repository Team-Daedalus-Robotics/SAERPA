/* =========================================================================
 * Ajuda — janela que abre no botão "Ajuda"
 *  - "Me mostre como usar": inicia o passo a passo guiado (Tour)
 *  - "Como cada parte funciona": explicação de cada parte, para ler com calma
 * ========================================================================= */
import { useState } from 'react';
import { USE_MOCK } from '../services/smap';
import { Sheet } from './ui';

interface Propriedades {
  open: boolean;
  onClose: () => void;
  onTour: () => void;
}

const PARTES: { icone: string; titulo: string; texto: React.ReactNode }[] = [
  {
    icone: '📍', titulo: '1 · Onde fica sua plantação',
    texto: (
      <>
        <p>Escolha o <b>estado</b> na lista e depois digite o nome da <b>cidade</b>. Enquanto você digita, aparecem nomes parecidos; é só tocar no certo. Pode digitar sem acento.</p>
        <p>O estado diz a sua região (Sul, Sudeste, Nordeste, Centro-Oeste ou Norte), e cada região tem uma época certa de plantar. Para recomeçar, toque em <b>Início</b>, no alto da tela.</p>
      </>
    ),
  },
  {
    icone: '🗺️', titulo: 'O mapa',
    texto: (
      <>
        <p>Mostra a cidade que você escolheu. Use <b>+</b> e <b>−</b> para aproximar e afastar, e arraste com o dedo para mover.</p>
        <p>O botão <b>Ver mapa / Ver satélite</b> troca entre o mapa com ruas e a foto de satélite.</p>
      </>
    ),
  },
  {
    icone: '💧', titulo: 'Umidade da terra',
    texto: (
      <>
        <p>Um satélite da NASA (chamado SMAP) mede quanta água tem na terra. No mapa, <b>marrom</b> é terra seca e <b>azul</b> é terra molhada. As cores só aparecem com o mapa aproximado.</p>
        <p>No passo 3, essa medida vira um conselho simples, por exemplo: “regue bem antes de plantar”.</p>
        {USE_MOCK && <p className="ajuda-aviso">Nesta versão de teste os valores de umidade ainda são simulados.</p>}
      </>
    ),
  },
  {
    icone: '✏️', titulo: 'Marcar minha área (opcional)',
    texto: (
      <>
        <p>Serve para separar seus canteiros ou roças. Aproxime o mapa até ver seu terreno, toque em <b>Marcar minha área no mapa</b> e depois toque em cada canto do terreno (pelo menos 3). Errou? Toque em <b>Desfazer</b>. Terminou? Toque em <b>Pronto</b>.</p>
        <p>Cada área guarda o que foi plantado nela. Para trocar de área, use os botões que aparecem embaixo do mapa.</p>
      </>
    ),
  },
  {
    icone: '🥬', titulo: '2 · O que você plantou por último',
    texto: (
      <>
        <p>Toque na figura da planta que você colheu por último nesse lugar. Para achar mais rápido, digite o nome na busca. Se não souber, toque em <b>Nada / não sei</b>.</p>
        <p>Se lembrar o que plantou <b>antes disso</b>, adicione também: a sugestão fica melhor. Para mudar a resposta, toque em <b>Trocar</b>.</p>
      </>
    ),
  },
  {
    icone: '📅', titulo: '3 · Quando vai plantar',
    texto: (
      <p>Já vem marcado o mês de hoje. Se for plantar depois, escolha outro mês. O botão <b>Quero colher rápido</b> coloca primeiro as plantas que ficam prontas em menos dias.</p>
    ),
  },
  {
    icone: '✅', titulo: 'As sugestões',
    texto: (
      <>
        <p>A primeira da lista, com ⭐, é a <b>melhor escolha</b>. Toque em qualquer planta para ver:</p>
        <ul>
          <li><b>Por que?</b> — o motivo de ser uma boa escolha;</li>
          <li><b>Como plantar</b> — espaço entre linhas e entre plantas, jeito de plantar, dias até a colheita e quanto produz por metro quadrado.</li>
        </ul>
        <p>Embaixo aparecem as plantas para os <b>próximos meses</b>, as que é melhor <b>evitar</b> e uma ideia de <b>sequência para o ano</b>.</p>
      </>
    ),
  },
  {
    icone: '🔄', titulo: 'Por que trocar de planta?',
    texto: (
      <>
        <p>Plantar sempre a mesma coisa no mesmo lugar cansa a terra e junta pragas e doenças. Plantas da <b>mesma família</b> (por exemplo, tomate, pimentão e berinjela) pegam as mesmas pragas, por isso o app pede para evitar uma depois da outra.</p>
        <p>Uma ordem que funciona bem: <b>folhas 🥬 → frutos 🍅 → raízes 🥕 → vagens 🫛</b>, e começa de novo. As vagens (feijão-vagem, ervilha) devolvem nitrogênio para a terra, como um adubo natural.</p>
      </>
    ),
  },
  {
    icone: '📚', titulo: 'De onde vêm as informações',
    texto: (
      <p>Épocas de plantio, espaçamento e tempo de colheita: tabela de plantio de hortaliças do <b>Sisteminha Embrapa</b>. Umidade da terra: satélite <b>NASA SMAP</b>. Cidades: códigos do <b>IBGE</b>. A família de cada planta e a ordem de rotação foram organizadas pela equipe do projeto.</p>
    ),
  },
];

export default function Ajuda({ open, onClose, onTour }: Propriedades) {
  const [verPartes, setVerPartes] = useState(false);
  const fechar = () => { setVerPartes(false); onClose(); };

  return (
    <Sheet open={open} onClose={fechar}>
      {!verPartes ? (
        <>
          <h3>Como podemos ajudar?</h3>
          <div className="ajuda-opcoes">
            <button className="ajuda-op" onClick={() => { fechar(); onTour(); }}>
              <span className="ajuda-op-ico">👆</span>
              <span><b>Me mostre como usar</b>Balões vão apontar cada parte da tela, um de cada vez.</span>
            </button>
            <button className="ajuda-op" onClick={() => setVerPartes(true)}>
              <span className="ajuda-op-ico">📖</span>
              <span><b>Como cada parte funciona</b>Explicação de cada parte do app, para ler com calma.</span>
            </button>
          </div>
        </>
      ) : (
        <>
          <button className="ajuda-voltar" onClick={() => setVerPartes(false)}>← Voltar</button>
          <h3>Como cada parte funciona</h3>
          <p className="ajuda-sub">Toque em uma parte para ler a explicação.</p>
          <div className="ajuda-partes">
            {PARTES.map((parte) => (
              <details key={parte.titulo} className="ajuda-parte">
                <summary><span>{parte.icone}</span>{parte.titulo}</summary>
                <div className="ajuda-texto">{parte.texto}</div>
              </details>
            ))}
          </div>
          <button className="btn full" onClick={() => { fechar(); onTour(); }}>👆 Ver o passo a passo na tela</button>
        </>
      )}
    </Sheet>
  );
}
