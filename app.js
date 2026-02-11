const GOAL = 100;
const storageKey = "pushups-daily-v2";

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
const quickButtons = Array.from(document.querySelectorAll(".quick-add .quick"));

const ring = document.querySelector(".ring-progress");
const radius = ring.r.baseVal.value;
const circumference = 2 * Math.PI * radius;
ring.style.strokeDasharray = `${circumference} ${circumference}`;
const ringContainer = document.querySelector(".progress__ring");

let pendingCelebration = false;

const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const state = {
  logs: loadLogs(),
  selectedDate: getLocalDateString(),
  currentMonth: new Date(),
};

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

function loadLogs() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || {};
  } catch (error) {
    return {};
  }
}

function saveLogs() {
  localStorage.setItem(storageKey, JSON.stringify(state.logs));
}

function getCount(dateStr) {
  return state.logs[dateStr] || 0;
}

function setCount(dateStr, value) {
  const previousValue = getCount(dateStr);
  const safe = Math.max(0, Math.floor(value));
  if (safe === 0) {
    delete state.logs[dateStr];
  } else {
    state.logs[dateStr] = safe;
  }
  if (safe >= GOAL && previousValue < GOAL && dateStr === state.selectedDate) {
    pendingCelebration = true;
  }
  saveLogs();
  updateUI();
}

function addCount(amount) {
  const current = getCount(state.selectedDate);
  setCount(state.selectedDate, current + amount);
}

function calculateStreak() {
  let streak = 0;
  const today = new Date();
  const todayStr = getLocalDateString(today);
  const todayLog = state.logs[todayStr];
  if (todayLog >= GOAL) {
    streak += 1;
  }

  let checkDate = new Date(today);
  checkDate.setDate(checkDate.getDate() - 1);
  while (true) {
    const dateStr = getLocalDateString(checkDate);
    const count = state.logs[dateStr] || 0;
    if (count >= GOAL) {
      streak += 1;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

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

    const count = getCount(dayObj.dateStr);
    let statusClass = "";
    if (count >= GOAL) statusClass = "done";
    else if (count > 0) statusClass = "active";

    cell.className = `day ${statusClass}`.trim();
    if (dayObj.dateStr === state.selectedDate) cell.classList.add("selected");
    if (dayObj.dateStr === todayStr) cell.classList.add("today");

    cell.textContent = dayObj.day;
    cell.title = `${dayObj.dateStr} • ${count} reps`;

    cell.addEventListener("click", () => {
      state.selectedDate = dayObj.dateStr;
      updateUI();
    });

    calendarGrid.appendChild(cell);
  });
}

function updateUI() {
  const selectedCount = getCount(state.selectedDate);
  const todayStr = getLocalDateString();
  const isToday = state.selectedDate === todayStr;
  const isFuture = state.selectedDate > todayStr;

  dateLabel.textContent = isToday ? "Today's Progress" : formatDateReadable(state.selectedDate);
  selectedMeta.textContent = `Selected day: ${isToday ? "Today" : formatDateReadable(state.selectedDate)}`;

  const percentage = Math.min((selectedCount / GOAL) * 100, 100);
  const offset = circumference - (percentage / 100) * circumference;
  ring.style.strokeDashoffset = `${offset}`;
  progressCount.textContent = selectedCount;

  if (pendingCelebration) {
    pendingCelebration = false;
    setTimeout(celebrateRingClose, 620);
  }

  if (isFuture) {
    progressMessage.textContent = "Future date";
  } else if (selectedCount >= GOAL) {
    progressMessage.textContent = "Goal complete!";
  } else {
    progressMessage.textContent = `${GOAL - selectedCount} more to go`;
  }

  const streak = calculateStreak();
  streakValue.textContent = streak;

  const total = Object.values(state.logs).reduce((acc, val) => acc + val, 0);
  totalCount.textContent = total.toLocaleString();

  returnToday.classList.toggle("hidden", isToday);

  const disableControls = isFuture;
  quickButtons.forEach((btn) => {
    btn.disabled = disableControls;
  });
  customInput.disabled = disableControls;
  undoButton.disabled = disableControls || selectedCount === 0;

  renderCalendar();
}

quickButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const amount = Number(btn.dataset.add || 0);
    addCount(amount);
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

function celebrateRingClose() {
  ringContainer.classList.remove("celebrate");
  void ringContainer.offsetWidth;
  ringContainer.classList.add("celebrate");
  spawnParticles(16);
  ringContainer.addEventListener(
    "animationend",
    () => ringContainer.classList.remove("celebrate"),
    { once: true },
  );
}

function spawnParticles(count) {
  for (let i = 0; i < count; i++) {
    const particle = document.createElement("div");
    particle.className = "ring-particle";
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

// ── Fasting Feature ──────────────────────────────────────────────
const fastStorageKey = "fasting-v1";

const fastingStatus = document.getElementById("fastingStatus");
const fastingIdle = document.getElementById("fastingIdle");
const fastingActive = document.getElementById("fastingActive");
const startFastNow = document.getElementById("startFastNow");
const startFastRetro = document.getElementById("startFastRetro");
const retroPicker = document.getElementById("retroPicker");
const retroDateTime = document.getElementById("retroDateTime");
const retroConfirm = document.getElementById("retroConfirm");
const retroCancel = document.getElementById("retroCancel");
const fastElapsed = document.getElementById("fastElapsed");
const fastGoalLabel = document.getElementById("fastGoalLabel");
const fastStartLabel = document.getElementById("fastStartLabel");
const endFastBtn = document.getElementById("endFast");
const fastHistoryEl = document.getElementById("fastHistory");

const fastRing = document.querySelector(".fast-ring-progress");
const fastRadius = fastRing.r.baseVal.value;
const fastCircumference = 2 * Math.PI * fastRadius;
fastRing.style.strokeDasharray = `${fastCircumference} ${fastCircumference}`;
fastRing.style.strokeDashoffset = `${fastCircumference}`;

const FAST_GOAL_HOURS = 16;

let fastTimerInterval = null;

function loadFastData() {
  try {
    return JSON.parse(localStorage.getItem(fastStorageKey)) || { activeFast: null, history: [] };
  } catch {
    return { activeFast: null, history: [] };
  }
}

function saveFastData(data) {
  localStorage.setItem(fastStorageKey, JSON.stringify(data));
}

function formatElapsed(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDurationShort(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function formatFastDate(isoStr) {
  const date = new Date(isoStr);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function setRetroDateTimeMax() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  retroDateTime.max = local.toISOString().slice(0, 16);
  retroDateTime.value = local.toISOString().slice(0, 16);
}

function startFast(startTime) {
  const data = loadFastData();
  data.activeFast = { startTime: startTime.toISOString() };
  saveFastData(data);
  updateFastingUI();
}

function endCurrentFast() {
  const data = loadFastData();
  if (!data.activeFast) return;

  const start = new Date(data.activeFast.startTime);
  const end = new Date();
  const duration = end.getTime() - start.getTime();

  data.history.unshift({
    startTime: data.activeFast.startTime,
    endTime: end.toISOString(),
    duration,
  });

  if (data.history.length > 20) data.history = data.history.slice(0, 20);

  data.activeFast = null;
  saveFastData(data);
  updateFastingUI();
}

function tickFastTimer() {
  const data = loadFastData();
  if (!data.activeFast) return;

  const start = new Date(data.activeFast.startTime);
  const now = new Date();
  const elapsed = now.getTime() - start.getTime();

  fastElapsed.textContent = formatElapsed(elapsed);

  const goalMs = FAST_GOAL_HOURS * 3600 * 1000;
  const pct = Math.min((elapsed / goalMs) * 100, 100);
  const offset = fastCircumference - (pct / 100) * fastCircumference;
  fastRing.style.strokeDashoffset = `${offset}`;

  if (pct >= 100) {
    fastRing.style.stroke = "#22c55e";
  } else {
    fastRing.style.stroke = "#a78bfa";
  }
}

function renderFastHistory() {
  const data = loadFastData();
  fastHistoryEl.innerHTML = "";

  if (data.history.length === 0) return;

  const title = document.createElement("p");
  title.className = "fasting__history-title";
  title.textContent = "Recent fasts";
  fastHistoryEl.appendChild(title);

  data.history.slice(0, 5).forEach((entry) => {
    const item = document.createElement("div");
    item.className = "fasting__history-item";

    const dateSpan = document.createElement("span");
    dateSpan.className = "fasting__history-date";
    dateSpan.textContent = formatFastDate(entry.startTime);

    const durSpan = document.createElement("span");
    durSpan.className = "fasting__history-duration";
    durSpan.textContent = formatDurationShort(entry.duration);

    item.appendChild(dateSpan);
    item.appendChild(durSpan);
    fastHistoryEl.appendChild(item);
  });
}

function updateFastingUI() {
  const data = loadFastData();

  if (data.activeFast) {
    fastingIdle.classList.add("hidden");
    fastingActive.classList.remove("hidden");
    retroPicker.classList.add("hidden");

    fastStartLabel.textContent = `Started: ${formatFastDate(data.activeFast.startTime)}`;
    fastingStatus.textContent = "Fasting";

    if (fastTimerInterval) clearInterval(fastTimerInterval);
    tickFastTimer();
    fastTimerInterval = setInterval(tickFastTimer, 1000);
  } else {
    fastingIdle.classList.remove("hidden");
    fastingActive.classList.add("hidden");
    retroPicker.classList.add("hidden");
    fastingStatus.textContent = "No active fast";

    if (fastTimerInterval) {
      clearInterval(fastTimerInterval);
      fastTimerInterval = null;
    }
  }

  renderFastHistory();
}

startFastNow.addEventListener("click", () => {
  startFast(new Date());
});

startFastRetro.addEventListener("click", () => {
  setRetroDateTimeMax();
  retroPicker.classList.remove("hidden");
});

retroCancel.addEventListener("click", () => {
  retroPicker.classList.add("hidden");
});

retroConfirm.addEventListener("click", () => {
  const val = retroDateTime.value;
  if (!val) return;

  const chosen = new Date(val);
  const now = new Date();

  if (chosen > now) {
    retroDateTime.setCustomValidity("Start time cannot be in the future");
    retroDateTime.reportValidity();
    return;
  }

  retroDateTime.setCustomValidity("");
  startFast(chosen);
});

endFastBtn.addEventListener("click", () => {
  endCurrentFast();
});

updateFastingUI();

// ── Init ─────────────────────────────────────────────────────────
updateUI();
