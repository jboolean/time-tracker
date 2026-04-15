import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCategories } from "../hooks/useCategories";
import { api } from "../api/client";
import type { Category } from "@time-tracker/shared";
import styles from "../styles/CategoriesPage.module.css";

const NODE_R = 18;
const CHILD_NODE_R = 13;
const DRAG_THRESHOLD = 5;

function hslToPos(hue: number, saturation: number, size: number): { x: number; y: number } {
  const center = size / 2;
  const maxR = center - NODE_R - 6;
  const r = (saturation / 100) * maxR;
  const angle = ((hue - 90) * Math.PI) / 180;
  return {
    x: center + r * Math.cos(angle),
    y: center + r * Math.sin(angle),
  };
}

function posToHsl(x: number, y: number, size: number): { hue: number; saturation: number } {
  const center = size / 2;
  const maxR = center - NODE_R - 6;
  const dx = x - center;
  const dy = y - center;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const rawAngle = Math.atan2(dy, dx) * (180 / Math.PI);
  let hue = rawAngle + 90;
  if (hue < 0) hue += 360;
  if (hue >= 360) hue -= 360;
  const saturation = Math.round(Math.min(100, Math.max(0, (dist / maxR) * 100)));
  return { hue: Math.round(hue), saturation };
}

function findBestHue(categories: Category[]): number {
  if (categories.length === 0) return 0;
  const hues = [...categories.map((c) => c.hue)].sort((a, b) => a - b);
  let maxGap = 0;
  let bestHue = 0;
  for (let i = 0; i < hues.length; i++) {
    const next = hues[(i + 1) % hues.length];
    const gap = ((next - hues[i]) + 360) % 360;
    if (gap > maxGap) {
      maxGap = gap;
      bestHue = (hues[i] + gap / 2) % 360;
    }
  }
  return Math.round(bestHue);
}

interface DragState {
  id: string;
  hue: number;
  saturation: number;
  startX: number;
  startY: number;
  moved: boolean;
}

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const { data: categories = [], isError } = useCategories();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(0);
  const [dragging, setDragging] = useState<DragState | null>(null);

  // "new category" modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newParentId, setNewParentId] = useState("");
  const [saving, setSaving] = useState(false);

  // "edit category" modal
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [editName, setEditName] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const rootCategories = categories.filter((c: Category) => !c.parentId);
  const childCategories = categories.filter((c: Category) => c.parentId);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize(Math.floor(Math.min(width, height) - 16));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size <= 0) return;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const center = size / 2;
    const radius = size / 2;

    for (let h = 0; h < 360; h++) {
      const startAngle = ((h - 90 - 0.6) * Math.PI) / 180;
      const endAngle = ((h - 90 + 0.6) * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, startAngle, endAngle);
      ctx.fillStyle = `hsl(${h}, 100%, 55%)`;
      ctx.fill();
    }

    const sat = ctx.createRadialGradient(center, center, 0, center, center, radius);
    sat.addColorStop(0, "rgba(255,255,255,1)");
    sat.addColorStop(0.35, "rgba(255,255,255,0.55)");
    sat.addColorStop(1, "rgba(255,255,255,0)");
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.fillStyle = sat;
    ctx.fill();

    const vig = ctx.createRadialGradient(center, center, radius * 0.75, center, center, radius);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.12)");
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.fillStyle = vig;
    ctx.fill();
  }, [size]);

  function getSvgPoint(e: React.MouseEvent<SVGSVGElement>): { x: number; y: number } {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (size / rect.width),
      y: (e.clientY - rect.top) * (size / rect.height),
    };
  }

  function handleNodeMouseDown(cat: Category, e: React.MouseEvent) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setDragging({
      id: cat.id,
      hue: cat.hue,
      saturation: cat.saturation,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    });
  }

  function handleSvgMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!dragging) return;
    const dx = e.clientX - dragging.startX;
    const dy = e.clientY - dragging.startY;
    const moved = dragging.moved || Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD;
    const pt = getSvgPoint(e);
    const { hue, saturation } = posToHsl(pt.x, pt.y, size);
    setDragging((d) => (d ? { ...d, hue, saturation, moved } : null));
  }

  async function handleSvgMouseUp(e: React.MouseEvent<SVGSVGElement>) {
    if (!dragging) return;
    if (!dragging.moved) {
      // It was a click — open edit modal
      const cat = categories.find((c: Category) => c.id === dragging.id);
      if (cat) {
        setEditCat(cat);
        setEditName(cat.name);
      }
      setDragging(null);
      return;
    }
    const pt = getSvgPoint(e);
    const { hue, saturation } = posToHsl(pt.x, pt.y, size);
    const id = dragging.id;
    setDragging(null);
    queryClient.setQueryData(["categories"], (old: Category[] = []) =>
      old.map((c) => (c.id === id ? { ...c, hue, saturation } : c))
    );
    try {
      await api.categories.update(id, { hue, saturation });
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
    } catch (err) {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      console.error(err);
    }
  }

  async function handleNewSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    const hue = findBestHue(rootCategories);
    try {
      await api.categories.create({
        name: newName.trim(),
        hue,
        saturation: 70,
        lightness: 55,
        parentId: newParentId || undefined,
        keywords: [],
      });
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      setShowNewModal(false);
      setNewName("");
      setNewParentId("");
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editCat || !editName.trim()) return;
    setEditSaving(true);
    try {
      await api.categories.update(editCat.id, { name: editName.trim() });
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      setEditCat(null);
    } catch (err) {
      console.error(err);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleEditDelete() {
    if (!editCat) return;
    if (!confirm(`Delete "${editCat.name}"? This will fail if it has projects.`)) return;
    setEditSaving(true);
    try {
      await api.categories.delete(editCat.id);
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      setEditCat(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Could not delete: ${msg}`);
    } finally {
      setEditSaving(false);
    }
  }

  function getNodeProps(cat: Category) {
    if (dragging && dragging.id === cat.id) {
      return {
        pos: hslToPos(dragging.hue, dragging.saturation, size),
        color: `hsl(${dragging.hue}, ${dragging.saturation}%, ${cat.lightness}%)`,
      };
    }
    return {
      pos: hslToPos(cat.hue, cat.saturation, size),
      color: `hsl(${cat.hue}, ${cat.saturation}%, ${cat.lightness}%)`,
    };
  }

  return (
    <div className={styles.page}>
      <div className={`${styles.toolbar} surface`}>
        <span className={styles.toolbarTitle}>Categories</span>
        <button onClick={() => setShowNewModal(true)} className={styles.newBtn}>
          + New Category
        </button>
      </div>

      {isError && <div className={styles.error}>Failed to load categories</div>}

      <div ref={containerRef} className={styles.wheelContainer}>
        {size > 0 && (
          <div className={styles.wheelInner} style={{ width: size, height: size }}>
            <canvas
              ref={canvasRef}
              className={styles.canvas}
              style={{ width: size, height: size }}
            />
            <svg
              width={size}
              height={size}
              className={styles.svg}
              style={{ cursor: dragging?.moved ? "grabbing" : "default" }}
              onMouseMove={handleSvgMouseMove}
              onMouseUp={handleSvgMouseUp}
              onMouseLeave={() => setDragging(null)}
            >
              {childCategories.map((child: Category) => {
                const parent = categories.find((c: Category) => c.id === child.parentId);
                if (!parent) return null;
                const { pos: pp } = getNodeProps(parent);
                const { pos: cp } = getNodeProps(child);
                return (
                  <line
                    key={`line-${child.id}`}
                    x1={pp.x} y1={pp.y} x2={cp.x} y2={cp.y}
                    stroke="rgba(0,0,0,0.2)"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                  />
                );
              })}

              {rootCategories.map((cat: Category) => {
                const { pos, color } = getNodeProps(cat);
                return (
                  <g key={cat.id} style={{ cursor: dragging?.id === cat.id && dragging.moved ? "grabbing" : "grab" }}>
                    <circle cx={pos.x} cy={pos.y} r={NODE_R + 8} fill="transparent"
                      onMouseDown={(e) => handleNodeMouseDown(cat, e)} />
                    <circle cx={pos.x} cy={pos.y} r={NODE_R} fill={color}
                      stroke="rgba(255,255,255,0.9)" strokeWidth={2.5}
                      onMouseDown={(e) => handleNodeMouseDown(cat, e)} />
                    <text x={pos.x} y={pos.y + NODE_R + 15}
                      textAnchor="middle" fontSize={12} fontWeight={300} fill="#1a1a1a"
                      style={{ pointerEvents: "none", userSelect: "none", filter: "drop-shadow(0 1px 2px rgba(255,255,255,0.8))" }}>
                      {cat.name}
                    </text>
                  </g>
                );
              })}

              {childCategories.map((cat: Category) => {
                const { pos, color } = getNodeProps(cat);
                return (
                  <g key={cat.id} style={{ cursor: dragging?.id === cat.id && dragging.moved ? "grabbing" : "grab" }}>
                    <circle cx={pos.x} cy={pos.y} r={CHILD_NODE_R + 6} fill="transparent"
                      onMouseDown={(e) => handleNodeMouseDown(cat, e)} />
                    <circle cx={pos.x} cy={pos.y} r={CHILD_NODE_R} fill={color}
                      stroke="rgba(255,255,255,0.7)" strokeWidth={2}
                      onMouseDown={(e) => handleNodeMouseDown(cat, e)} />
                    <text x={pos.x} y={pos.y + CHILD_NODE_R + 13}
                      textAnchor="middle" fontSize={11} fill="#444"
                      style={{ pointerEvents: "none", userSelect: "none", filter: "drop-shadow(0 1px 2px rgba(255,255,255,0.8))" }}>
                      {cat.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>

      {/* New category modal */}
      {showNewModal && (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setShowNewModal(false); }}>
          <div className={`${styles.modal} surface`}>
            <h3 className={styles.modalTitle}>New Category</h3>
            <p className={styles.modalHint}>Drag the node on the wheel to pick its color.</p>
            <form onSubmit={handleNewSubmit} className={styles.modalForm}>
              <label className={styles.label}>
                Name
                <input required autoFocus id="new-category-name" name="category-name" autoComplete="off" value={newName} onChange={(e) => setNewName(e.target.value)}
                  className={styles.textInput} />
              </label>
              <label className={styles.label}>
                Parent Category (optional)
                <select value={newParentId} onChange={(e) => setNewParentId(e.target.value)}
                  className={styles.selectInput}>
                  <option value="">None</option>
                  {rootCategories.map((c: Category) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <div className={styles.modalActions}>
                <button type="button" onClick={() => setShowNewModal(false)} className={styles.cancelBtn}>Cancel</button>
                <button type="submit" disabled={saving || !newName.trim()} className={styles.saveBtn}>
                  {saving ? "Saving…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit category modal */}
      {editCat && (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setEditCat(null); }}>
          <div className={`${styles.modal} surface`}>
            <h3 className={styles.modalTitle}>Edit Category</h3>
            <form onSubmit={handleEditSave} className={styles.modalForm}>
              <label className={styles.label}>
                Name
                <input required autoFocus id="edit-category-name" name="category-name" autoComplete="off" value={editName} onChange={(e) => setEditName(e.target.value)}
                  className={styles.textInput} />
              </label>
              <div className={styles.modalActions}>
                <button type="button" onClick={handleEditDelete} className={styles.deleteBtn} disabled={editSaving}>
                  Delete
                </button>
                <button type="button" onClick={() => setEditCat(null)} className={styles.cancelBtn}>Cancel</button>
                <button type="submit" disabled={editSaving || !editName.trim()} className={styles.saveBtn}>
                  {editSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
