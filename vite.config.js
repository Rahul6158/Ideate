import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { saveSubscription, sendWebPushNotification } from './server/webPushServer.js';

function pushNotificationDevPlugin() {
  return {
    name: 'push-notification-dev-plugin',
    configureServer(server) {
      server.middlewares.use('/api/register-push', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              saveSubscription(data);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch (err) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
        } else {
          res.statusCode = 405;
          res.end();
        }
      });

      server.middlewares.use('/api/send-push', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const data = JSON.parse(body);
              const result = await sendWebPushNotification(data);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, result }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
        } else {
          res.statusCode = 405;
          res.end();
        }
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), pushNotificationDevPlugin()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true
  }
});
