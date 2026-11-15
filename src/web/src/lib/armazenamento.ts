/** localStorage pode falhar (janela privada, dados bloqueados): nunca deixa o app quebrar. */
export function lerArmazenado(chave: string): string | null {
  try {
    return window.localStorage.getItem(chave);
  } catch {
    return null;
  }
}

export function gravarArmazenado(chave: string, valor: string): void {
  try {
    window.localStorage.setItem(chave, valor);
  } catch {
    // sem armazenamento: o app segue funcionando, só não lembra entre visitas
  }
}

export function removerArmazenado(chave: string): void {
  try {
    window.localStorage.removeItem(chave);
  } catch {
    // ver gravarArmazenado
  }
}
