# Littré PWA

Progressive Web App for the [Littré](https://www.littre.org) dictionary — fully offline-capable, zero backend.
I couldn't find an ok alternative, so here we are. It is rudimentary but useful.

## Requirements

- [Node.js](https://nodejs.org/) ≥ 18
- [Python](https://www.python.org/) ≥ 3.10
- [uv](https://docs.astral.sh/uv/) — fast Python package manager

## Quick start

### 1. Setup

```bash
# Install dependencies
npm install
uv sync --group dev
```

### 2. Initialize data

Fetch the XMLittré source data (tries GitHub light mirror, falls back to original Bitbucket):

```bash
npm run init:data
```

This clones `xmlittre-data/` into the project root. To update later, run the same command again — it will `git pull` instead of re-cloning.

### 3. Generate JSON from XML

```bash
npm run build:data
```

Converts ~97 MB of XML into 27 JSON files (97 MB uncompressed, 22 MB gzipped):

| File                | Uncompressed | Gzipped   | Purpose                                        |
| ------------------- | ------------ | --------- | ---------------------------------------------- |
| `index.json`        | 1.4 MB       | 272 KB    | All headwords grouped by letter (autocomplete) |
| `A.json`            | 12 MB        | 2.6 MB    | Full entries for A                             |
| `B.json` – `Z.json` | 84 MB        | 19 MB     | Full entries per letter                        |
| **Total**           | **97 MB**    | **22 MB** | 75,894 entries, 78,599 meanings                |

Keys are **normalized** (lowercase, NFD accent-stripped) so `ÉLÉMENT` → `element`. Multiple meanings with the same headword are merged into a `sens[]` array.

### 4. Compress for production

```bash
npm run compress:data
```

Creates `.gz` variants of all JSON files. Most static hosts serve these automatically with `Content-Encoding: gzip`.

### 5. Development

```bash
npm run dev
```

Starts Vite dev server at `http://localhost:3000`.

### 6. Production build

```bash
# Build app only (data must already exist)
npm run build

# Or build everything in one command: init → data → compress → app
npm run build:all
```

Outputs to `dist/`. The service worker is automatically updated with the correct asset hashes.

### 7. Preview

```bash
npm run preview
```

Serves the production `dist/` locally for testing.

### 8. Deploy

Copy the contents of `dist/` to any static file host:

```bash
npm run build
# Upload dist/ to Cloudflare Pages, Netlify, nginx, Apache, etc.
```

No build step on the server. No API. No database.

---

## Data pipeline

```
XMLittré XML  ──►  xml_to_json.py  ──►  index.json + A-Z.json  ──►  gzip  ──►  .gz files
```

The build script (`build/xml_to_json.py`) handles:

- **Normalization**: `ÉLÉMENT` → `element` (NFD, strip combining marks)
- **Letter mapping**: `Æ` → `A`, `Œ` → `O`
- **Multi-meaning merging**: entries with the same normalized headword are grouped — each `<entree>` becomes one element in a `sens[]` array
- **HTML generation**: XML elements (`<cit>`, `<rubrique>`, `<variante>`, `<indent>`, `<a>`, `<i>`, `<semantique>`) → semantic HTML for display

### Entry structure

```json
{
  "a": {
    "mot": "A",
    "sens": [
      { "num": "1", "mot": "A", "entete": "<div class=\"entry-entete\"><span class=\"entry-prononciation\">â</span> <span class=\"entry-nature\">s. m.</span></div>", "html": "..." },
      { "num": "2", "mot": "A", "entete": "<div class=\"entry-entete\"><span class=\"entry-prononciation\">a</span></div>", "html": "..." },
      { "num": null, "mot": "À", "entete": "<div class=\"entry-entete\"><span class=\"entry-prononciation\">a</span> <span class=\"entry-nature\">prép.</span></div>", "html": "..." }
    ]
  }
}
```

## Service Worker

| Phase            | Behavior                                                                        |
| ---------------- | ------------------------------------------------------------------------------- |
| **Install**      | Precaches app shell + `index.json` (autocomplete available immediately offline) |
| **Fetch (app)**  | Cache-first — serves from cache, falls back to network                          |
| **Fetch (data)** | Cache-first for `/data/*.json` — letter files cached on first access            |
| **Activate**     | Deletes old caches, claims clients                                              |
| **Update**       | Detects new SW, shows reload toast, refreshes on `controllerchange`             |

Letter files are served offline forever after first access. The cache button (🖫) in the header lets users download all 25 letter files at once or rebuild the cache from scratch.

## Testing

```bash
# All tests
npm test                              # JavaScript (vitest, 34 tests)
uv run pytest build/test_xml_to_json.py -v  # Python (pytest, 25 tests)

# Watch mode
npm run test:watch
```

## Deployment

### Serving pre-compressed `.gz` data

The dictionary data is **97 MB uncompressed**, reducing to **22 MB gzipped** (77% compression). The app only requests `.json` files — the server must serve the `.gz` variant with `Content-Encoding: gzip` when available.

**Cloudflare Pages** and **Netlify** handle this automatically — no config needed.

**nginx** — add to your server or location block:

```nginx
# Disable on-the-fly gzip (save CPU, use pre-compressed files)
gzip off;

# Serve .gz files directly when available
location /data/ {
    gzip_static on;
}
```

**Apache** — place this `.htaccess` at the root of your deployed site:

```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteCond %{HTTP:Accept-Encoding} gzip
    RewriteCond %{DOCUMENT_ROOT}/data/%{REQUEST_URI}.gz -f
    RewriteRule ^(data/.+\.json)$ $1.gz [L]
</IfModule>

<IfModule mod_headers.c>
    <FilesMatch "\.json\.gz$">
        ForceType application/json
        Header set Content-Encoding gzip
    </FilesMatch>
</IfModule>
```

## Attributions

**Dictionary text** — Dictionnaire de la langue française par Émile Littré, public domain.

**XML structure** by [François Gannaz](https://www.littre.org) / [XMLittré](https://bitbucket.org/Mytskine/xmlittre-data) — licensed under [CC-BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). Attribution is included in the app footer.

**Computer Modern font** — designed by Donald E. Knuth, distributed under the [SIL Open Font License](https://scripts.sil.org/OFL).
