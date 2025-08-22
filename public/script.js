// ============ CONFIG ============
const OMDB_API_KEY = '12354dcf'; // <-- replace with your OMDb API key
const OMDB_ENDPOINT = 'https://www.omdbapi.com/';

// ============ DOM ============
const movieInput = document.getElementById('movieInput');
const searchButton = document.getElementById('searchButton');
const searchForm = document.getElementById('searchForm');
const resultContainer = document.getElementById('resultContainer');
const resultCount = document.getElementById('resultCount');
const emptyState = document.getElementById('emptyState');
const loadMoreBtn = document.getElementById('loadMore');
const toast = document.getElementById('toast');

const filterToggle = document.getElementById('filterToggle');
const filtersSection = document.getElementById('filters');
const genreChips = document.getElementById('genreChips');
const yearMinInput = document.getElementById('yearMin');
const yearMaxInput = document.getElementById('yearMax');
const minRatingInput = document.getElementById('minRating');
const applyFiltersBtn = document.getElementById('applyFilters');
const clearFiltersBtn = document.getElementById('clearFilters');

const chipRow = document.getElementById('chipRow');
const recentChips = document.getElementById('recentChips');
const voiceBtn = document.getElementById('voiceBtn');
const themeToggle = document.getElementById('themeToggle');

// ============ STATE ============
const state = {
  query: '',
  page: 1,
  items: [],
  total: 0,
  filters: {
    genres: new Set(),
    yearMin: null,
    yearMax: null,
    minRating: null
  }
};

// ============ INIT ============
init();
function init() {
  hydrateTheme();
  hydrateRecentChips();
  attachEvents();
  showEmpty();
}

function attachEvents() {
  // Searching
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = movieInput.value.trim();
    if (!value) {
      showToast('Type something to search 🍿');
      return;
    }
    beginSearch(value);
  });
  chipRow.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-chip]');
    if (!chip) return;
    movieInput.value = chip.dataset.chip;
    beginSearch(chip.dataset.chip);
  });

  // Filters
  filterToggle.addEventListener('click', () => {
    const isHidden = filtersSection.hasAttribute('hidden');
    if (isHidden) filtersSection.removeAttribute('hidden'); else filtersSection.setAttribute('hidden', '');
  });
  applyFiltersBtn.addEventListener('click', (e) => {
    e.preventDefault();
    applyFilters();
  });
  clearFiltersBtn.addEventListener('click', (e) => {
    e.preventDefault();
    clearFilters();
  });
  genreChips.addEventListener('change', () => {
    const selected = [...genreChips.querySelectorAll('input[type="checkbox"]:checked')].map(i => i.value);
    state.filters.genres = new Set(selected);
  });
  yearMinInput.addEventListener('input', () => state.filters.yearMin = toNum(yearMinInput.value));
  yearMaxInput.addEventListener('input', () => state.filters.yearMax = toNum(yearMaxInput.value));
  minRatingInput.addEventListener('input', () => state.filters.minRating = parseFloat(minRatingInput.value) || null);

  // Load more
  loadMoreBtn.addEventListener('click', () => loadMore());

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== movieInput) {
      e.preventDefault();
      movieInput.focus();
    }
    if (e.key === 'Escape') {
      movieInput.value = '';
      movieInput.blur();
    }
  });

  // Voice
  voiceBtn.addEventListener('click', startVoice);

  // Theme
  themeToggle.addEventListener('click', toggleTheme);
}

// ============ THEME ============
function hydrateTheme() {
  const saved = localStorage.getItem('theme');
  const theme = saved || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
}

// ============ RECENT CHIPS ============
function hydrateRecentChips() {
  const items = getRecentSearches();
  if (!items.length) {
    recentChips.hidden = true;
    return;
  }
  recentChips.hidden = false;
  recentChips.innerHTML = `
    <span class="chip-label">Recent:</span>
    ${items.map(q => `<button class="chip" data-chip="${escapeHtml(q)}">${escapeHtml(q)}</button>`).join('')}
  `;
}
function pushRecent(query) {
  const key = 'cinepulse_recent';
  const arr = getRecentSearches().filter(q => q.toLowerCase() !== query.toLowerCase());
  arr.unshift(query);
  const trimmed = arr.slice(0, 8);
  localStorage.setItem(key, JSON.stringify(trimmed));
  hydrateRecentChips();
}
function getRecentSearches() {
  const key = 'cinepulse_recent';
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

// ============ SEARCH FLOW ============
async function beginSearch(query) {
  state.query = query;
  state.page = 1;
  state.items = [];
  state.total = 0;

  renderSkeletons(8);
  showCount('Searching…');
  hideEmpty();
  loadMoreBtn.hidden = true;

  try {
    const { results, totalResults } = await fetchSearch(query, state.page);
    const detailed = await hydrateDetails(results);
    state.items = detailed;
    state.total = totalResults;

    applyFilters(); // renders as well
    pushRecent(query);

    // Show "Load more" if more pages exist
    const totalPages = Math.ceil(totalResults / 10);
    loadMoreBtn.hidden = state.page >= totalPages;
  } catch (err) {
    console.error(err);
    showToast('Something went wrong. Please check your API key or try again.', true);
    showEmpty('Could not load results.');
  }
}

async function loadMore() {
  try {
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = 'Loading…';

    state.page += 1;
    const { results } = await fetchSearch(state.query, state.page);
    const detailed = await hydrateDetails(results);
    state.items = [...state.items, ...detailed];

    applyFilters(); // re-render with filters active

    const totalPages = Math.ceil(state.total / 10);
    loadMoreBtn.hidden = state.page >= totalPages;
  } catch (err) {
    showToast('Failed to load more results.', true);
  } finally {
    loadMoreBtn.disabled = false;
    loadMoreBtn.textContent = 'Load more';
  }
}

async function fetchSearch(query, page = 1) {
  assertApiKey();
  const url = new URL(OMDB_ENDPOINT);
  // Search by title
  url.search = new URLSearchParams({
    apikey: OMDB_API_KEY,
    s: query,
    type: 'movie',
    page: String(page)
  }).toString();

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  if (data.Response === 'False') {
    showEmpty(data.Error || 'No results found.');
    return { results: [], totalResults: 0 };
  }

  // Normalize
  const results = (data.Search || []).map(r => ({
    imdbID: r.imdbID,
    Title: r.Title,
    Year: r.Year,
    Poster: r.Poster && r.Poster !== 'N/A' ? r.Poster : null,
    Type: r.Type
  }));

  return { results, totalResults: Number(data.totalResults || results.length) };
}

async function hydrateDetails(list) {
  // Fetch details in small parallel batches to avoid throttling
  const batchSize = 5;
  const chunks = [];
  for (let i = 0; i < list.length; i += batchSize) {
    chunks.push(list.slice(i, i + batchSize));
  }

  const detailed = [];
  for (const chunk of chunks) {
    const promises = chunk.map(item => fetchDetail(item.imdbID).then(d => ({ ...item, ...d })).catch(() => item));
    const results = await Promise.all(promises);
    detailed.push(...results);
  }
  return detailed;
}

async function fetchDetail(imdbID) {
  const url = new URL(OMDB_ENDPOINT);
  url.search = new URLSearchParams({
    apikey: OMDB_API_KEY,
    i: imdbID,
    plot: 'short'
  }).toString();
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.Response === 'False') throw new Error(data.Error || 'Detail not found');

  return {
    Rated: data.Rated,
    Runtime: data.Runtime,
    Genre: data.Genre,
    Plot: data.Plot,
    imdbRating: data.imdbRating,
    imdbVotes: data.imdbVotes
  };
}

// ============ FILTERS ============
function applyFilters() {
  const { genres, yearMin, yearMax, minRating } = state.filters;

  let filtered = [...state.items];

  if (genres.size) {
    filtered = filtered.filter(m => {
      const g = (m.Genre || '').split(',').map(s => s.trim().toLowerCase());
      return [...genres].some(sel => g.includes(sel.toLowerCase()));
    });
  }

  if (yearMin != null) {
    filtered = filtered.filter(m => parseInt((m.Year || '').slice(0, 4)) >= yearMin);
  }
  if (yearMax != null) {
    filtered = filtered.filter(m => parseInt((m.Year || '').slice(0, 4)) <= yearMax);
  }

  if (minRating != null) {
    filtered = filtered.filter(m => (parseFloat(m.imdbRating) || 0) >= minRating);
  }

  renderResults(filtered);

  const showing = filtered.length;
  const total = state.total || showing;
  showCount(`${showing} of ${total} results`);
  emptyState.hidden = showing !== 0;

  // Manage Load more visibility when filters are active
  const totalPages = Math.ceil(state.total / 10);
  loadMoreBtn.hidden = state.page >= totalPages && showing >= state.items.length;
}

function clearFilters() {
  state.filters.genres = new Set();
  state.filters.yearMin = null;
  state.filters.yearMax = null;
  state.filters.minRating = null;
  yearMinInput.value = '';
  yearMaxInput.value = '';
  minRatingInput.value = '';
  // Uncheck all genre chips
  [...genreChips.querySelectorAll('input[type="checkbox"]')].forEach(i => i.checked = false);
  applyFilters();
}

// ============ RENDER ============
function renderSkeletons(n = 8) {
  resultContainer.innerHTML = Array.from({ length: n }).map(() => `
    <div class="card skeleton">
      <div class="skel-poster"></div>
      <div class="card-body">
        <div class="skel-line" style="width:70%"></div>
        <div class="skel-line" style="width:45%"></div>
        <div class="skel-line" style="width:90%"></div>
      </div>
    </div>
  `).join('');
}

function renderResults(items) {
  if (!items.length) {
    resultContainer.innerHTML = '';
    emptyState.hidden = false;
    return;
  }
  const html = items.map(movie => renderCard(movie)).join('');
  resultContainer.innerHTML = html;

  // Attach action listeners (e.g., more info, open IMDb)
  resultContainer.querySelectorAll('[data-imdb]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-imdb');
      window.open(`https://www.imdb.com/title/${id}/`, '_blank', 'noopener');
    });
  });
}

function renderCard(m) {
  const poster = m.Poster || 'https://via.placeholder.com/300x450?text=No+Poster';
  const title = escapeHtml(m.Title || 'Untitled');
  const year = escapeHtml((m.Year || '').toString());
  const rating = m.imdbRating && m.imdbRating !== 'N/A' ? parseFloat(m.imdbRating).toFixed(1) : '—';
  const genres = escapeHtml(m.Genre || '');
  const plot = escapeHtml(m.Plot === 'N/A' ? '' : (m.Plot || ''));

  return `
    <article class="card">
      <img class="poster" src="${poster}" alt="Poster of ${title}" loading="lazy" />
      <div class="card-body">
        <div class="title-row">
          <div class="movie-title">${title}</div>
          <div class="badges">
            <span class="badge">${year || ''}</span>
            <span class="badge rating">⭐ ${rating}</span>
          </div>
        </div>
        <div class="genres">${genres}</div>
        ${plot ? `<div class="meta">${plot}</div>` : ''}
        <div class="actions">
          <button class="btn-mini" data-imdb="${m.imdbID}">Open IMDb</button>
        </div>
      </div>
    </article>
  `;
}

function showEmpty(text = 'Try searching for a movie title, or use filters above.') {
  emptyState.hidden = false;
  resultContainer.innerHTML = '';
  showCount(text);
}
function hideEmpty() {
  emptyState.hidden = true;
}
function showCount(text) {
  resultCount.textContent = text;
}

// ============ VOICE ============
function startVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('Voice not supported on this browser.', true);
    return;
  }
  const rec = new SpeechRecognition();
  rec.lang = 'en-US';
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    movieInput.value = transcript;
    beginSearch(transcript);
  };
  rec.onerror = () => showToast('Voice recognition error.', true);
  rec.start();
}

// ============ HELPERS ============
function showToast(msg, isError = false) {
  toast.textContent = msg;
  toast.style.borderColor = isError ? 'rgba(255,107,107,0.5)' : 'rgba(124,92,255,0.45)';
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toast.hidden = true;
  }, 2200);
}

function toNum(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}
function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
function assertApiKey() {
  if (!OMDB_API_KEY || OMDB_API_KEY === 'YOUR_OMDB_API_KEY') {
    throw new Error('Missing OMDb API key. Set OMDB_API_KEY in script.js.');
  }
}
