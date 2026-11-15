import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// O Aspire entrega o endereço da API como services__api__http__0 e/ou services__api__https__0,
// conforme o certificado de desenvolvimento esteja ou não confiável na máquina.
const apiEndpoint = process.env.services__api__http__0 ?? process.env.services__api__https__0;

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: apiEndpoint
      ? {
          '/api': {
            target: apiEndpoint,
            changeOrigin: true,
            // o certificado HTTPS de desenvolvimento do Aspire não é confiável para o Node
            secure: false,
          },
        }
      : undefined,
  },
});
