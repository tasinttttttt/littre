import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { normalise, getIndex, suggest, getEntry, cacheAllLetters, clearDataCache, rebuildCache, __resetForTesting } from './search.js';

describe('normalise', () => {
  it('lowercases input', () => {
    expect(normalise('AIMER')).toBe('aimer');
  });

  it('trims whitespace', () => {
    expect(normalise('  aimer  ')).toBe('aimer');
  });

  it('strips accents via NFD', () => {
    expect(normalise('élément')).toBe('element');
    expect(normalise('êtes')).toBe('etes');
    expect(normalise('à')).toBe('a');
  });

  it('handles mixed case with accents', () => {
    expect(normalise('ÉLÉMENT')).toBe('element');
  });

  it('passes through plain ASCII unchanged except lowercase', () => {
    expect(normalise('maison')).toBe('maison');
  });

  it('handles empty string', () => {
    expect(normalise('')).toBe('');
  });

  it('handles hyphenated words', () => {
    expect(normalise('AVANT-GARDE')).toBe('avant-garde');
  });
});

const mockIndex = {
  'A': ['AIMER', 'AILE', 'AMOUR', 'ÂGE', 'ABANDON'],
  'B': ['BABIL', 'BABILLER', 'BONHEUR'],
  'E': ['EAU', 'ENTENDRE', 'ÉCLAT', 'ÊTRE'],
  'M': ['MAISON', 'MONDE'],
  'O': ['OEUVRE', 'ORDRE'],
};

const mockLetterData = {
  'A': {
    'aimer': {
      mot: 'AIMER',
      sens: [
        { num: '1', mot: 'AIMER', prononciation: 'è-mé', nature: 'v. a.', html: '<div class="entry-variante">Avoir un sentiment d\'affection.</div>' },
        { num: '2', mot: 'AIMER', prononciation: 'è-mé', nature: 'v. n.', html: '<div class="entry-variante">Plaire à quelqu\'un.</div>' },
      ],
    },
    'aile': {
      mot: 'AILE',
      sens: [
        { num: null, mot: 'AILE', prononciation: 'è-l', nature: 'f.', html: '<div class="entry-variante">Membre dont les oiseaux se servent pour voler.</div>' },
      ],
    },
    'amour': {
      mot: 'AMOUR',
      sens: [
        { num: null, mot: 'AMOUR', prononciation: 'a-mour', nature: 'm.', html: '<div class="entry-variante">Mouvement du cœur qui porte à aimer.</div>' },
      ],
    },
    'age': {
      mot: 'ÂGE',
      sens: [
        { num: null, mot: 'ÂGE', prononciation: 'â-j', nature: 'm.', html: '<div class="entry-variante">Durée de la vie humaine.</div>' },
      ],
    },
    'abandon': {
      mot: 'ABANDON',
      sens: [
        { num: null, mot: 'ABANDON', prononciation: 'a-ban-don', nature: 'm.', html: '<div class="entry-variante">Action d\'abandonner.</div>' },
      ],
    },
  },
  'E': {
    'eau': {
      mot: 'EAU',
      sens: [
        { num: null, mot: 'EAU', prononciation: 'ô', nature: 'f.', html: '<div class="entry-variante">Liquide incolore, inodore.</div>' },
      ],
    },
    'entendre': {
      mot: 'ENTENDRE',
      sens: [
        { num: null, mot: 'ENTENDRE', prononciation: 'an-tan-dr', nature: 'v. a.', html: '<div class="entry-variante">Percevoir par l\'oreille.</div>' },
      ],
    },
    'eclat': {
      mot: 'ÉCLAT',
      sens: [
        { num: null, mot: 'ÉCLAT', prononciation: 'é-kla', nature: 'm.', html: '<div class="entry-variante">Lumière vive.</div>' },
      ],
    },
    'etre': {
      mot: 'ÊTRE',
      sens: [
        { num: null, mot: 'ÊTRE', prononciation: 'ê-tr', nature: 'v. n.', html: '<div class="entry-variante">Exister.</div>' },
      ],
    },
  },
  'O': {
    'oeuvre': {
      mot: 'OEUVRE',
      sens: [
        { num: null, mot: 'OEUVRE', prononciation: 'eu-vr', nature: 'f.', html: '<div class="entry-variante">Production de l\'esprit.</div>' },
      ],
    },
  },
};

describe('getIndex', () => {
  beforeEach(() => {
    __resetForTesting();
    globalThis.__mockFetch = undefined;
  });

  it('fetches index.json once and caches it', async () => {
    let fetchCalls = 0;
    globalThis.fetch = vi.fn(async (url) => {
      fetchCalls++;
      if (url === '/data/index.json') {
        return { ok: true, json: async () => mockIndex };
      }
      throw new Error('Unexpected fetch');
    });

    const { getIndex } = await import('./search.js');
    await getIndex();
    await getIndex();
    expect(fetchCalls).toBe(1);
  });

  it('throws if fetch fails', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false }));

    const { getIndex } = await import('./search.js');
    await expect(getIndex()).rejects.toThrow('Failed to load index');
  });
});

describe('suggest', () => {
  beforeEach(() => {
    __resetForTesting();
    globalThis.fetch = vi.fn(async (url) => {
      if (url === '/data/index.json') {
        return { ok: true, json: async () => mockIndex };
      }
      throw new Error('Unexpected fetch');
    });
  });

  it('returns matching headwords for a prefix', async () => {
    const results = await suggest('ai');
    expect(results).toEqual(['AIMER', 'AILE']);
  });

  it('is case-insensitive', async () => {
    const lower = await suggest('ai');
    const upper = await suggest('AI');
    expect(lower).toEqual(upper);
  });

  it('handles accented queries', async () => {
    const results = await suggest('éc');
    expect(results).toEqual(['ÉCLAT']);
  });

  it('returns empty array for no match', async () => {
    const results = await suggest('xyz');
    expect(results).toEqual([]);
  });

  it('returns empty array for empty query', async () => {
    const results = await suggest('');
    expect(results).toEqual([]);
  });

  it('respects the limit parameter', async () => {
    const results = await suggest('a', 2);
    expect(results.length).toBe(2);
    expect(results).toEqual(['AIMER', 'AILE']);
  });

  it('matches across letters correctly', async () => {
    const results = await suggest('en');
    expect(results).toEqual(['ENTENDRE']);
  });

  it('handles ê and ë stripped forms', async () => {
    const results = await suggest('et');
    expect(results).toEqual(['ÊTRE']);
  });
});

describe('getEntry', () => {
  beforeEach(() => {
    __resetForTesting();
    globalThis.fetch = vi.fn(async (url) => {
      if (url === '/data/index.json') {
        return { ok: true, json: async () => mockIndex };
      }
      if (url.startsWith('/data/') && url.endsWith('.json')) {
        const letter = url.replace('/data/', '').replace('.json', '');
        const data = mockLetterData[letter] || {};
        return { ok: true, json: async () => data };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
  });

  it('fetches letter file and returns entry', async () => {
    const entry = await getEntry('aimer');
    expect(entry).not.toBeNull();
    expect(entry.mot).toBe('AIMER');
    expect(entry.sens.length).toBe(2);
    expect(entry.sens[0].nature).toBe('v. a.');
  });

  it('returns entry with multi-sens structure', async () => {
    const entry = await getEntry('aimer');
    expect(entry.sens[0].num).toBe('1');
    expect(entry.sens[1].num).toBe('2');
    expect(entry.sens[0].html).toContain('affection');
  });

  it('returns entry with single sens', async () => {
    const entry = await getEntry('aile');
    expect(entry.sens.length).toBe(1);
    expect(entry.sens[0].num).toBeNull();
  });

  it('returns entry for accented query', async () => {
    const entry = await getEntry('éclat');
    expect(entry).not.toBeNull();
    expect(entry.mot).toBe('ÉCLAT');
  });

  it('caches letter file in memory', async () => {
    await getEntry('aimer');
    await getEntry('aile');
    const fetchCalls = globalThis.fetch.mock.calls.filter(
      ([url]) => url === '/data/A.json'
    ).length;
    expect(fetchCalls).toBe(1);
  });

  it('returns null for unknown word', async () => {
    const entry = await getEntry('inconnu');
    expect(entry).toBeNull();
  });

  it('returns null for empty word', async () => {
    const entry = await getEntry('');
    expect(entry).toBeNull();
  });

  it('returns null if letter file fetch fails', async () => {
    __resetForTesting();
    globalThis.fetch = vi.fn(async (url) => {
      if (url === '/data/index.json') {
        return { ok: true, json: async () => mockIndex };
      }
      if (url === '/data/B.json') {
        return { ok: false };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const entry = await getEntry('babil');
    expect(entry).toBeNull();
  });

  it('handles Œ → O mapping', async () => {
    const entry = await getEntry('oeuvre');
    expect(entry).not.toBeNull();
    expect(entry.mot).toBe('OEUVRE');
  });

  it('is case-insensitive for lookup', async () => {
    const lower = await getEntry('aimer');
    const upper = await getEntry('AIMER');
    expect(lower).toEqual(upper);
  });
});

describe('cacheAllLetters', () => {
  beforeEach(() => {
    __resetForTesting();
    globalThis.fetch = vi.fn(async (url) => {
      if (url === '/data/index.json') {
        return { ok: true, json: async () => mockIndex };
      }
      if (url.startsWith('/data/') && url.endsWith('.json')) {
        const letter = url.replace('/data/', '').replace('.json', '');
        const data = mockLetterData[letter] || {};
        return { ok: true, json: async () => data };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
  });

  it('fetches all letter files', async () => {
    await cacheAllLetters();
    const letters = ['A', 'B', 'E', 'M', 'O'];
    for (const letter of letters) {
      expect(globalThis.fetch).toHaveBeenCalledWith(`/data/${letter}.json`);
    }
  });

  it('calls onProgress for each letter', async () => {
    const progress = vi.fn();
    await cacheAllLetters(progress);
    expect(progress).toHaveBeenCalledTimes(5);
    expect(progress).toHaveBeenNthCalledWith(1, 1, 5);
    expect(progress).toHaveBeenNthCalledWith(5, 5, 5);
  });

  it('throws if a letter fetch fails', async () => {
    __resetForTesting();
    globalThis.fetch = vi.fn(async (url) => {
      if (url === '/data/index.json') {
        return { ok: true, json: async () => mockIndex };
      }
      if (url === '/data/A.json' || url === '/data/M.json' || url === '/data/O.json') {
        const letter = url.replace('/data/', '').replace('.json', '');
        return { ok: true, json: async () => mockLetterData[letter] || {} };
      }
      if (url === '/data/B.json') {
        return { ok: false };
      }
      const letter = url.replace('/data/', '').replace('.json', '');
      return { ok: true, json: async () => mockLetterData[letter] || {} };
    });

    await expect(cacheAllLetters()).rejects.toThrow('Failed to fetch B.json');
  });

  it('populates in-memory cache', async () => {
    await cacheAllLetters();
    const entry = await getEntry('aimer');
    expect(entry).not.toBeNull();
  });
});

describe('clearDataCache', () => {
  beforeEach(() => {
    __resetForTesting();
    globalThis.caches = {
      delete: vi.fn(async () => true),
    };
  });

  afterEach(() => {
    delete globalThis.caches;
  });

  it('deletes the SW data cache', async () => {
    await clearDataCache();
    expect(globalThis.caches.delete).toHaveBeenCalledWith('littre-data-v1');
  });
});

describe('rebuildCache', () => {
  beforeEach(() => {
    __resetForTesting();
    globalThis.caches = {
      delete: vi.fn(async () => true),
    };
    globalThis.fetch = vi.fn(async (url) => {
      if (url === '/data/index.json') {
        return { ok: true, json: async () => mockIndex };
      }
      if (url.startsWith('/data/') && url.endsWith('.json')) {
        const letter = url.replace('/data/', '').replace('.json', '');
        const data = mockLetterData[letter] || {};
        return { ok: true, json: async () => data };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
  });

  afterEach(() => {
    delete globalThis.caches;
  });

  it('clears then fetches all letters', async () => {
    await rebuildCache();
    expect(globalThis.caches.delete).toHaveBeenCalledWith('littre-data-v1');
    expect(globalThis.fetch).toHaveBeenCalledWith('/data/A.json');
    expect(globalThis.fetch).toHaveBeenCalledWith('/data/B.json');
  });

  it('calls onProgress with correct counts', async () => {
    const progress = vi.fn();
    await rebuildCache(progress);
    expect(progress).toHaveBeenCalledTimes(5);
    expect(progress).toHaveBeenNthCalledWith(5, 5, 5);
  });
});
