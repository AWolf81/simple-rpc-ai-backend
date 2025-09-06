/**
 * HTTPS Proxy for MCP Jam Compatibility
 * Creates an HTTPS server that proxies to the HTTP MCP server
 */

import https from 'https';
import http from 'http';
import { createProxyMiddleware } from 'http-proxy-middleware';
import express from 'express';

// Generate self-signed certificate for development
function generateSelfSignedCert() {
  // For development, we'll use a basic self-signed cert
  // In production, you'd use proper certificates
  const cert = `-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAKoK/heBjcOuMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV
BAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBX
aWRnaXRzIFB0eSBMdGQwHhcNMTcwODI3MTAzNzEwWhcNMTgwODI3MTAzNzEwWjBF
MQswCQYDVQQGEwJBVTETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50
ZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIB
CgKCAQEA4f5wg5l2hKsTeNem/V41fGnJm6gOdrj8ym3rFkEjWT2btY28jbOvxEi1
w8Vu1KWVWx2K1dz8d8v9fEn/9b5K5K3QvKj5fGJ8NJ0A/QIDAQAB
-----END CERTIFICATE-----`;

  const key = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDh/nCDmXaEqxN4
16b9XjV8acmbqA52uPzKbesWQSNZPZu1jbyNs6/ESLXDxW7UpZVbHYrV3Px3y/18
Sf/1vkrkrdC8qPl8Ynw0nQD9AgMBAAECggEAYhflWTvQa5a9P/2M3lRj1fYk7g8Z
k4NsP9QjWJ3lYcz4bU7Lq9tX8XnXyNNcvzL3qPAYs8E2V7a9zcn2+Bv3XvRjEGj
-----END PRIVATE KEY-----`;

  return { cert, key };
}

const app = express();
const { cert, key } = generateSelfSignedCert();

// Create proxy middleware
const proxy = createProxyMiddleware({
  target: 'http://localhost:8009',
  changeOrigin: true,
  secure: false,
  onProxyReq: (proxyReq, req, res) => {
    console.log(`🔒 HTTPS Proxy: ${req.method} ${req.url} -> http://localhost:8009${req.url}`);
  }
});

// Use proxy for all requests
app.use('/', proxy);

// Create HTTPS server
const httpsServer = https.createServer({ cert, key }, app);

httpsServer.listen(8443, () => {
  console.log('🔒 HTTPS Proxy Server started on https://localhost:8443');
  console.log('   Proxying to: http://localhost:8009');
  console.log('   For MCP Jam: Use https://localhost:8443/mcp');
  console.log('   Self-signed certificate - accept in browser');
});

httpsServer.on('error', (err) => {
  console.error('❌ HTTPS Proxy Server error:', err);
});