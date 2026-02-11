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

// ── Init ─────────────────────────────────────────────────────────
updateUI();
