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
const map = L.map('map', { layers: [darkTiles], zoomControl: true }).setView([32.5, 53.7], 5);

// Move zoom buttons away from sidebar overlap (optional)
map.zoomControl.setPosition('bottomright');

// Rough bounds for Iran
const iranBounds = L.latLngBounds(L.latLng(24.8, 44.0), L.latLng(39.9, 63.5));
map.setMaxBounds(iranBounds.pad(0.15));
map.on('drag', () => map.panInsideBounds(iranBounds, { animate: false }));

// Marker cluster
const cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 45 });

let allMarkers = [];
let allFeatures = [];

// Range filter values
let minYear = -Infinity;
let maxYear = Infinity;

let minAge = -Infinity;
let maxAge = Infinity;

// UI elements (same IDs, just in sidebar now)
const yearLabel = document.getElementById('yearLabel');
const yearRangeEl = document.getElementById('yearRange');

const ageLabel = document.getElementById('ageLabel');
const ageRangeEl = document.getElementById('ageRange');

const counter = document.getElementById('counter');
const searchBox = document.getElementById('search');
const genderFilter = document.getElementById('genderFilter');

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/* =========================================================
   PHOTOBOOK popupHtml(p) FUNCTION HERE.
   ========================================================= */
function popupHtml(p) {
  const name = [p.name_en, p.name_fa].filter(Boolean).join(' / ');
  const loc  = [p.city, p.province].filter(Boolean).join(', ');
  const yr   = (p.year !== null && p.year !== undefined) ? `Year: ${p.year}` : '';
  const age  = (p.age  !== null && p.age  !== undefined) ? `Age: ${p.age}` : '';
  const meta = [loc, yr, age].filter(Boolean).join(' • ');

  // Photos array -> build a little “photobook”
  const photos = Array.isArray(p.photos) ? p.photos.filter(Boolean) : [];
  const photoCount = photos.length;

  const photoHtml = photoCount
    ? `
      <div class="photobook" data-photo-index="0" data-photo-total="${photoCount}">
        <div class="photo-frame">
          <img class="photo-img" src="Photos/${escapeHtml(photos[0])}" alt="photo" loading="lazy"
               onerror="this.style.display='none'; this.parentElement.classList.add('photo-missing');" />
        </div>

        <div class="photo-controls">
          <button class="photo-btn prev" type="button" ${photoCount <= 1 ? "disabled" : ""}>Previous</button>
          <div class="photo-page">${photoCount > 0 ? `1 / ${photoCount}` : ""}</div>
          <button class="photo-btn next" type="button" ${photoCount <= 1 ? "disabled" : ""}>Next</button>
        </div>
      </div>
    `
    : `<div class="photobook photobook-empty">No photos yet.</div>`;

  // Links (Sources + Links)
  const links = [];
  const sources = Array.isArray(p.sources) ? p.sources : [];
  const extras  = Array.isArray(p.links)   ? p.links   : [];

  for (const url of sources) links.push(url);
  for (const url of extras)  links.push(url);

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

    ${photoHtml}

    ${linksHtml}
  `;
}


function wirePhotoBook(popupEl, photos) {
  if (!popupEl) return;
  const wrap = popupEl.querySelector('.photobook');
  if (!wrap) return;

  const img = wrap.querySelector('.photo-img');
  const page = wrap.querySelector('.photo-page');
  const prev = wrap.querySelector('.photo-btn.prev');
  const next = wrap.querySelector('.photo-btn.next');

  if (!img || !page || !prev || !next) return;

  let idx = 0;
  const total = photos.length;

  function render() {
    img.style.display = '';
    img.src = `Photos/${photos[idx]}`;
    page.textContent = `${idx + 1} / ${total}`;
    prev.disabled = total <= 1;
    next.disabled = total <= 1;
  }

  // Important: avoid double-wiring if popup opens multiple times
  prev.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    idx = (idx - 1 + total) % total;
    render();
  };

  next.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    idx = (idx + 1) % total;
    render();
  };

  render();
}


function makeMarker(feature) {
  const [lon, lat] = feature.geometry.coordinates;
  const p = feature.properties || {};

  const icon = L.icon({
    iconUrl: 'tulip_icon.svg',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    // keep existing popup positioning
    popupAnchor: [0, -30]
  });

  const m = L.marker([lat, lon], { icon }).bindPopup(popupHtml(p), {
    maxWidth: 360,
    closeButton: true,
    autoPan: true,
    keepInView: true
  });

  //attach photobook button wiring when popup opens
  m.on('popupopen', (e) => {
    const photos = Array.isArray(p.photos) ? p.photos.filter(Boolean) : [];
    if (!photos.length) return;
    const popupEl = e.popup.getElement();
    wirePhotoBook(popupEl, photos);
  });

  m.__props = p;
  return m;
}

function matchesSearch(p, q) {
  if (!q) return true;
  const hay = [p.name_en, p.name_fa, p.city, p.province].filter(Boolean).join(' ').toLowerCase();
  return hay.includes(q);
}

function matchesYear(p) {
  if (p.year === null || p.year === undefined) return true;
  const y = Number(p.year);
  return y >= minYear && y <= maxYear;
}

function matchesAge(p) {
  // If missing age, SHOW it (same behavior as year)
  if (p.age === null || p.age === undefined) return true;
  const a = Number(p.age);
  return a >= minAge && a <= maxAge;
}

function matchesGender(p){
  const selected = genderFilter.value;
  if (selected === "all") return true;
  if (!p.gender) return false;  // hide if no gender when filtering
  return p.gender === selected;
}

function applyFilter() {
  const q = searchBox.value.trim().toLowerCase();
  const filtered = allMarkers.filter(m => {
    const p = m.__props || {};
    return matchesYear(p)
    && matchesAge(p)
    && matchesGender(p)
    && matchesSearch(p, q);
  });

  cluster.clearLayers();
  cluster.addLayers(filtered);
  counter.textContent = `${filtered.length} shown`;
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

  // ---------- IRAN OUTLINE ----------
  fetch('iran_boundary.geojson')
    .then(res => res.json())
    .then(data => {
      L.geoJSON(data, {
        style: {
          color: "#50C878",
          weight: 2,
          opacity: 0.9,
          fillOpacity: 0
        }
      }).addTo(map);
    })
    .catch(err => console.error("Iran boundary load error:", err));

  // Build range slider dynamically from data years
  const years = allFeatures
    .map(f => f.properties?.year)
    .filter(y => y !== null && y !== undefined && !Number.isNaN(Number(y)))
    .map(y => Number(y));

  if (years.length) {
    const minY = Math.min(...years);
    const maxY = Math.max(...years);

    noUiSlider.create(yearRangeEl, {
      start: [minY, maxY],
      connect: true,
      step: 1,
      range: { min: minY, max: maxY },
      tooltips: [true, true],
      format: {
        to: v => Math.round(v),
        from: v => Number(v)
      }
    });

    minYear = minY;
    maxYear = maxY;
    yearLabel.textContent = `Years: ${minYear} – ${maxYear}`;

    yearRangeEl.noUiSlider.on('update', (values) => {
      minYear = Number(values[0]);
      maxYear = Number(values[1]);
      yearLabel.textContent = `Years: ${minYear} – ${maxYear}`;
      applyFilter();
    });
  } else {
    yearLabel.textContent = "Years: —";
  }
  // Build age slider dynamically from data ages
  const ages = allFeatures
    .map(f => f.properties?.age)
    .filter(a => a !== null && a !== undefined && !Number.isNaN(Number(a)))
    .map(a => Number(a));

  if (ages.length) {
    const minA = Math.min(...ages);
    const maxA = Math.max(...ages);

    noUiSlider.create(ageRangeEl, {
      start: [minA, maxA],
      connect: true,
      step: 1,
      range: { min: minA, max: maxA },
      tooltips: [true, true],
      format: {
        to: v => Math.round(v),
        from: v => Number(v)
      }
    });

    minAge = minA;
    maxAge = maxA;
    ageLabel.textContent = `Ages: ${minAge} – ${maxAge}`;

    ageRangeEl.noUiSlider.on('update', (values) => {
      minAge = Number(values[0]);
      maxAge = Number(values[1]);
      ageLabel.textContent = `Ages: ${minAge} – ${maxAge} Years Old`;
      applyFilter();
    });
  } else {
    ageLabel.textContent = "Ages: —";
  }

  counter.textContent = `${allMarkers.length} points`;
  applyFilter();
}

// Events
searchBox.addEventListener('input', () => {
  window.clearTimeout(window.__t);
  window.__t = window.setTimeout(applyFilter, 120);
});

genderFilter.addEventListener('change', () => {
  applyFilter();
});

loadData().catch(err => {
  console.error(err);
  alert(err.message);
});

// --- Sidebar collapsibility ---
(() => {
  const app = document.getElementById('app');
  const btn = document.getElementById('sidebarToggle');
  if (!app || !btn) return;

  function setExpanded(isExpanded) {
    btn.setAttribute('aria-expanded', String(isExpanded));
    btn.title = isExpanded ? "Collapse" : "Expand";
  }

  // Optional: remember choice
  const saved = localStorage.getItem('sidebarCollapsed');
  if (saved === '1') {
    app.classList.add('sidebar-collapsed');
    setExpanded(false);
  } else {
    setExpanded(true);
  }

  btn.addEventListener('click', () => {
    const collapsed = app.classList.toggle('sidebar-collapsed');
    localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0');
    setExpanded(!collapsed);

    // Leaflet needs a size refresh when layout changes
    setTimeout(() => map.invalidateSize(), 260);
  });
})();

