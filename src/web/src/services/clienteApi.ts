export class ErroDaApi extends Error {
  status: number;

  constructor(status: number, mensagem: string) {
    super(mensagem);
    this.status = status;
  }
}

const MENSAGEM_PADRAO = 'Não foi possível falar com o servidor. Tente de novo em instantes.';

export async function requisitar<Resposta>(metodo: string, caminho: string, corpo?: unknown): Promise<Resposta> {
  let resposta: Response;
  try {
    resposta = await fetch(caminho, {
      method: metodo,
      headers: corpo === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch {
    throw new ErroDaApi(0, MENSAGEM_PADRAO);
  }

  if (!resposta.ok) {
    let detalhe: unknown;
    try {
      detalhe = (await resposta.json()).detail;
    } catch {
      detalhe = undefined;
    }
    throw new ErroDaApi(resposta.status, typeof detalhe === 'string' ? detalhe : MENSAGEM_PADRAO);
  }

  if (resposta.status === 204) return undefined as Resposta;
  return resposta.json() as Promise<Resposta>;
}

export function mensagemDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : MENSAGEM_PADRAO;
}
