const STORAGE_KEY = "sam256.lifeInWeeks.v1";
const SETTINGS_KEY = "sam256.lifeInWeeks.settings.v1";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const WEEKS_PER_YEAR = 52;

const defaults = {
  birthDate: "1990-07-14",
  lifeYears: 90,
  cellSize: 10,
  autoPast: true,
  circle: false,
};

let settings = loadJSON(SETTINGS_KEY, defaults);
let weeks = loadJSON(STORAGE_KEY, {});
let activeWeekIndex = null;
let searchTerm = "";

const el = {
  root: document.documentElement,
  body: document.body,
  weekAxis: document.getElementById("weekAxis"),
  yearAxis: document.getElementById("yearAxis"),
  lifeGrid: document.getElementById("lifeGrid"),
  birthDate: document.getElementById("birthDate"),
  lifeYears: document.getElementById("lifeYears"),
  cellSize: document.getElementById("cellSize"),
  paintMode: document.getElementById("paintMode"),
  autoPast: document.getElementById("autoPast"),
  shapeToggle: document.getElementById("shapeToggle"),
  todayButton: document.getElementById("todayButton"),
  exportButton: document.getElementById("exportButton"),
  importFile: document.getElementById("importFile"),
  resetButton: document.getElementById("resetButton"),
  searchInput: document.getElementById("searchInput"),
  clearSearch: document.getElementById("clearSearch"),
  dialog: document.getElementById("weekDialog"),
  weekForm: document.getElementById("weekForm"),
  weekMeta: document.getElementById("weekMeta"),
  dialogTitle: document.getElementById("dialogTitle"),
  noteTitle: document.getElementById("noteTitle"),
  noteBody: document.getElementById("noteBody"),
  noteTags: document.getElementById("noteTags"),
  saveWeek: document.getElementById("saveWeek"),
  deleteWeek: document.getElementById("deleteWeek"),
  weeksLived: document.getElementById("weeksLived"),
  weeksLeft: document.getElementById("weeksLeft"),
  noteCount: document.getElementById("noteCount"),
  lifePercent: document.getElementById("lifePercent"),
  toastTemplate: document.getElementById("toastTemplate"),
  toastHost: document.getElementById("toastHost"),
};

init();

function init() {
  bindControls();
  hydrateControls();
  applySettings();
  renderAll();
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : { ...fallback };
  } catch (error) {
    console.warn(`Could not load ${key}`, error);
    return { ...fallback };
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function bindControls() {
  el.birthDate.addEventListener("change", () => updateSetting("birthDate", el.birthDate.value));
  el.lifeYears.addEventListener("change", () => {
    const safeYears = clamp(parseInt(el.lifeYears.value, 10) || defaults.lifeYears, 1, 140);
    updateSetting("lifeYears", safeYears, true);
  });
  el.cellSize.addEventListener("input", () => updateSetting("cellSize", parseInt(el.cellSize.value, 10) || defaults.cellSize));
  el.autoPast.addEventListener("change", () => updateSetting("autoPast", el.autoPast.checked));
  el.shapeToggle.addEventListener("change", () => updateSetting("circle", el.shapeToggle.checked));
  el.todayButton.addEventListener("click", jumpToNow);
  el.exportButton.addEventListener("click", exportData);
  el.importFile.addEventListener("change", importData);
  el.resetButton.addEventListener("click", resetData);
  el.searchInput.addEventListener("input", () => {
    searchTerm = el.searchInput.value.trim().toLowerCase();
    updateSearchMatches();
  });
  el.clearSearch.addEventListener("click", () => {
    el.searchInput.value = "";
    searchTerm = "";
    updateSearchMatches();
  });
  el.weekForm.addEventListener("submit", saveActiveWeek);
  el.deleteWeek.addEventListener("click", deleteActiveWeek);
  el.dialog.addEventListener("click", (event) => {
    if (event.target === el.dialog) el.dialog.close();
  });
}

function hydrateControls() {
  el.birthDate.value = settings.birthDate;
  el.lifeYears.value = settings.lifeYears;
  el.cellSize.value = settings.cellSize;
  el.autoPast.checked = settings.autoPast;
  el.shapeToggle.checked = settings.circle;
}

function updateSetting(key, value, rerender = false) {
  settings[key] = value;
  saveJSON(SETTINGS_KEY, settings);
  applySettings();
  if (rerender || ["birthDate", "lifeYears"].includes(key)) {
    renderAll();
  } else {
    refreshComputedClasses();
    updateStats();
  }
}

function applySettings() {
  el.root.style.setProperty("--cell", `${settings.cellSize}px`);
  el.root.style.setProperty("--years", settings.lifeYears);
  el.body.classList.toggle("circle", settings.circle);
}

function renderAll() {
  renderAxes();
  renderGrid();
  updateStats();
  updateSearchMatches();
}

function renderAxes() {
  el.weekAxis.innerHTML = "";
  for (let week = 1; week <= WEEKS_PER_YEAR; week += 1) {
    const span = document.createElement("span");
    span.textContent = week % 4 === 0 || week === 1 || week === 52 ? week : "";
    if (week % 4 === 0 || week === 1 || week === 52) span.classList.add("major");
    el.weekAxis.appendChild(span);
  }

  el.yearAxis.innerHTML = "";
  for (let year = 0; year < settings.lifeYears; year += 1) {
    const span = document.createElement("span");
    span.textContent = year % 5 === 0 || year === settings.lifeYears - 1 ? year : "";
    if (year % 5 === 0 || year === settings.lifeYears - 1) span.classList.add("major");
    el.yearAxis.appendChild(span);
  }
}

function renderGrid() {
  el.lifeGrid.innerHTML = "";
  const totalWeeks = totalWeekCount();
  const currentWeek = currentWeekIndex();
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < totalWeeks; index += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "life-cell";
    button.dataset.week = index;
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", labelForWeek(index));
    button.title = titleForWeek(index);
    button.addEventListener("click", () => handleCellClick(index));
    button.addEventListener("keydown", (event) => handleCellKeydown(event, index));
    applyCellState(button, index, currentWeek);
    fragment.appendChild(button);
  }

  el.lifeGrid.appendChild(fragment);
}

function handleCellClick(index) {
  const mode = el.paintMode.value;
  if (mode === "note") {
    openWeek(index);
    return;
  }
  paintWeek(index, mode);
}

function handleCellKeydown(event, index) {
  const columns = WEEKS_PER_YEAR;
  let next = null;
  if (event.key === "ArrowRight") next = index + 1;
  if (event.key === "ArrowLeft") next = index - 1;
  if (event.key === "ArrowDown") next = index + columns;
  if (event.key === "ArrowUp") next = index - columns;
  if (next === null) return;
  event.preventDefault();
  const cell = el.lifeGrid.querySelector(`[data-week="${next}"]`);
  if (cell) cell.focus();
}

function paintWeek(index, mode) {
  const data = cleanWeekData(weeks[index] || {});
  if (mode === "clear") {
    data.status = "none";
  } else {
    data.status = mode;
  }
  if (isEmptyWeek(data)) delete weeks[index];
  else weeks[index] = data;
  saveWeeksAndRefresh();
}

function openWeek(index) {
  activeWeekIndex = index;
  const data = weeks[index] || {};
  const range = dateRangeForWeek(index);
  el.weekMeta.textContent = `${formatDate(range.start)} → ${formatDate(range.end)} · year ${Math.floor(index / WEEKS_PER_YEAR)}, week ${(index % WEEKS_PER_YEAR) + 1}`;
  el.dialogTitle.textContent = `Week ${index + 1}`;
  el.noteTitle.value = data.title || "";
  el.noteBody.value = data.body || "";
  el.noteTags.value = data.tags || "";
  const status = data.status || "none";
  const radio = el.weekForm.querySelector(`input[name="status"][value="${status}"]`);
  if (radio) radio.checked = true;
  if (typeof el.dialog.showModal === "function") {
    el.dialog.showModal();
  } else {
    // Fallback for older browsers.
    const title = prompt("Week title", data.title || "");
    if (title !== null) {
      weeks[index] = { ...data, title };
      saveWeeksAndRefresh();
    }
  }
}

function saveActiveWeek(event) {
  event.preventDefault();
  if (activeWeekIndex === null) return;

  const status = el.weekForm.querySelector("input[name='status']:checked")?.value || "none";
  const data = cleanWeekData({
    title: el.noteTitle.value,
    body: el.noteBody.value,
    tags: el.noteTags.value,
    status,
    updatedAt: new Date().toISOString(),
  });

  if (isEmptyWeek(data)) delete weeks[activeWeekIndex];
  else weeks[activeWeekIndex] = data;

  saveWeeksAndRefresh();
  el.dialog.close();
  toast("Week saved.");
}

function deleteActiveWeek() {
  if (activeWeekIndex === null) return;
  delete weeks[activeWeekIndex];
  saveWeeksAndRefresh();
  el.dialog.close();
  toast("Week cleared.");
}

function cleanWeekData(data) {
  return {
    title: (data.title || "").trim(),
    body: (data.body || "").trim(),
    tags: (data.tags || "").trim(),
    status: data.status && data.status !== "none" ? data.status : "none",
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
}

function isEmptyWeek(data) {
  return !data.title && !data.body && !data.tags && (!data.status || data.status === "none");
}

function saveWeeksAndRefresh() {
  saveJSON(STORAGE_KEY, weeks);
  refreshComputedClasses();
  updateStats();
  updateSearchMatches();
}

function refreshComputedClasses() {
  const currentWeek = currentWeekIndex();
  el.lifeGrid.querySelectorAll(".life-cell").forEach((cell) => {
    applyCellState(cell, Number(cell.dataset.week), currentWeek);
  });
}

function applyCellState(cell, index, currentWeek) {
  const data = weeks[index] || {};
  const status = data.status || "none";
  const hasNote = Boolean(data.title || data.body || data.tags);
  const isPast = index < currentWeek;
  const isNow = index === currentWeek;

  cell.className = "life-cell";
  if (isPast) cell.classList.add("past");
  if (isNow) cell.classList.add("now");
  if (settings.autoPast && isPast) cell.classList.add("auto-cross");
  if (["highlight", "crossed", "milestone"].includes(status)) cell.classList.add(status);
  if (hasNote) cell.classList.add("noted");

  cell.setAttribute("aria-label", labelForWeek(index));
  cell.title = titleForWeek(index);
}

function updateSearchMatches() {
  el.lifeGrid.querySelectorAll(".life-cell.match").forEach((cell) => cell.classList.remove("match"));
  if (!searchTerm) return;

  Object.entries(weeks).forEach(([index, data]) => {
    const haystack = `${data.title || ""} ${data.body || ""} ${data.tags || ""}`.toLowerCase();
    if (haystack.includes(searchTerm)) {
      const cell = el.lifeGrid.querySelector(`[data-week="${index}"]`);
      if (cell) cell.classList.add("match");
    }
  });
}

function updateStats() {
  const total = totalWeekCount();
  const lived = clamp(currentWeekIndex(), 0, total);
  const left = Math.max(total - lived, 0);
  const notes = Object.values(weeks).filter((week) => week.title || week.body || week.tags).length;
  const percent = total ? Math.min(100, (lived / total) * 100) : 0;

  el.weeksLived.textContent = lived.toLocaleString();
  el.weeksLeft.textContent = left.toLocaleString();
  el.noteCount.textContent = notes.toLocaleString();
  el.lifePercent.textContent = `${percent.toFixed(1)}%`;
}

function totalWeekCount() {
  return settings.lifeYears * WEEKS_PER_YEAR;
}

function currentWeekIndex() {
  const birth = parseLocalDate(settings.birthDate);
  if (!birth) return 0;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((today - birth) / WEEK_MS);
}

function dateRangeForWeek(index) {
  const start = addDays(parseLocalDate(settings.birthDate), index * 7);
  const end = addDays(start, 6);
  return { start, end };
}

function labelForWeek(index) {
  const range = dateRangeForWeek(index);
  const data = weeks[index] || {};
  const title = data.title ? `, ${data.title}` : "";
  return `Week ${index + 1}, ${formatDate(range.start)} to ${formatDate(range.end)}${title}`;
}

function titleForWeek(index) {
  const range = dateRangeForWeek(index);
  const data = weeks[index] || {};
  const lines = [
    `Week ${index + 1}`,
    `${formatDate(range.start)} → ${formatDate(range.end)}`,
  ];
  if (data.title) lines.push(data.title);
  if (data.tags) lines.push(`# ${data.tags}`);
  return lines.join("\n");
}

function parseLocalDate(value) {
  const [year, month, day] = (value || defaults.birthDate).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatDate(date) {
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function jumpToNow() {
  const nowCell = el.lifeGrid.querySelector(".life-cell.now") || el.lifeGrid.querySelector(".life-cell.past:last-of-type");
  if (!nowCell) return;
  nowCell.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  nowCell.focus({ preventScroll: true });
}

function exportData() {
  const payload = {
    app: "sam256-life-in-weeks",
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    weeks,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `life-in-weeks-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast("Exported JSON backup.");
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(String(reader.result || "{}"));
      if (!payload.weeks || typeof payload.weeks !== "object") throw new Error("Missing weeks object");
      settings = { ...defaults, ...(payload.settings || {}) };
      weeks = payload.weeks;
      saveJSON(SETTINGS_KEY, settings);
      saveJSON(STORAGE_KEY, weeks);
      hydrateControls();
      applySettings();
      renderAll();
      toast("Imported life map.");
    } catch (error) {
      toast("Import failed. Invalid JSON file.");
      console.error(error);
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function resetData() {
  const ok = confirm("Delete all local notes and reset settings on this device?");
  if (!ok) return;
  settings = { ...defaults };
  weeks = {};
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SETTINGS_KEY);
  hydrateControls();
  applySettings();
  renderAll();
  toast("Local life map reset.");
}

function toast(message) {
  const node = el.toastTemplate.content.firstElementChild.cloneNode(true);
  node.textContent = message;
  el.toastHost.appendChild(node);
  setTimeout(() => node.remove(), 2800);
}
