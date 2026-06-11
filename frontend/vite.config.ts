import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// HTTPS dev server so window.isSecureContext is true on LAN devices — required
// for crypto.subtle (file hashing) to work off localhost. We use an explicit
// self-signed cert with proper SAN entries (localhost, 127.0.0.1, the Wi-Fi IP)
// instead of @vitejs/plugin-basic-ssl: basic-ssl issues a CN=example.org cert
// with no SAN, which stricter browsers (old Android Chrome/WebView) reject at
// the TLS layer with ERR_EMPTY_RESPONSE instead of an acceptable warning.
// Regenerate for a new IP:
//   openssl req -x509 -newkey rsa:2048 -nodes -keyout certs/key.pem \
//     -out certs/cert.pem -days 365 -subj "/CN=<ip>" \
//     -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:<ip>"
const certDir = fileURLToPath(new URL('./certs/', import.meta.url))
const keyPath = `${certDir}key.pem`
const certPath = `${certDir}cert.pem`
// SW_DEV_HTTP=1 forces plain http (for local tooling that rejects the
// self-signed cert); SW_BACKEND_PORT retargets the proxy when another
// project already occupies 8000.
const https =
  !process.env.SW_DEV_HTTP && existsSync(keyPath) && existsSync(certPath)
    ? { key: readFileSync(keyPath), cert: readFileSync(certPath) }
    : undefined
const backendPort = process.env.SW_BACKEND_PORT ?? '8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    https,
    proxy: {
      // Use 127.0.0.1 (not "localhost") so the proxy can't resolve to IPv6 ::1,
      // where another project's container may be publishing port 8000. Forcing
      // IPv4 pins the proxy to the local SyncWatch backend.
      '/api': {
        target: `http://127.0.0.1:${backendPort}`,
        changeOrigin: true,
      },
      '/ws': {
        target: `http://127.0.0.1:${backendPort}`,
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
