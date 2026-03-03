// Dark tiles (free): CARTO 'Dark Matter'
const darkTiles = L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 19
  }
);

// Center on Iran
const map = L.map('map', {
  layers: [darkTiles],
  zoomControl: true
}).setView([32.5, 53.7], 5);

// Rough bounds for Iran (keeps the experience focused)
const iranBounds = L.latLngBounds(
  L.latLng(24.8, 44.0),  // SW
  L.latLng(39.9, 63.5)   // NE
);
map.setMaxBounds(iranBounds.pad(0.15));
map.on('drag', function () { map.panInsideBounds(iranBounds, { animate: false }); });

// Marker cluster layer (handles thousands gracefully)
const cluster = L.markerClusterGroup({
  showCoverageOnHover: false,
  maxClusterRadius: 45
});

let allMarkers = [];
let allFeatures = [];

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function popupHtml(p) {
  const name = [p.name_en, p.name_fa].filter(Boolean).join(' / ');
  const loc = [p.city, p.province].filter(Boolean).join(', ');
  const age = (p.age !== null && p.age !== undefined) ? `Age: ${p.age}` : '';
  const meta = [loc, age].filter(Boolean).join(' • ');

  const links = []
  const sources = Array.isArray(p.sources) ? p.sources : [];
  const extras = Array.isArray(p.links) ? p.links : [];

  for (const url of sources) links.push(url);
  for (const url of extras) links.push(url);

  const linksHtml = links.length
    ? `<div class="popup-links">${links.map((u, i) => {
        const safe = escapeHtml(u);
        const label = (safe.includes('youtube.com') || safe.includes('youtu.be')) ? `Video ${i+1}` : `Link ${i+1}`;
        return `<div><a href="${safe}" target="_blank" rel="noopener noreferrer">${label}</a></div>`;
      }).join('')}</div>`
    : `<div class="popup-links" style="opacity:.75;">No links yet.</div>`;

  return `
    <div class="popup-title">${escapeHtml(name || 'Unknown')}</div>
    <div class="popup-sub">${escapeHtml(meta)}</div>
    ${linksHtml}
  `;
}

function makeMarker(feature) {
  const [lon, lat] = feature.geometry.coordinates;
  const p = feature.properties || {};
  const icon = L.divIcon({
    className: '',
    html: '<div class="dot"></div>',
    iconSize: [10, 10],
    iconAnchor: [5, 5]
  });

  const m = L.marker([lat, lon], { icon })
    .bindPopup(popupHtml(p), { maxWidth: 320 });

  m.__props = p;
  return m;
}

async function loadData() {
  const res = await fetch('people.geojson');
  if (!res.ok) throw new Error(`Failed to load people.geojson (${res.status})`);
  const gj = await res.json();

  allFeatures = gj.features || [];
  allMarkers = allFeatures.map(makeMarker);

  cluster.clearLayers();
  cluster.addLayers(allMarkers);
  map.addLayer(cluster);

  document.getElementById('counter').textContent = `${allMarkers.length} points`;
}

function matchQuery(p, q) {
  if (!q) return true;
  const hay = [
    p.name_en, p.name_fa, p.city, p.province
  ].filter(Boolean).join(' ').toLowerCase();
  return hay.includes(q);
}

function applyFilter() {
  const q = document.getElementById('search').value.trim().toLowerCase();

  const filtered = allMarkers.filter(m => matchQuery(m.__props || {}, q));

  cluster.clearLayers();
  cluster.addLayers(filtered);

  document.getElementById('counter').textContent = `${filtered.length} shown`;
}

document.getElementById('search').addEventListener('input', () => {
  // light debounce
  window.clearTimeout(window.__t);
  window.__t = window.setTimeout(applyFilter, 120);
});

loadData().catch(err => {
  console.error(err);
  alert(err.message);
});
