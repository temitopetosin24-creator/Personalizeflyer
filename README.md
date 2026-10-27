# Personalizer

The flyer is a static GitHub Pages site. Anonymous usage analytics require the separate Node.js backend; GitHub Pages cannot run `server.js`.

## Run locally

Requires Node.js 18 or newer. From this folder, run:

```powershell
node server.js
```

Open `http://localhost:8000` for the flyer and `http://localhost:8000/stats` for analytics. The admin token is generated on first run and saved in `.personalizer-admin-token`; enter it on the stats page. Analytics are stored in `.personalizer-analytics.json`.

## Analytics and privacy

The dashboard reports unique browsers and unique browsers that generated a flyer with a non-empty name through download or share. A random ID is kept in browser local storage and sent to the analytics backend. Names, photos, and IP addresses are not stored by this app. Clearing site data may cause a returning browser to be counted again.

## Deploy the flyer

Configure GitHub Pages to publish the repository's root from the `main` branch. `index.html` is the site entry point. Analytics are disabled on GitHub Pages until a backend URL is configured.

After deploying the backend, set `window.PERSONALIZER_API_URL` in `config.js` to its HTTPS base URL, such as `https://your-service.example.com`, then commit and push that change. Do not put an admin token in `config.js`.

## Deploy the analytics backend

Deploy `server.js` to a Node.js host and set its start command to `node server.js`. Configure these environment variables in the host:

- `HOST=0.0.0.0`
- `ADMIN_TOKEN` to a strong secret
- `FRONTEND_ORIGINS=https://temitopetosin24-creator.github.io,https://your-service.example.com` (the Pages site and backend dashboard origins)
- `DATA_DIR` to a persistent writable disk
- `NODE_ENV=production`

The dashboard is available at `https://your-service.example.com/stats`. Keep the admin token in the host's secret settings. The backend only accepts analytics requests from the configured frontend origins.