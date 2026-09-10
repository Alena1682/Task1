(function () {
  "use strict";

  const STORAGE_KEY = "personal-todo-workspace-v2";
  let today = toDateInputValue(new Date());
  const views = {
    inbox: {
      kicker: "ALL TASKS",
      title: "任务清单",
      subtitle: "把要做的事先记下来，再慢慢完成。",
      section: "全部任务",
      hint: "新添加的任务会显示在这里。"
    },
    today: {
      kicker: "TODAY",
      title: "我的一天",
      subtitle: "今天要完成的事，值得被认真对待。",
      section: "今日任务",
      hint: "日期设为今天的任务会出现在这里。"
    },
    important: {
      kicker: "IMPORTANT",
      title: "重要任务",
      subtitle: "把最值得优先完成的事放在眼前。",
      section: "重要任务",
      hint: "编辑任务，点击星标即可标记为重要。"
    },
    planned: {
      kicker: "PLANNED",
      title: "计划内",
      subtitle: "为未来留出空间，按计划稳步推进。",
      section: "计划内任务",
      hint: "安排了其他日期的任务会显示在这里。"
    }
  };

  const el = {
    navItems: Array.from(document.querySelectorAll(".nav-item")),
    inboxCount: document.getElementById("inboxCount"),
    todayCount: document.getElementById("todayCount"),
    importantCount: document.getElementById("importantCount"),
    plannedCount: document.getElementById("plannedCount"),
    todayLabel: document.getElementById("todayLabel"),
    viewKicker: document.getElementById("viewKicker"),
    viewTitle: document.getElementById("viewTitle"),
    viewSubtitle: document.getElementById("viewSubtitle"),
    listSectionTitle: document.getElementById("listSectionTitle"),
    listSectionHint: document.getElementById("listSectionHint"),
    taskForm: document.getElementById("taskForm"),
    taskInput: document.getElementById("taskInput"),
    focusTaskInputButton: document.getElementById("focusTaskInputButton"),
    selectAllTasks: document.getElementById("selectAllTasks"),
    bulkToolbar: document.getElementById("bulkToolbar"),
    selectedCount: document.getElementById("selectedCount"),
    clearSelectionButton: document.getElementById("clearSelectionButton"),
    deleteSelectedButton: document.getElementById("deleteSelectedButton"),
    taskList: document.getElementById("taskList"),
    emptyState: document.getElementById("emptyState"),
    emptyStateTitle: document.getElementById("emptyStateTitle"),
    emptyStateText: document.getElementById("emptyStateText"),
    taskModal: document.getElementById("taskModal"),
    closeModalButton: document.getElementById("closeModalButton"),
    cancelModalButton: document.getElementById("cancelModalButton"),
    taskEditForm: document.getElementById("taskEditForm"),
    editTaskText: document.getElementById("editTaskText"),
    editTaskDateDisplay: document.getElementById("editTaskDateDisplay"),
    editTaskDateButton: document.getElementById("editTaskDateButton"),
    editTaskDateClearButton: document.getElementById("editTaskDateClearButton"),
    editTaskDate: document.getElementById("editTaskDate"),
    editTaskHour: document.getElementById("editTaskHour"),
    editTaskMinute: document.getElementById("editTaskMinute"),
    editTaskImportant: document.getElementById("editTaskImportant"),
    toast: document.getElementById("toast")
  };

  let state = loadState();
  let editingTaskId = null;
  let toastTimer = null;

  function populateTimeOptions() {
    for (let hour = 0; hour < 24; hour += 1) {
      const option = document.createElement("option");
      option.value = String(hour).padStart(2, "0");
      option.textContent = String(hour);
      el.editTaskHour.appendChild(option);
    }
    for (let minute = 0; minute < 60; minute += 1) {
      const option = document.createElement("option");
      option.value = String(minute).padStart(2, "0");
      option.textContent = String(minute).padStart(2, "0");
      el.editTaskMinute.appendChild(option);
    }
  }

  function createId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function toDateInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatDate(value, options) {
    if (!value) return "未安排日期";
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "未安排日期";
    return new Intl.DateTimeFormat("zh-CN", options || { year: "numeric", month: "numeric", day: "numeric" }).format(date);
  }

  function formatEditDate(value) {
    if (!value) return "";
    const parts = value.split("-");
    if (parts.length !== 3) return "";
    return `${parts[0]} / ${parts[1]} / ${parts[2]}`;
  }

  function syncEditDateDisplay() {
    el.editTaskDateDisplay.value = formatEditDate(el.editTaskDate.value);
    el.editTaskDateClearButton.hidden = !el.editTaskDate.value;
  }

  function openNativeDatePicker() {
    if (typeof el.editTaskDate.showPicker === "function") {
      try {
        el.editTaskDate.showPicker();
        return;
      } catch (error) {
        // Fall back to the native click behavior in browsers that do not allow showPicker().
      }
    }
    el.editTaskDate.click();
  }

  function displayDate(value) {
    if (!value) return "未安排日期";
    if (value === today) return "今天";
    return formatDate(value);
  }

  function getTomorrowDate() {
    const date = new Date(`${today}T00:00:00`);
    date.setDate(date.getDate() + 1);
    return toDateInputValue(date);
  }

  function defaultState() {
    return {
      view: "inbox",
      tasks: [],
      selectedTaskIds: []
    };
  }

  function normalizeState(raw) {
    if (!raw || !Array.isArray(raw.tasks)) return defaultState();
    const tasks = raw.tasks.map((task) => ({
      id: String(task.id || createId("task")),
      text: String(task.text || "").trim(),
      completed: Boolean(task.completed),
      important: Boolean(task.important),
      date: typeof task.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(task.date) ? task.date : null,
      time: typeof task.time === "string" && /^\d{2}:\d{2}$/.test(task.time) ? task.time : null,
      createdAt: Number(task.createdAt) || Date.now(),
      updatedAt: Number(task.updatedAt) || Date.now()
    })).filter((task) => task.text);
    return {
      view: views[raw.view] ? raw.view : "inbox",
      tasks,
      selectedTaskIds: Array.isArray(raw.selectedTaskIds) ? raw.selectedTaskIds.map(String).filter((id) => tasks.some((task) => task.id === id)) : []
    };
  }

  function loadState() {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return saved ? normalizeState(JSON.parse(saved)) : defaultState();
    } catch (error) {
      return defaultState();
    }
  }

  function persist() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function refreshToday() {
    const currentDate = toDateInputValue(new Date());
    if (currentDate === today) return;
    today = currentDate;
    render();
  }

  function getVisibleTasks() {
    if (state.view === "today") return state.tasks.filter((task) => task.date === today);
    if (state.view === "important") return state.tasks.filter((task) => task.important);
    if (state.view === "planned") return state.tasks.filter((task) => task.date && task.date !== today);
    return state.tasks;
  }

  function sortTasks(tasks) {
    return tasks.slice().sort((a, b) => Number(a.completed) - Number(b.completed) || Number(b.important) - Number(a.important) || a.createdAt - b.createdAt);
  }

  function render() {
    state.selectedTaskIds = state.selectedTaskIds.filter((id) => state.tasks.some((task) => task.id === id));
    renderHeader();
    renderNavigation();
    renderTaskList();
    persist();
  }

  function renderHeader() {
    const view = views[state.view];
    el.viewKicker.textContent = view.kicker;
    el.viewTitle.textContent = view.title;
    el.viewSubtitle.textContent = view.subtitle;
    el.listSectionTitle.textContent = view.section;
    el.listSectionHint.textContent = view.hint;
    el.todayLabel.textContent = formatDate(today, { month: "long", day: "numeric", weekday: "long" });
  }

  function renderNavigation() {
    const counts = {
      inbox: state.tasks.filter((task) => !task.completed).length,
      today: state.tasks.filter((task) => task.date === today && !task.completed).length,
      important: state.tasks.filter((task) => task.important && !task.completed).length,
      planned: state.tasks.filter((task) => task.date && task.date !== today && !task.completed).length
    };
    el.inboxCount.textContent = counts.inbox;
    el.todayCount.textContent = counts.today;
    el.importantCount.textContent = counts.important;
    el.plannedCount.textContent = counts.planned;
    el.navItems.forEach((item) => item.classList.toggle("is-active", item.dataset.view === state.view));
  }

  function renderTaskList() {
    const tasks = sortTasks(getVisibleTasks());
    const selected = new Set(state.selectedTaskIds);
    el.taskList.innerHTML = "";
    el.selectAllTasks.checked = tasks.length > 0 && tasks.every((task) => selected.has(task.id));
    el.selectAllTasks.indeterminate = tasks.some((task) => selected.has(task.id)) && !el.selectAllTasks.checked;
    el.selectedCount.textContent = state.selectedTaskIds.length;
    el.bulkToolbar.hidden = state.selectedTaskIds.length === 0;

    if (!tasks.length) {
      el.emptyState.hidden = false;
      if (state.view === "today") {
        el.emptyStateTitle.textContent = "今天还没有任务";
        el.emptyStateText.textContent = "给任务安排今天的日期，它就会出现在这里。";
      } else if (state.view === "important") {
        el.emptyStateTitle.textContent = "还没有重要任务";
        el.emptyStateText.textContent = "编辑一项任务，点亮星标即可。";
      } else if (state.view === "planned") {
        el.emptyStateTitle.textContent = "计划内还是空的";
        el.emptyStateText.textContent = "给任务安排未来日期，开始你的计划。";
      } else {
        el.emptyStateTitle.textContent = "还没有任务";
        el.emptyStateText.textContent = "在上方输入一件要做的事，开始你的清单。";
      }
      return;
    }

    el.emptyState.hidden = true;
    tasks.forEach((task) => {
      const row = document.createElement("article");
      row.className = `task-row${task.completed ? " is-complete" : ""}${selected.has(task.id) ? " is-selected" : ""}`;
      row.dataset.taskId = task.id;
      row.innerHTML = `
        <label class="complete-control" title="标记任务完成">
          <input class="task-check task-complete" type="checkbox" aria-label="标记任务完成" ${task.completed ? "checked" : ""} />
          <span class="complete-box" aria-hidden="true"><span>✓</span></span>
          <span class="control-caption">完成</span>
        </label>
        <div class="task-body">
          <span class="task-text"></span>
          <span class="task-meta"></span>
        </div>
        <div class="task-actions">
          <label class="task-select-wrap" title="选择任务进行批量操作">
            <input class="task-select" type="checkbox" aria-label="选择任务进行批量操作" ${selected.has(task.id) ? "checked" : ""} />
            <span class="select-box" aria-hidden="true"></span>
            <span class="control-caption">选择</span>
          </label>
          <button class="task-action-button edit" type="button" aria-label="编辑任务" title="编辑任务">✎</button>
          <button class="task-action-button delete" type="button" aria-label="删除任务" title="删除任务">
            <svg class="trash-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M9 4.5h6l.8 1.5H19v1.5H5V6h3.2L9 4.5Zm-2 5h10l-.65 9.1a1.5 1.5 0 0 1-1.5 1.4H9.15a1.5 1.5 0 0 1-1.5-1.4L7 9.5Zm3 2v6h1.5v-6H10Zm3.5 0v6H15v-6h-1.5Z" />
            </svg>
          </button>
          <button class="task-action-button important-action${task.important ? " is-important" : ""}" type="button" aria-label="${task.important ? "取消重要任务标记" : "加入重要任务"}" title="${task.important ? "取消重要任务标记" : "加入重要任务"}">★</button>
        </div>`;
      row.querySelector(".task-text").textContent = task.text;
      row.querySelector(".task-meta").innerHTML = task.date ? `<span class="task-date${task.date === today ? " is-today" : ""}"><span aria-hidden="true">◷</span> ${displayDate(task.date)}${task.time ? `<span class="task-time">${task.time}</span>` : ""}</span>` : `<span class="task-date">未安排日期</span>`;
      el.taskList.appendChild(row);
    });
  }

  function showToast(message) {
    el.toast.textContent = message;
    el.toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { el.toast.hidden = true; }, 2200);
  }

  function addTask(event) {
    event.preventDefault();
    const text = el.taskInput.value.trim();
    if (!text) {
      el.taskInput.focus();
      return;
    }
    const taskDefaults = {
      date: state.view === "today" ? today : state.view === "planned" ? getTomorrowDate() : null,
      important: state.view === "important"
    };
    state.tasks.push({ id: createId("task"), text, completed: false, important: taskDefaults.important, date: taskDefaults.date, time: null, createdAt: Date.now(), updatedAt: Date.now() });
    el.taskForm.reset();
    render();
    el.taskInput.focus();
  }

  function focusTaskInput() {
    el.taskInput.focus();
  }

  function updateTask(taskId, updates) {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return;
    Object.assign(task, updates, { updatedAt: Date.now() });
    render();
  }

  function toggleComplete(taskId, completed) {
    updateTask(taskId, { completed });
  }

  function toggleSelected(taskId, checked) {
    const set = new Set(state.selectedTaskIds);
    if (checked) set.add(taskId); else set.delete(taskId);
    state.selectedTaskIds = Array.from(set);
    render();
  }

  function deleteTasks(taskIds) {
    const ids = new Set(taskIds);
    state.tasks = state.tasks.filter((task) => !ids.has(task.id));
    state.selectedTaskIds = state.selectedTaskIds.filter((id) => !ids.has(id));
    render();
  }

  function openEditModal(taskId) {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return;
    editingTaskId = taskId;
    el.editTaskText.value = task.text;
    el.editTaskDate.value = task.date || "";
    syncEditDateDisplay();
    const [taskHour, taskMinute] = task.time ? task.time.split(":") : ["", ""];
    el.editTaskHour.value = taskHour || "";
    el.editTaskMinute.value = taskMinute || "";
    el.editTaskImportant.checked = task.important;
    el.taskModal.hidden = false;
    window.requestAnimationFrame(() => el.editTaskText.focus());
  }

  function closeEditModal() {
    editingTaskId = null;
    el.taskModal.hidden = true;
  }

  function saveEdit(event) {
    event.preventDefault();
    const task = state.tasks.find((item) => item.id === editingTaskId);
    const text = el.editTaskText.value.trim();
    if (!task || !text) return;
    const nextDate = el.editTaskDate.value || null;
    const nextTime = el.editTaskHour.value && el.editTaskMinute.value ? `${el.editTaskHour.value}:${el.editTaskMinute.value}` : null;
    Object.assign(task, { text, date: nextDate, time: nextTime, important: el.editTaskImportant.checked, updatedAt: Date.now() });
    closeEditModal();
    render();
    showToast(nextDate === today ? "已加入我的一天" : nextDate ? "已加入计划内" : "任务已保存");
  }

  el.navItems.forEach((item) => item.addEventListener("click", () => {
    state.view = item.dataset.view;
    state.selectedTaskIds = [];
    render();
  }));
  el.taskForm.addEventListener("submit", addTask);
  if (el.focusTaskInputButton) el.focusTaskInputButton.addEventListener("click", focusTaskInput);
  el.taskList.addEventListener("change", (event) => {
    const row = event.target.closest("[data-task-id]");
    if (!row) return;
    const task = state.tasks.find((item) => item.id === row.dataset.taskId);
    if (!task) return;
    if (event.target.classList.contains("task-complete")) {
      toggleComplete(task.id, event.target.checked);
    } else if (event.target.classList.contains("task-select")) {
      toggleSelected(task.id, event.target.checked);
    }
  });
  el.taskList.addEventListener("click", (event) => {
    const row = event.target.closest("[data-task-id]");
    if (!row) return;
    const task = state.tasks.find((item) => item.id === row.dataset.taskId);
    if (!task) return;
    if (event.target.closest(".edit")) openEditModal(task.id);
    if (event.target.closest(".delete")) deleteTasks([task.id]);
    if (event.target.closest(".important-action")) {
      const willBeImportant = !task.important;
      updateTask(task.id, { important: willBeImportant });
      showToast(willBeImportant ? "已加入重要任务" : "已取消重要任务标记");
    }
    if (event.target.closest(".task-text")) toggleComplete(task.id, !task.completed);
  });
  el.selectAllTasks.addEventListener("change", () => {
    const visibleIds = getVisibleTasks().map((task) => task.id);
    const set = new Set(state.selectedTaskIds);
    if (el.selectAllTasks.checked) visibleIds.forEach((id) => set.add(id)); else visibleIds.forEach((id) => set.delete(id));
    state.selectedTaskIds = Array.from(set);
    render();
  });
  el.clearSelectionButton.addEventListener("click", () => { state.selectedTaskIds = []; render(); });
  el.deleteSelectedButton.addEventListener("click", () => {
    if (!state.selectedTaskIds.length) return;
    deleteTasks(state.selectedTaskIds);
    showToast("已删除所选任务");
  });
  el.closeModalButton.addEventListener("click", closeEditModal);
  el.cancelModalButton.addEventListener("click", closeEditModal);
  el.taskEditForm.addEventListener("submit", saveEdit);
  el.editTaskDateButton.addEventListener("click", openNativeDatePicker);
  el.editTaskDateDisplay.addEventListener("click", openNativeDatePicker);
  el.editTaskDate.addEventListener("input", syncEditDateDisplay);
  el.editTaskDate.addEventListener("change", syncEditDateDisplay);
  el.editTaskDateClearButton.addEventListener("click", () => {
    el.editTaskDate.value = "";
    syncEditDateDisplay();
  });
  el.taskModal.addEventListener("click", (event) => { if (event.target === el.taskModal) closeEditModal(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !el.taskModal.hidden) closeEditModal(); });
  window.setInterval(refreshToday, 60 * 1000);
  document.addEventListener("visibilitychange", refreshToday);

  populateTimeOptions();
  render();
})();
