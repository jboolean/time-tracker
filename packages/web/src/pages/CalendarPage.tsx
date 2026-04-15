import { useState, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useTasks } from "../hooks/useTasks";
import { useCategories } from "../hooks/useCategories";
import { useProjects } from "../hooks/useProjects";
import TaskPopover from "../components/TaskPopover";
import type { Task } from "@time-tracker/shared";
import styles from "../styles/CalendarPage.module.css";

const HOUR_HEIGHT = 60;
const TIME_COL_WIDTH = 52;
const START_HOUR = 0;
const END_HOUR = 24;

type ViewMode = "week" | "month";

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function formatDayHeader(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function getMonthGrid(monthStart: Date): Date[][] {
  const gridStart = getWeekStart(new Date(monthStart));
  const weeks: Date[][] = [];
  let cursor = new Date(gridStart);
  while (weeks.length < 6) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cursor));
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
    if (!isSameMonth(week[6], monthStart) && weeks.length >= 4) break;
  }
  return weeks;
}

export default function CalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const initialView = (searchParams.get("view") as ViewMode | null) || "week";
  const initialDateStr = searchParams.get("date");
  const initialDate = initialDateStr ? new Date(initialDateStr + "T00:00:00") : new Date();

  const [view, setView] = useState<ViewMode>(initialView);
  const [weekStart, setWeekStart] = useState(() => getWeekStart(initialDate));
  const [monthStart, setMonthStart] = useState(() => getMonthStart(initialDate));
  const [popover, setPopover] = useState<{ task: Task; rect: DOMRect } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleClose = useCallback(() => {
    closeTimer.current = setTimeout(() => setPopover(null), 120);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const today = new Date();

  const rangeStart = view === "week" ? weekStart : monthStart;
  const rangeEnd =
    view === "week"
      ? addDays(weekStart, 7)
      : new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 7);

  const { data: tasks = [], isError: tasksError } = useTasks({
    startTime: rangeStart.toISOString(),
    endTime: rangeEnd.toISOString(),
  });
  const { data: categories = [] } = useCategories();
  const { data: projects = [] } = useProjects();

  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  function getCategoryColor(task: Task): string {
    const project = projectMap.get(task.projectId);
    if (!project) return "#ccc";
    const category = categoryMap.get(project.categoryId);
    if (!category) return "#ccc";
    return `hsl(${category.hue}, ${category.saturation}%, ${category.lightness}%)`;
  }

  function getProjectName(task: Task): string {
    return projectMap.get(task.projectId)?.name ?? "Unknown";
  }

  function getCategoryName(task: Task): string {
    const project = projectMap.get(task.projectId);
    if (!project) return "Unknown";
    return categoryMap.get(project.categoryId)?.name ?? "Unknown";
  }

  function getTaskLabel(task: Task): string {
    return task.title || task.rawInput || "";
  }

  function getTasksForDay(day: Date): Task[] {
    return tasks.filter((t) => isSameDay(new Date(t.startTime), day));
  }

  function getTaskBlock(task: Task): { top: number; height: number } {
    const start = new Date(task.startTime);
    const end = task.endTime ? new Date(task.endTime) : new Date();
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();
    const totalMinutes = (END_HOUR - START_HOUR) * 60;
    const top = ((startMinutes - START_HOUR * 60) / totalMinutes) * 100;
    const height = Math.max((endMinutes - startMinutes) / totalMinutes * 100, 0);
    return { top, height };
  }

  function handleTaskHover(task: Task, e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopover({ task, rect });
  }

  function handlePrev() {
    setPopover(null);
    if (view === "week") {
      const next = addDays(weekStart, -7);
      setWeekStart(next);
      setSearchParams({ view, date: next.toISOString().slice(0, 10) }, { replace: true });
    } else {
      const next = addMonths(monthStart, -1);
      setMonthStart(next);
      setSearchParams({ view, date: next.toISOString().slice(0, 10) }, { replace: true });
    }
  }

  function handleNext() {
    setPopover(null);
    if (view === "week") {
      const next = addDays(weekStart, 7);
      setWeekStart(next);
      setSearchParams({ view, date: next.toISOString().slice(0, 10) }, { replace: true });
    } else {
      const next = addMonths(monthStart, 1);
      setMonthStart(next);
      setSearchParams({ view, date: next.toISOString().slice(0, 10) }, { replace: true });
    }
  }

  function handleToday() {
    setPopover(null);
    setWeekStart(getWeekStart(new Date()));
    setMonthStart(getMonthStart(new Date()));
    setSearchParams({ view, date: new Date().toISOString().slice(0, 10) }, { replace: true });
  }

  function handleViewChange(v: ViewMode) {
    setView(v);
    setPopover(null);
    const date = v === "week" ? weekStart : monthStart;
    setSearchParams({ view: v, date: date.toISOString().slice(0, 10) }, { replace: true });
  }

  const rangeLabel =
    view === "week"
      ? `${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${addDays(weekStart, 6).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
      : monthStart.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const monthGrid = view === "month" ? getMonthGrid(monthStart) : [];
  const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div
      className={styles.page}
      ref={containerRef}
    >
      <div className={styles.toolbar}>
        <button onClick={handlePrev} className="btn btn-sm">← Prev</button>
        <button onClick={handleToday} className="btn btn-sm">Today</button>
        <button onClick={handleNext} className="btn btn-sm">Next →</button>
        <span className={styles.rangeLabel}>{rangeLabel}</span>
        <div className={styles.viewToggle}>
          <button
            onClick={() => handleViewChange("week")}
            className={`btn btn-sm${view === "week" ? " btn-active" : ""}`}
          >
            Week
          </button>
          <button
            onClick={() => handleViewChange("month")}
            className={`btn btn-sm${view === "month" ? " btn-active" : ""}`}
          >
            Month
          </button>
        </div>
        {tasksError && <span className={styles.toolbarError}>Failed to load tasks</span>}
      </div>

      {view === "week" && (
        <div className={styles.weekBody}>
          <div className={styles.weekScroll}>
            <div className={styles.weekGrid}>
              <div className={styles.dayHeaders}>
                <div className={styles.timeGutter} />
                {weekDays.map((day, i) => (
                  <div
                    key={i}
                    className={`${styles.dayHeader} ${isSameDay(day, today) ? styles.dayHeaderToday : ""}`}
                  >
                    {formatDayHeader(day)}
                  </div>
                ))}
              </div>

              <div className={styles.gridBody}>
                <div className={styles.hourGutter}>
                  {hours.map((h) => (
                    <div key={h} className={styles.hourCell}>
                      {h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`}
                    </div>
                  ))}
                </div>

                {weekDays.map((day, di) => (
                  <div key={di} className={styles.dayCol}>
                    {hours.map((h) => (
                      <div
                        key={h}
                        className={`${styles.hourRow} ${isSameDay(day, today) ? styles.hourRowToday : ""}`}
                      />
                    ))}
                    {getTasksForDay(day).map((task) => {
                      const { top, height } = getTaskBlock(task);
                      return (
                        <div
                          key={task.id}
                          className={styles.taskBlock}
                          onClick={(e) => handleTaskHover(task, e)}
                          onMouseEnter={(e) => { cancelClose(); handleTaskHover(task, e); }}
                          onMouseLeave={scheduleClose}
                          style={{
                            top: `${top}%`,
                            height: `${height}%`,
                            background: getCategoryColor(task),
                          }}
                        >
                          <span className={styles.taskLabel}>{getTaskLabel(task)}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {view === "month" && (
        <div className={styles.monthWrapper}>
          <div className={styles.dowHeader}>
            {DOW_LABELS.map((d) => (
              <div key={d} className={styles.dowCell}>{d}</div>
            ))}
          </div>
          <div
            className={styles.monthGrid}
            style={{ gridTemplateRows: `repeat(${monthGrid.length}, 1fr)` }}
          >
            {monthGrid.map((week, wi) => (
              <div key={wi} className={styles.monthWeek}>
                {week.map((day, di) => {
                  const isToday = isSameDay(day, today);
                  const inMonth = isSameMonth(day, monthStart);
                  const dayTasks = getTasksForDay(day);
                  return (
                    <div
                      key={di}
                      className={`${styles.monthDayCell} ${isToday ? styles.monthDayCellToday : ""}`}
                    >
                      <span
                        className={`${styles.monthDayNumber} ${isToday ? styles.monthDayNumberToday : ""} ${!inMonth ? styles.monthDayNumberDim : ""}`}
                      >
                        {isToday
                          ? day.toLocaleDateString(undefined, { month: "short", day: "numeric" })
                          : day.getDate() === 1
                          ? day.toLocaleDateString(undefined, { month: "short", day: "numeric" })
                          : day.getDate()}
                      </span>
                      {dayTasks.map((task) => {
                        const { top, height } = getTaskBlock(task);
                        return (
                          <div
                            key={task.id}
                            className={styles.monthTaskBlock}
                            onClick={(e) => handleTaskHover(task, e)}
                            onMouseEnter={(e) => { cancelClose(); handleTaskHover(task, e); }}
                            onMouseLeave={scheduleClose}
                            style={{
                              background: getCategoryColor(task),
                              top: `${top}%`,
                              height: `${height}%`,
                            }}
                          >
                            <span className={styles.taskLabel}>{getTaskLabel(task)}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {popover && (
        <TaskPopover
          key={popover.task.id}
          task={popover.task}
          projectName={getProjectName(popover.task)}
          categoryName={getCategoryName(popover.task)}
          projects={projects}
          anchorRect={popover.rect}
          onClose={() => setPopover(null)}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        />
      )}
    </div>
  );
}
