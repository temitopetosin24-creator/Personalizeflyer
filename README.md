# Personalizer

The flyer is a static GitHub Pages site. Anonymous usage analytics are handled by a Google Apps Script Web App and recorded in a private Google Sheet.

## Run locally

Open `index.html` in a browser to preview the flyer. Analytics are sent only after a Web App URL is set in `config.js`.

## Analytics and privacy

The Google Sheet reports unique browsers and unique browsers that generated a flyer with a non-empty name through download or share. A random browser ID is kept in local storage and written to the private sheet. Names, photos, and IP addresses are not collected. Clearing site data may cause a returning browser to be counted again.

## Deploy the flyer

Configure GitHub Pages to publish the repository's root from the `main` branch. `index.html` is the site entry point. Analytics are disabled on GitHub Pages until a backend URL is configured.

After deploying the Apps Script Web App, set `window.PERSONALIZER_API_URL` in `config.js` to its URL ending in `/exec`, then commit and push that change.

## Set up Apps Script analytics

1. Create a Google Sheet and keep its sharing restricted to you.
2. In the sheet, open **Extensions > Apps Script** and replace the editor contents with `Code.gs` from this repository.
3. Save, select `setup`, click **Run**, and grant the requested spreadsheet permission. This creates the `Analytics` and `Summary` tabs.
4. Choose **Deploy > New deployment > Web app**. Set **Execute as** to yourself and **Who has access** to **Anyone**, then deploy and authorize.
5. Copy the Web App URL ending in `/exec` into `config.js` as `window.PERSONALIZER_API_URL`, then commit and push the config change.

The `Summary` tab shows the counts. Keep the spreadsheet private: the Apps Script endpoint accepts anonymous write-only events, and anyone who obtains its URL could submit fabricated visitor IDs. Google Apps Script quotas also apply.