import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  
  // Frontend port defaults to 3000, Backend API server runs on 3001
  const frontendPort = 3000;
  const apiProxyPort = parseInt(process.env.API_PORT || '3001', 10);

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: frontendPort,
      strictPort: false,
      allowedHosts: ['tc.yifen.us.ci', 'localhost', '127.0.0.1'],
      hmr: false,
      watch: {
        ignored: ['**/database/**']
      },
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${apiProxyPort}`,
          changeOrigin: true
        }
      }
    },
  };
});
