# Personalizer

## Run locally

Requires Node.js 18 or newer. From this folder, run:

```powershell
node server.js
```

Open `http://localhost:8000` for the flyer and `http://localhost:8000/stats` for analytics. The admin token is generated on first run and saved in `.personalizer-admin-token`; enter that token on the stats page. Analytics are stored in `.personalizer-analytics.json`.

## Analytics and privacy

The dashboard reports unique browser visitors and unique browsers that generated a flyer with a non-empty name through download or share. A random, first-party cookie deduplicates each browser for one year. Names, photos, and IP addresses are not sent to or stored by the backend. Clearing browser cookies may cause a returning visitor to be counted again.

## Deploy

This app needs a Node.js host; static-only hosting cannot record analytics. Configure the host to run `node server.js`, set `HOST=0.0.0.0`, and set `ADMIN_TOKEN` to a strong secret in the host's secret settings. Set `DATA_DIR` to a persistent writable disk so counts survive restarts, and serve the app behind HTTPS. The backend sets secure cookies when `NODE_ENV=production`.