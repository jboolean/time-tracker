import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useActiveTask } from "../hooks/useTasks";
import { api } from "../api/client";
import styles from "../styles/BottomBar.module.css";

function getCurrentDatetimeLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatCompact(dtLocal: string): string {
  return new Date(dtLocal).toLocaleString(undefined, {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
}

function DateTimePicker({ value, onChange }: DateTimePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={styles.dtWrapper} onClick={() => inputRef.current?.showPicker()}>
      <span className={styles.dtDisplay}>{formatCompact(value)}</span>
      <input
        ref={inputRef}
        type="datetime-local"
        className={styles.dtInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export default function BottomBar() {
  const [input, setInput] = useState("");
  const [startTime, setStartTime] = useState(getCurrentDatetimeLocal);
  const [endTime, setEndTime] = useState(getCurrentDatetimeLocal);
  const startDirty = useRef(false);
  const endDirty = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const { data: activeTask } = useActiveTask();

  useEffect(() => {
    const interval = setInterval(() => {
      if (!startDirty.current) setStartTime(getCurrentDatetimeLocal());
      if (!endDirty.current) setEndTime(getCurrentDatetimeLocal());
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await api.intake.submit({
        rawInput: trimmed,
        startTime: new Date(startTime).toISOString(),
      });
      setInput("");
      startDirty.current = false;
      setStartTime(getCurrentDatetimeLocal());
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEndTask() {
    if (!activeTask) return;
    try {
      await api.tasks.update(activeTask.id, { endTime: new Date(endTime).toISOString() });
      endDirty.current = false;
      setEndTime(getCurrentDatetimeLocal());
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className={styles.bar}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="What are you working on?"
          disabled={submitting}
          className={`form-input ${styles.input}`}
        />
        <DateTimePicker
          value={startTime}
          onChange={(v) => { startDirty.current = true; setStartTime(v); }}
        />
        <button
          type="submit"
          disabled={submitting || !input.trim()}
          className="btn"
          style={{ opacity: submitting || !input.trim() ? 0.5 : 1 }}
        >
          {submitting ? "..." : "Start"}
        </button>
      </form>

      {activeTask && (
        <div className={styles.activeTask}>
          <span className={styles.activeTaskName}>
            {activeTask.title || activeTask.rawInput || ""}
          </span>
          <DateTimePicker
            value={endTime}
            onChange={(v) => { endDirty.current = true; setEndTime(v); }}
          />
          <button onClick={handleEndTask} className={`btn ${styles.endBtn}`}>
            End Task
          </button>
        </div>
      )}
    </div>
  );
}
