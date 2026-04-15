import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Task, Project } from "@time-tracker/shared";
import { api } from "../api/client";
import styles from "../styles/TaskPopover.module.css";

interface TaskPopoverProps {
  task: Task;
  projectName: string;
  categoryName: string;
  projects: Project[];
  anchorRect: DOMRect;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TaskPopover({
  task,
  projectName,
  categoryName,
  projects,
  anchorRect,
  onClose,
  onMouseEnter,
  onMouseLeave,
}: TaskPopoverProps) {
  const [editing, setEditing] = useState(false);
  const [editProjectId, setEditProjectId] = useState(task.projectId);
  const [editStartTime, setEditStartTime] = useState(toDatetimeLocal(task.startTime));
  const [editEndTime, setEditEndTime] = useState(task.endTime ? toDatetimeLocal(task.endTime) : "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [timeError, setTimeError] = useState("");
  const queryClient = useQueryClient();

  const POPOVER_HEIGHT_ESTIMATE = 220;
  const rawTop = anchorRect.top + window.scrollY;
  const maxTop = window.innerHeight + window.scrollY - POPOVER_HEIGHT_ESTIMATE;
  const top = Math.min(rawTop, maxTop);
  const left = Math.min(anchorRect.right + 8, window.innerWidth - 300);

  async function handleSave() {
    if (editEndTime && new Date(editStartTime) >= new Date(editEndTime)) {
      setTimeError("Start must be before end");
      return;
    }
    setTimeError("");
    setSaving(true);
    try {
      await api.tasks.update(task.id, {
        projectId: editProjectId,
        startTime: new Date(editStartTime).toISOString(),
        endTime: editEndTime ? new Date(editEndTime).toISOString() : null,
      });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await api.tasks.delete(task.id);
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      onClose();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div
      className={styles.popover}
      style={{ top, left }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={editing ? undefined : onMouseLeave}
    >
      <div className={styles.header}>
        <span className={styles.title}>
          {task.title || task.rawInput || "(no title)"}
        </span>
        <button className={styles.closeBtn} onClick={onClose}>×</button>
      </div>

      {task.rawInput && task.title && (
        <div className={styles.rawInput}>{task.rawInput}</div>
      )}

      {!editing && (
        <div className={styles.meta}>
          <div>
            <span className={styles.metaLabel}>Project:</span> {projectName}
          </div>
          <div>
            <span className={styles.metaLabel}>Category:</span> {categoryName}
          </div>
          <div>
            <span className={styles.metaLabel}>Start:</span> {formatDateTime(task.startTime)}
          </div>
          {task.endTime && (
            <div>
              <span className={styles.metaLabel}>End:</span> {formatDateTime(task.endTime)}
            </div>
          )}
          {!task.endTime && (
            <div className={styles.activeTag}>Active</div>
          )}
          <button className={`btn btn-sm ${styles.editBtn}`} onClick={() => setEditing(true)}>
            Edit
          </button>
        </div>
      )}

      {editing && (
        <div className={styles.editForm}>
          <label className={styles.fieldLabel}>Project</label>
          <select
            className={`form-input ${styles.editSelect}`}
            value={editProjectId}
            onChange={(e) => setEditProjectId(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <label className={styles.fieldLabel}>Start</label>
          <input
            type="datetime-local"
            className={`form-input ${styles.editInput}`}
            value={editStartTime}
            onChange={(e) => setEditStartTime(e.target.value)}
          />

          <label className={styles.fieldLabel}>End</label>
          <input
            type="datetime-local"
            className={`form-input ${styles.editInput}`}
            value={editEndTime}
            onChange={(e) => setEditEndTime(e.target.value)}
          />

          {timeError && <div className={styles.timeError}>{timeError}</div>}

          <div className={styles.editActions}>
            <button
              className="btn btn-sm"
              onClick={handleSave}
              disabled={saving}
              style={{ opacity: saving ? 0.5 : 1 }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button className="btn btn-sm" onClick={() => { setEditing(false); setConfirmDelete(false); }}>
              Cancel
            </button>
            <button
              className={`btn btn-sm ${styles.deleteBtn}`}
              onClick={handleDelete}
            >
              {confirmDelete ? "Confirm?" : "Delete"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
