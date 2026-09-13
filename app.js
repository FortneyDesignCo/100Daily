const DEFAULT_GOAL = 100;

// Legacy (single ring) keys — read once for migration, never written again.
const legacyLogsKey = "pushups-daily-v2";
const legacyGoalKey = "pushups-goal";
const legacyDayGoalsKey = "pushups-day-goals";

// Multi-ring keys
const logsKey = "pushups-daily-v3";
const ringsKey = "pushups-rings";
const dayRingsKey = "pushups-day-rings";

const RING_DEFS = [
  { id: "r1", name: "Pushups", color: "#22c55e" },
  { id: "r2", name: "Squats", color: "#38bdf8" },
  { id: "r3", name: "Core", color: "#f472b6" },
];

const RING_GEOMETRY = [80, 62, 44];
const STROKE_WIDTH = 12;

// ── Storage ──────────────────────────────────────────────────────
function parseStored(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch (error) {
    return null;
  }
}

function loadRings() {
  const saved = parseStored(ringsKey);
  const legacyGoal = Number(localStorage.getItem(legacyGoalKey));
  return RING_DEFS.map((def, index) => {
    const stored = Array.isArray(saved) ? saved.find((r) => r && r.id === def.id) : null;
    let goal = DEFAULT_GOAL;
    if (stored && Number(stored.goal) >= 1) goal = Math.floor(Number(stored.goal));
    else if (index === 0 && legacyGoal >= 1) goal = Math.floor(legacyGoal);

    return {
      id: def.id,
      color: def.color,
      name: stored && stored.name ? String(stored.name).slice(0, 20) : def.name,
      goal,
      enabled: stored ? Boolean(stored.enabled) : index === 0,
    };
  });
}

function saveRings() {
  localStorage.setItem(ringsKey, JSON.stringify(state.rings));
}

function loadLogs() {
  const saved = parseStored(logsKey);
  if (saved && typeof saved === "object") return normalizeLogs(saved);

  const legacy = parseStored(legacyLogsKey);
  if (legacy && typeof legacy === "object") return normalizeLogs(legacy);
  return {};
}

// Accepts both the legacy `{ date: number }` shape and `{ date: { ringId: number } }`.
function normalizeLogs(raw) {
  const logs = {};
  Object.entries(raw).forEach(([dateStr, value]) => {
    if (typeof value === "number") {
      if (value > 0) logs[dateStr] = { r1: value };
      return;
    }
    if (value && typeof value === "object") {
      const entry = {};
      RING_DEFS.forEach(({ id }) => {
        const count = Math.max(0, Math.floor(Number(value[id]) || 0));
        if (count > 0) entry[id] = count;
      });
      if (Object.keys(entry).length) logs[dateStr] = entry;
    }
  });
  return logs;
}

function saveLogs() {
  localStorage.setItem(logsKey, JSON.stringify(state.logs));
}

// Per-day snapshot: which rings were on that day and what their goals were.
function loadDayRings() {
  const saved = parseStored(dayRingsKey);
  if (saved && typeof saved === "object") return normalizeDayRings(saved);

  const legacy = parseStored(legacyDayGoalsKey);
  if (legacy && typeof legacy === "object") {
    const migrated = {};
    Object.entries(legacy).forEach(([dateStr, goal]) => {
      const safe = Math.max(1, Math.floor(Number(goal) || DEFAULT_GOAL));
      migrated[dateStr] = { goals: { r1: safe }, enabled: ["r1"] };
    });
    return migrated;
  }
  return {};
}

function normalizeDayRings(raw) {
  const snapshots = {};
  Object.entries(raw).forEach(([dateStr, value]) => {
    if (!value || typeof value !== "object") return;
    const goals = {};
    RING_DEFS.forEach(({ id }) => {
      const goal = Number(value.goals && value.goals[id]);
      if (goal >= 1) goals[id] = Math.floor(goal);
    });
    const enabled = Array.isArray(value.enabled)
      ? value.enabled.filter((id) => RING_DEFS.some((def) => def.id === id))
      : [];
    if (enabled.length) snapshots[dateStr] = { goals, enabled };
  });
  return snapshots;
}

function saveDayRings() {
  localStorage.setItem(dayRingsKey, JSON.stringify(state.dayRings));
}

// ── State ────────────────────────────────────────────────────────
const state = {
  rings: loadRings(),
  logs: loadLogs(),
  dayRings: loadDayRings(),
  selectedDate: getLocalDateString(),
  currentMonth: new Date(),
  activeRingId: "r1",
};

function ringById(id) {
  return state.rings.find((ring) => ring.id === id);
}

function enabledRingIds() {
  const ids = state.rings.filter((ring) => ring.enabled).map((ring) => ring.id);
  return ids.length ? ids : [state.rings[0].id];
}

function currentSnapshot() {
  return {
    goals: state.rings.reduce((acc, ring) => {
      acc[ring.id] = ring.goal;
      return acc;
    }, {}),
    enabled: enabledRingIds(),
  };
}

// Rings stay as they are day to day; a logged day keeps the setup it was logged with.
function getRingIdsForDate(dateStr) {
  const snapshot = state.dayRings[dateStr];
  if (snapshot && snapshot.enabled.length) return snapshot.enabled;
  return enabledRingIds();
}

function getRingsForDate(dateStr) {
  return getRingIdsForDate(dateStr)
    .map((id) => ringById(id))
    .filter(Boolean);
}

function getGoalForDate(dateStr, ringId) {
  const snapshot = state.dayRings[dateStr];
  if (snapshot && snapshot.goals[ringId]) return snapshot.goals[ringId];
  const ring = ringById(ringId);
  return ring ? ring.goal : DEFAULT_GOAL;
}

function getCount(dateStr, ringId) {
  const entry = state.logs[dateStr];
  return (entry && entry[ringId]) || 0;
}

function getDayTotal(dateStr) {
  const entry = state.logs[dateStr];
  if (!entry) return 0;
  return Object.values(entry).reduce((acc, val) => acc + val, 0);
}

function isRingComplete(dateStr, ringId) {
  return getCount(dateStr, ringId) >= getGoalForDate(dateStr, ringId);
}

// A day is done once every ring that was toggled on for that day hits its goal.
function isDayComplete(dateStr) {
  const ids = getRingIdsForDate(dateStr);
  if (!ids.length) return false;
  return ids.every((id) => isRingComplete(dateStr, id));
}

function setCount(dateStr, ringId, value) {
  const previous = getCount(dateStr, ringId);
  const safe = Math.max(0, Math.floor(value));
  if (safe === previous) return;

  const entry = state.logs[dateStr] ? { ...state.logs[dateStr] } : {};
  if (safe === 0) delete entry[ringId];
  else entry[ringId] = safe;

  if (Object.keys(entry).length) {
    state.logs[dateStr] = entry;
    if (!state.dayRings[dateStr]) state.dayRings[dateStr] = currentSnapshot();
  } else {
    delete state.logs[dateStr];
    delete state.dayRings[dateStr];
  }

  const goal = getGoalForDate(dateStr, ringId);
  if (safe >= goal && previous < goal && dateStr === state.selectedDate) {
    pendingCelebration = ringId;
  }

  saveLogs();
  saveDayRings();
  updateUI();
}

function addCount(amount) {
  setCount(state.selectedDate, state.activeRingId, getCount(state.selectedDate, state.activeRingId) + amount);
}

// Lock past days into the setup they were logged with, then apply the change going forward.
function commitRingChange(applyChange) {
  const todayStr = getLocalDateString();
  const previous = currentSnapshot();

  Object.keys(state.logs).forEach((dateStr) => {
    if (dateStr < todayStr && !state.dayRings[dateStr]) {
      state.dayRings[dateStr] = { goals: { ...previous.goals }, enabled: [...previous.enabled] };
    }
  });

  applyChange();

  const next = currentSnapshot();
  Object.keys(state.dayRings).forEach((dateStr) => {
    if (dateStr >= todayStr) {
      state.dayRings[dateStr] = { goals: { ...next.goals }, enabled: [...next.enabled] };
    }
  });

  saveRings();
  saveDayRings();
  updateUI();
}

function setRingGoal(ringId, value) {
  const safe = Math.max(1, Math.floor(Number(value)));
  if (!Number.isFinite(safe)) return updateUI();
  const ring = ringById(ringId);
  if (!ring || ring.goal === safe) return updateUI();
  commitRingChange(() => {
    ring.goal = safe;
  });
}

function setRingName(ringId, value) {
  const ring = ringById(ringId);
  const name = String(value || "").trim().slice(0, 20);
  if (!ring || !name || ring.name === name) return updateUI();
  ring.name = name;
  saveRings();
  updateUI();
}

function toggleRing(ringId, enabled) {
  const ring = ringById(ringId);
  if (!ring) return;
  if (!enabled && enabledRingIds().length <= 1) return updateUI();
  commitRingChange(() => {
    ring.enabled = enabled;
  });
}

// ── Elements ─────────────────────────────────────────────────────
const streakValue = document.getElementById("streakValue");
const dateLabel = document.getElementById("dateLabel");
const progressCount = document.getElementById("progressCount");
const progressMessage = document.getElementById("progressMessage");
const selectedMeta = document.getElementById("selectedMeta");
const returnToday = document.getElementById("returnToday");
const calendarGrid = document.getElementById("calendarGrid");
const monthLabel = document.getElementById("monthLabel");
const prevMonth = document.getElementById("prevMonth");
const nextMonth = document.getElementById("nextMonth");
const customForm = document.getElementById("customForm");
const customInput = document.getElementById("customInput");
const undoButton = document.getElementById("undoButton");
const totalCount = document.getElementById("totalCount");
const totalLabel = document.getElementById("totalLabel");
const ytdCount = document.getElementById("ytdCount");
const ytdLabel = document.getElementById("ytdLabel");
const goalLabel = document.getElementById("goalLabel");
const ringSvg = document.getElementById("ringSvg");
const ringTabs = document.getElementById("ringTabs");
const ringList = document.getElementById("ringList");
const ringContainer = document.querySelector(".progress__ring");
const quickButtons = Array.from(document.querySelectorAll(".quick-add .quick"));

let pendingCelebration = null;
let renderedRingSignature = "";
const ringArcs = new Map();

const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// ── Dates ────────────────────────────────────────────────────────
function getLocalDateString(date = new Date()) {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);
  return localDate.toISOString().split("T")[0];
}

function formatDateReadable(dateStr) {
  const date = new Date(`${dateStr}T12:00:00`);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// ── Streak ───────────────────────────────────────────────────────
function calculateStreak() {
  let streak = 0;
  const today = new Date();
  if (isDayComplete(getLocalDateString(today))) streak += 1;

  const checkDate = new Date(today);
  checkDate.setDate(checkDate.getDate() - 1);
  while (isDayComplete(getLocalDateString(checkDate))) {
    streak += 1;
    checkDate.setDate(checkDate.getDate() - 1);
  }
  return streak;
}

// ── Rings ────────────────────────────────────────────────────────
function renderRingSvg(rings) {
  const signature = rings.map((ring) => `${ring.id}:${ring.color}`).join("|");
  if (signature === renderedRingSignature) return;
  renderedRingSignature = signature;
  ringSvg.innerHTML = "";
  ringArcs.clear();

  rings.forEach((ring, index) => {
    const radius = RING_GEOMETRY[index];
    const circumference = 2 * Math.PI * radius;

    const background = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    background.setAttribute("class", "ring-bg");
    background.setAttribute("cx", "100");
    background.setAttribute("cy", "100");
    background.setAttribute("r", radius);
    background.setAttribute("stroke-width", STROKE_WIDTH);

    const arc = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    arc.setAttribute("class", "ring-progress");
    arc.setAttribute("cx", "100");
    arc.setAttribute("cy", "100");
    arc.setAttribute("r", radius);
    arc.setAttribute("stroke-width", STROKE_WIDTH);
    arc.style.stroke = ring.color;
    arc.style.strokeDasharray = `${circumference} ${circumference}`;
    arc.style.strokeDashoffset = `${circumference}`;
    arc.dataset.ring = ring.id;

    ringSvg.appendChild(background);
    ringSvg.appendChild(arc);
    ringArcs.set(ring.id, { arc, circumference });
  });
}

function updateRingArcs(rings) {
  rings.forEach((ring) => {
    const entry = ringArcs.get(ring.id);
    if (!entry) return;
    const count = getCount(state.selectedDate, ring.id);
    const goal = getGoalForDate(state.selectedDate, ring.id);
    const percentage = Math.min((count / goal) * 100, 100);
    entry.arc.style.strokeDashoffset = `${entry.circumference - (percentage / 100) * entry.circumference}`;
  });
}

function renderRingTabs(rings) {
  ringTabs.innerHTML = "";
  ringTabs.classList.toggle("hidden", rings.length < 2);
  if (rings.length < 2) return;

  rings.forEach((ring) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "ring-tab";
    if (ring.id === state.activeRingId) tab.classList.add("selected");
    if (isRingComplete(state.selectedDate, ring.id)) tab.classList.add("complete");
    tab.style.setProperty("--ring-color", ring.color);
    tab.innerHTML =
      `<span class="ring-tab__dot"></span>` +
      `<span class="ring-tab__name"></span>` +
      `<span class="ring-tab__count"></span>`;
    tab.querySelector(".ring-tab__name").textContent = ring.name;
    tab.querySelector(".ring-tab__count").textContent =
      `${getCount(state.selectedDate, ring.id)}/${getGoalForDate(state.selectedDate, ring.id)}`;
    tab.addEventListener("click", () => {
      state.activeRingId = ring.id;
      updateUI();
    });
    ringTabs.appendChild(tab);
  });
}

function renderRingSettings() {
  ringList.innerHTML = "";
  const onlyOneOn = enabledRingIds().length <= 1;

  state.rings.forEach((ring) => {
    const row = document.createElement("div");
    row.className = `ring-row${ring.enabled ? " is-on" : ""}`;
    row.style.setProperty("--ring-color", ring.color);

    const toggle = document.createElement("label");
    toggle.className = "ring-toggle";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = ring.enabled;
    checkbox.disabled = ring.enabled && onlyOneOn;
    checkbox.setAttribute("aria-label", `Toggle ${ring.name} ring`);
    checkbox.addEventListener("change", () => toggleRing(ring.id, checkbox.checked));
    const track = document.createElement("span");
    track.className = "ring-toggle__track";
    toggle.appendChild(checkbox);
    toggle.appendChild(track);

    const name = document.createElement("input");
    name.type = "text";
    name.className = "ring-name";
    name.value = ring.name;
    name.maxLength = 20;
    name.setAttribute("aria-label", "Ring name");
    name.addEventListener("change", () => setRingName(ring.id, name.value));
    name.addEventListener("keydown", (event) => {
      if (event.key === "Enter") name.blur();
    });

    const goal = document.createElement("input");
    goal.type = "number";
    goal.min = "1";
    goal.className = "ring-goal";
    goal.value = ring.goal;
    goal.setAttribute("aria-label", `${ring.name} goal`);
    goal.addEventListener("change", () => setRingGoal(ring.id, goal.value));
    goal.addEventListener("keydown", (event) => {
      if (event.key === "Enter") goal.blur();
    });

    row.appendChild(toggle);
    row.appendChild(name);
    row.appendChild(goal);
    ringList.appendChild(row);
  });
}

// ── Calendar ─────────────────────────────────────────────────────
function getCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayIndex = firstDay.getDay();

  const days = [];
  for (let i = 0; i < startingDayIndex; i += 1) {
    days.push({ day: null, id: `prev-${i}` });
  }
  for (let i = 1; i <= daysInMonth; i += 1) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
    days.push({ day: i, dateStr, id: dateStr });
  }
  return days;
}

function doneBackground(dateStr) {
  const colors = getRingsForDate(dateStr).map((ring) => ring.color);
  if (colors.length < 2) return colors[0] || "var(--accent)";
  const step = 100 / colors.length;
  const stops = colors.map((color, index) => `${color} ${index * step}% ${(index + 1) * step}%`);
  return `linear-gradient(135deg, ${stops.join(", ")})`;
}

function renderCalendar() {
  calendarGrid.innerHTML = "";
  const year = state.currentMonth.getFullYear();
  const month = state.currentMonth.getMonth();
  const days = getCalendarDays(year, month);
  const todayStr = getLocalDateString();

  monthLabel.textContent = state.currentMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  dayNames.forEach((day) => {
    const label = document.createElement("div");
    label.className = "day-name";
    label.textContent = day;
    calendarGrid.appendChild(label);
  });

  days.forEach((dayObj) => {
    const cell = document.createElement("button");
    cell.type = "button";

    if (!dayObj.day) {
      cell.className = "day empty";
      calendarGrid.appendChild(cell);
      return;
    }

    const complete = isDayComplete(dayObj.dateStr);
    let statusClass = "";
    if (complete) statusClass = "done";
    else if (getDayTotal(dayObj.dateStr) > 0) statusClass = "active";

    cell.className = `day ${statusClass}`.trim();
    if (complete) cell.style.background = doneBackground(dayObj.dateStr);
    if (dayObj.dateStr === state.selectedDate) cell.classList.add("selected");
    if (dayObj.dateStr === todayStr) cell.classList.add("today");

    cell.textContent = dayObj.day;
    const summary = getRingsForDate(dayObj.dateStr)
      .map((ring) => `${ring.name} ${getCount(dayObj.dateStr, ring.id)}/${getGoalForDate(dayObj.dateStr, ring.id)}`)
      .join(" • ");
    cell.title = `${dayObj.dateStr} • ${summary}`;

    cell.addEventListener("click", () => {
      state.selectedDate = dayObj.dateStr;
      updateUI();
    });

    calendarGrid.appendChild(cell);
  });
}

// ── Render ───────────────────────────────────────────────────────
function updateUI() {
  const todayStr = getLocalDateString();
  const isToday = state.selectedDate === todayStr;
  const isFuture = state.selectedDate > todayStr;

  const rings = getRingsForDate(state.selectedDate);
  if (!rings.some((ring) => ring.id === state.activeRingId)) {
    state.activeRingId = rings[0].id;
  }
  const active = ringById(state.activeRingId);

  dateLabel.textContent = isToday ? "Today's Progress" : formatDateReadable(state.selectedDate);
  selectedMeta.textContent = `Selected day: ${isToday ? "Today" : formatDateReadable(state.selectedDate)}`;

  renderRingSvg(rings);
  updateRingArcs(rings);
  renderRingTabs(rings);
  renderRingSettings();

  const activeCount = getCount(state.selectedDate, active.id);
  const activeGoal = getGoalForDate(state.selectedDate, active.id);
  progressCount.textContent = activeCount;
  goalLabel.textContent = `/ ${activeGoal} ${active.name}`;
  ringContainer.dataset.rings = rings.length;
  ringContainer.style.setProperty("--ring-color", active.color);

  if (pendingCelebration) {
    const ring = ringById(pendingCelebration);
    pendingCelebration = null;
    setTimeout(() => celebrateRingClose(ring), 620);
  }

  if (isFuture) {
    progressMessage.textContent = "Future date";
  } else if (isDayComplete(state.selectedDate)) {
    progressMessage.textContent = rings.length > 1 ? "All rings closed!" : "Goal complete!";
  } else if (activeCount >= activeGoal) {
    progressMessage.textContent = `${active.name} complete!`;
  } else {
    progressMessage.textContent = `${activeGoal - activeCount} more to go`;
  }

  streakValue.textContent = calculateStreak();

  const currentYear = new Date().getFullYear().toString();
  let ytd = 0;
  let total = 0;
  Object.entries(state.logs).forEach(([dateStr, entry]) => {
    const count = entry[active.id] || 0;
    total += count;
    if (dateStr.startsWith(currentYear)) ytd += count;
  });
  ytdCount.textContent = ytd.toLocaleString();
  totalCount.textContent = total.toLocaleString();
  ytdLabel.textContent = `Year to date · ${active.name}`;
  totalLabel.textContent = `Total all time · ${active.name}`;

  returnToday.classList.toggle("hidden", isToday);

  quickButtons.forEach((btn) => {
    btn.disabled = isFuture;
  });
  customInput.disabled = isFuture;
  undoButton.disabled = isFuture || activeCount === 0;

  renderCalendar();
}

// ── Events ───────────────────────────────────────────────────────
quickButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    addCount(Number(btn.dataset.add || 0));
  });
});

customForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = Number(customInput.value || 0);
  if (amount > 0) {
    addCount(amount);
    customInput.value = "";
  }
});

undoButton.addEventListener("click", () => addCount(-10));

returnToday.addEventListener("click", () => {
  state.selectedDate = getLocalDateString();
  const now = new Date();
  state.currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  updateUI();
});

prevMonth.addEventListener("click", () => {
  state.currentMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() - 1, 1);
  renderCalendar();
});

nextMonth.addEventListener("click", () => {
  state.currentMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() + 1, 1);
  renderCalendar();
});

// ── Celebration ──────────────────────────────────────────────────
function celebrateRingClose(ring) {
  if (ring) ringContainer.style.setProperty("--ring-color", ring.color);
  ringContainer.classList.remove("celebrate");
  void ringContainer.offsetWidth;
  ringContainer.classList.add("celebrate");
  spawnParticles(16, ring ? ring.color : "var(--accent)");
  ringContainer.addEventListener(
    "animationend",
    () => ringContainer.classList.remove("celebrate"),
    { once: true },
  );
}

function spawnParticles(count, color) {
  for (let i = 0; i < count; i++) {
    const particle = document.createElement("div");
    particle.className = "ring-particle";
    particle.style.background = color;
    const angle = (2 * Math.PI * i) / count + (Math.random() - 0.5) * 0.3;
    const distance = 60 + Math.random() * 50;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance;
    particle.style.setProperty("--tx", `${tx}px`);
    particle.style.setProperty("--ty", `${ty}px`);
    const size = 4 + Math.random() * 6;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.animationDelay = `${Math.random() * 0.15}s`;
    ringContainer.appendChild(particle);
    particle.addEventListener("animationend", () => particle.remove());
  }
}

// ── Goal editing from the ring center ────────────────────────────
goalLabel.addEventListener("click", () => {
  if (goalLabel.querySelector("input")) return;
  const ringId = state.activeRingId;
  const input = document.createElement("input");
  input.type = "number";
  input.min = "1";
  input.value = getGoalForDate(state.selectedDate, ringId);
  input.className = "goal-input";

  goalLabel.textContent = "";
  goalLabel.appendChild(input);
  input.focus();
  input.select();

  function commit() {
    const val = Number(input.value);
    if (val >= 1) setRingGoal(ringId, val);
    else updateUI();
  }

  input.addEventListener("blur", commit, { once: true });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") input.blur();
    if (e.key === "Escape") {
      input.removeEventListener("blur", commit);
      updateUI();
    }
  });
});

// ── Init ─────────────────────────────────────────────────────────
saveRings();
saveLogs();
saveDayRings();
updateUI();
