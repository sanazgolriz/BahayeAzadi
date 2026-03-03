# Iran Interactive Map (Leaflet)

This is a free, static site (no backend) that shows a dark-themed interactive map with clickable dots.

## Files
- `index.html` – page shell
- `styles.css` – styling (dark UI + popup styles)
- `script.js` – loads `people.geojson`, renders markers, search filter
- `people.geojson` – your data (generated from your Excel)

## Deploy on GitHub Pages
1. Create a repo (or use an existing one).
2. Upload these files to the repo root.
3. In GitHub: **Settings → Pages**
   - Source: `Deploy from a branch`
   - Branch: `main` / root
4. Your site URL will appear there.

## Update your data
Re-generate `people.geojson` whenever your Excel changes, then commit/push the updated file.
