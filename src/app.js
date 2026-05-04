import {
  suggest,
  getEntry,
  cacheAllLetters,
  clearDataCache,
  rebuildCache,
  getIndex,
  normalise,
} from "./search.js";

const searchInput = document.getElementById("search-input");
const searchForm = document.getElementById("search-form");
const autocompleteList = document.getElementById("autocomplete-list");
const entryView = document.getElementById("entry-view");
const homeView = document.getElementById("home-view");
const notFoundView = document.getElementById("not-found-view");
const loadingView = document.getElementById("loading-view");
const fontBtn = document.getElementById("font-btn");
const fontPanel = document.getElementById("font-panel");
const fontDecrease = document.getElementById("font-decrease");
const fontIncrease = document.getElementById("font-increase");
const fontClose = document.getElementById("font-close");
const themeBtn = document.getElementById("theme-btn");
const cacheBtn = document.getElementById("cache-btn");
const cachePanel = document.getElementById("cache-panel");
const cacheDownload = document.getElementById("cache-download");
const cacheRebuild = document.getElementById("cache-rebuild");
const cacheProgress = document.getElementById("cache-progress");
const cacheProgressFill = document.getElementById("cache-progress-fill");
const cacheProgressText = document.getElementById("cache-progress-text");
const cacheClose = document.getElementById("cache-close");
const cacheVersion = document.getElementById("cache-version");
const updateToast = document.getElementById("update-toast");
const updateBtn = document.getElementById("update-btn");

let activeIndex = -1;
let currentQuery = "";
let debounceTimer = null;

function showView(view) {
  entryView.classList.add("hidden");
  homeView.classList.add("hidden");
  notFoundView.classList.add("hidden");
  loadingView.classList.add("hidden");
  view.classList.remove("hidden");
}

function hideAutocomplete() {
  autocompleteList.classList.remove("visible");
  autocompleteList.innerHTML = "";
  activeIndex = -1;
}

function showAutocomplete(items) {
  autocompleteList.innerHTML = "";
  if (items.length === 0) {
    hideAutocomplete();
    return;
  }
  items.forEach((item, i) => {
    const el = document.createElement("div");
    el.className = "autocomplete-item";
    el.setAttribute("role", "option");
    el.textContent = item;
    el.dataset.index = i;
    el.addEventListener("click", () => {
      searchInput.value = item;
      hideAutocomplete();
      loadEntry(item);
    });
    autocompleteList.appendChild(el);
  });
  autocompleteList.classList.add("visible");
}

function setActiveAutocomplete(index) {
  const items = autocompleteList.querySelectorAll(".autocomplete-item");
  items.forEach((el, i) => {
    el.classList.toggle("active", i === index);
  });
  activeIndex = index;
  if (index >= 0 && index < items.length) {
    items[index].scrollIntoView({ block: "nearest" });
  }
}

async function handleSearch(query) {
  currentQuery = query;
  hideAutocomplete();
  if (!query || query.trim().length === 0) {
    showView(homeView);
    return;
  }
  try {
    const suggestions = await suggest(query.trim(), 10);
    if (suggestions.length > 0) {
      showAutocomplete(suggestions);
    }
  } catch (e) {
    console.error("Search error:", e);
  }
}

async function loadEntry(word, sensNum = null) {
  showView(loadingView);
  hideAutocomplete();

  try {
    const entry = await getEntry(word);
    if (entry) {
      renderEntry(entry);
      showView(entryView);
      searchInput.value = word;
      const hashVal = sensNum
        ? `#word=${encodeURIComponent(word)}.${sensNum}`
        : `#word=${encodeURIComponent(word)}`;
      history.pushState({ word, sens: sensNum }, "", hashVal);
      if (sensNum) setTimeout(() => scrollToSens(sensNum), 100);
    } else {
      showView(notFoundView);
    }
  } catch (e) {
    console.error("Entry load error:", e);
    showView(notFoundView);
  }
}

function renderEntry(entry) {
  let html = "";
  html += `<h2 class="entry-headword">${escapeHtml(entry.mot)}</h2>`;

  for (const sens of entry.sens) {
    html += `<div class="entry-sens">`;
    if (sens.mot && sens.mot !== entry.mot) {
      html += `<h3 class="entry-sens-term">${escapeHtml(sens.mot)}</h3>`;
    }
    if (entry.sens.length > 1 && sens.num) {
      html += `<h3 class="entry-sens-num" id="sens-${sens.num}">${sens.num}.</h3>`;
    }
    if (sens.entete) {
      html += sens.entete;
    }
    if (sens.html) {
      html += sens.html;
    }
    html += `</div>`;
  }
  entryView.innerHTML = html;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function scrollToSens(num) {
  const el = document.getElementById(`sens-${num}`);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

entryView.addEventListener("click", async (e) => {
  const link = e.target.closest("a.entry-ref");
  if (!link) return;
  const hash = link.getAttribute("href");
  if (!hash || !hash.startsWith("#")) return;

  e.preventDefault();

  const raw = hash.slice(1);
  const [refPart] = raw.split("#");
  const [wordPart, sensPart] = refPart.split(".");

  const norm = normalise(wordPart);
  const letter = norm[0]?.toUpperCase();
  if (!letter) return;

  try {
    const idx = await getIndex();
    const candidates = idx[letter] ?? [];
    const match = candidates.find((w) => normalise(w) === norm);
    if (match) {
      const sens = sensPart ? parseInt(sensPart) : null;
      loadEntry(match, sens);
    }
  } catch {}
});

async function handleHash() {
  const hash = location.hash.slice(1);
  if (!hash || !hash.startsWith("word=")) return;

  const value = decodeURIComponent(hash.slice(5));
  const dotIdx = value.lastIndexOf(".");
  let word, sensNum;
  if (dotIdx > 0 && /^\d+$/.test(value.slice(dotIdx + 1))) {
    word = value.slice(0, dotIdx);
    sensNum = parseInt(value.slice(dotIdx + 1));
  } else {
    word = value;
    sensNum = null;
  }
  loadEntry(word, sensNum);
}

window.addEventListener("hashchange", () => handleHash());

if (location.hash && location.hash.startsWith("#word=")) {
  handleHash();
}

searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const query = searchInput.value.trim();
  if (query) {
    hideAutocomplete();
    loadEntry(query);
  }
});

searchInput.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  const query = searchInput.value;
  debounceTimer = setTimeout(() => handleSearch(query), 300);
});

searchInput.addEventListener("keydown", (e) => {
  const items = autocompleteList.querySelectorAll(".autocomplete-item");
  if (!items.length) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    const next = Math.min(activeIndex + 1, items.length - 1);
    setActiveAutocomplete(next);
    searchInput.value = items[next].textContent;
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    const prev = Math.max(activeIndex - 1, 0);
    setActiveAutocomplete(prev);
    searchInput.value = items[prev].textContent;
  } else if (e.key === "Enter" && activeIndex >= 0) {
    e.preventDefault();
    searchInput.value = items[activeIndex].textContent;
    hideAutocomplete();
    loadEntry(items[activeIndex].textContent);
  } else if (e.key === "Escape") {
    hideAutocomplete();
  }
});

document.addEventListener("click", (e) => {
  if (!autocompleteList.contains(e.target) && e.target !== searchInput) {
    hideAutocomplete();
  }
  if (!cachePanel.contains(e.target) && !e.target.closest("#cache-btn")) {
    hideCachePanel();
  }
  if (!fontPanel.contains(e.target) && !e.target.closest("#font-btn")) {
    fontPanel.classList.remove("visible");
    fontPanel.classList.add("hidden");
  }
});

window.addEventListener("popstate", (e) => {
  if (e.state?.word) {
    loadEntry(e.state.word, e.state.sens);
  } else {
    hideAutocomplete();
    searchInput.value = "";
    showView(homeView);
    history.pushState(null, "", "/");
    searchInput.focus();
  }
});

let fontSize = parseInt(localStorage.getItem("littre-font-size") || "20", 10);
function applyFontSize() {
  document.documentElement.style.setProperty(
    "--entry-font-size",
    `${fontSize}px`,
  );
  localStorage.setItem("littre-font-size", fontSize);
}
applyFontSize();

fontBtn.addEventListener("click", () => {
  fontPanel.classList.toggle("hidden");
  fontPanel.classList.toggle("visible");
  cachePanel.classList.remove("visible");
  cachePanel.classList.add("hidden");
});

fontClose.addEventListener("click", () => {
  fontPanel.classList.remove("visible");
  fontPanel.classList.add("hidden");
});

fontDecrease.addEventListener("click", () => {
  if (fontSize > 8) {
    fontSize -= 1;
    applyFontSize();
  }
});

fontIncrease.addEventListener("click", () => {
  if (fontSize < 48) {
    fontSize += 1;
    applyFontSize();
  }
});

let theme = localStorage.getItem("littre-theme") || "auto";
function applyTheme() {
  if (theme === "auto") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
  localStorage.setItem("littre-theme", theme);
}
applyTheme();

themeBtn.addEventListener("click", () => {
  if (theme === "auto") {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    theme = prefersDark ? "light" : "dark";
  } else if (theme === "dark") {
    theme = "light";
  } else {
    theme = "auto";
  }
  applyTheme();
});

window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", () => {
    if (theme === "auto") return;
    applyTheme();
  });

function hideCachePanel() {
  cachePanel.classList.remove("visible");
  cachePanel.classList.add("hidden");
  cacheProgress.classList.add("hidden");
  setProgressText("");
  setProgressFill(0);
  enableCacheButtons(true);
}

function setProgressText(text) {
  cacheProgressText.textContent = text;
}

function setProgressFill(pct) {
  cacheProgressFill.style.width = `${pct}%`;
}

function enableCacheButtons(enabled) {
  cacheDownload.disabled = !enabled;
  cacheRebuild.disabled = !enabled;
}

function onProgress(current, total) {
  setProgressText(`${current} / ${total} lettres`);
  setProgressFill((current / total) * 100);
}

async function doDownload() {
  enableCacheButtons(false);
  cacheProgress.classList.remove("hidden");
  try {
    await cacheAllLetters(onProgress);
    setProgressText("Lettres téléchargées ✓");
  } catch (e) {
    setProgressText(`Erreur: ${e.message}`);
  }
}

async function doRebuild() {
  enableCacheButtons(false);
  cacheProgress.classList.remove("hidden");
  try {
    await rebuildCache(onProgress);
    setProgressText("Cache reconstruit ✓");
  } catch (e) {
    setProgressText(`Erreur: ${e.message}`);
  }
}

cacheBtn.addEventListener("click", () => {
  cachePanel.classList.toggle("hidden");
  cachePanel.classList.toggle("visible");
  fontPanel.classList.remove("visible");
  fontPanel.classList.add("hidden");
});

cacheClose.addEventListener("click", hideCachePanel);
cacheDownload.addEventListener("click", doDownload);
cacheRebuild.addEventListener("click", doRebuild);

async function loadVersion() {
  try {
    const res = await fetch("/data/index.json");
    if (res.ok) {
      const data = await res.json();
      if (data.__version__) {
        const date = new Date(data.__version__);
        cacheVersion.textContent = `Version: ${date.toLocaleDateString("fr-FR")} ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
      }
    }
  } catch {}
}
loadVersion();

navigator.serviceWorker.addEventListener("controllerchange", () => {
  window.location.reload();
});

async function checkForUpdate() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    reg.addEventListener("updatefound", () => {
      const newSW = reg.installing;
      newSW.addEventListener("statechange", () => {
        if (newSW.state === "installed" && navigator.serviceWorker.controller) {
          updateToast.classList.remove("hidden");
        }
      });
    });
  } catch {}
}
checkForUpdate();

updateBtn.addEventListener("click", () => {
  window.location.reload();
});

searchInput.focus();
