let letterCache = {};

function normalise(word) {
  return word.toLowerCase().trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

let index = null;
async function getIndex() {
  if (index) return index;
  const res = await fetch('/data/index.json');
  if (!res.ok) throw new Error('Failed to load index');
  index = await res.json();
  return index;
}

async function suggest(query, limit = 10) {
  if (!query || query.length === 0) return [];
  const idx = await getIndex();
  const norm = normalise(query);
  const letter = norm[0].toUpperCase();
  const candidates = idx[letter] ?? [];
  return candidates
    .filter(w => normalise(w).startsWith(norm))
    .slice(0, limit);
}

async function getEntry(word) {
  if (!word || word.length === 0) return null;
  const norm = normalise(word);
  const letter = norm[0].toUpperCase();
  if (!letterCache[letter]) {
    const res = await fetch(`/data/${letter}.json`);
    if (!res.ok) return null;
    letterCache[letter] = await res.json();
  }

  if (letterCache[letter][norm]) {
    return letterCache[letter][norm];
  }

  for (let i = 2; i <= 10; i++) {
    const homographKey = `${norm}_${i}`;
    if (letterCache[letter][homographKey]) {
      return letterCache[letter][homographKey];
    }
  }

  return null;
}

async function getAllLetters() {
  const idx = await getIndex();
  return Object.keys(idx).filter(key => key !== '__version__');
}

async function cacheLetter(letter) {
  const res = await fetch(`/data/${letter}.json`);
  if (!res.ok) throw new Error(`Failed to fetch ${letter}.json`);
  letterCache[letter] = await res.json();
}

async function cacheAllLetters(onProgress) {
  const letters = await getAllLetters();
  for (let i = 0; i < letters.length; i++) {
    await cacheLetter(letters[i]);
    if (onProgress) onProgress(i + 1, letters.length);
  }
}

async function clearDataCache() {
  if ('caches' in window) {
    await caches.delete('littre-data-v1');
  }
  letterCache = {};
}

async function rebuildCache(onProgress) {
  await clearDataCache();
  await cacheAllLetters(onProgress);
}

export { normalise, getIndex, suggest, getEntry, getAllLetters, cacheAllLetters, clearDataCache, rebuildCache };

export function __resetForTesting() {
  letterCache = {};
  index = null;
}
