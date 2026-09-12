import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

function devApiMiddleware() {
  return {
    name: 'dev-api-simplify-middleware',
    configureServer(server) {
      server.middlewares.use('/api/simplify', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Only POST method allowed' }));
          return;
        }

        let bodyStr = '';
        req.on('data', chunk => { bodyStr += chunk; });
        req.on('end', async () => {
          try {
            const body = bodyStr ? JSON.parse(bodyStr) : {};
            const handlerModule = await import('./api/simplify.js');
            const mockReq = { method: 'POST', body };
            const mockRes = {
              statusCode: 200,
              headers: {},
              status(code) { this.statusCode = code; return this; },
              setHeader(k, v) { this.headers[k] = v; return this; },
              json(data) {
                res.statusCode = this.statusCode;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
              }
            };
            await handlerModule.default(mockReq, mockRes);
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || String(err) }));
          }
        });
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), devApiMiddleware()],
})
