import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {
  saveSubscription,
  saveUserPreferences,
  removeSubscription,
  sendWebPushNotification
} from './server/webPushServer.js';

function getBearerToken(req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
}

function pushNotificationDevPlugin() {
  return {
    name: 'push-notification-dev-plugin',
    configureServer(server) {
      server.middlewares.use('/api/register-push', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const accessToken = getBearerToken(req);
              const data = JSON.parse(body || '{}');
              if (data.user_id && data.preferences && !data.endpoint) {
                const prefs = await saveUserPreferences({
                  user_id: data.user_id,
                  preferences: data.preferences,
                  accessToken
                });
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, preferences: prefs }));
                return;
              }
              await saveSubscription(data, accessToken);
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

      server.middlewares.use('/api/delete-push', (req, res) => {
        if (req.method === 'POST' || req.method === 'DELETE') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const accessToken = getBearerToken(req);
              const data = JSON.parse(body || '{}');
              await removeSubscription({
                user_id: data.user_id,
                endpoint: data.endpoint,
                accessToken
              });
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
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const accessToken = getBearerToken(req);
              const data = JSON.parse(body || '{}');
              const result = await sendWebPushNotification({
                ...data,
                accessToken
              });
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
