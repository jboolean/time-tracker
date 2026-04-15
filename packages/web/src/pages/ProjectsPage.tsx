import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCategories } from "../hooks/useCategories";
import { useProjects } from "../hooks/useProjects";
import { api } from "../api/client";
import type { Category, Project } from "@time-tracker/shared";
import styles from "../styles/ProjectsPage.module.css";

interface NewProjectForm {
  name: string;
  description: string;
  categoryId: string;
  keywords: string;
  isDefault: boolean;
}

interface EditingField {
  projectId: string;
  field: "name" | "description";
  value: string;
}

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const { data: categories = [], isError: categoriesError } = useCategories();
  const { data: projects = [], isError: projectsError } = useProjects();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewProjectForm>({
    name: "",
    description: "",
    categoryId: "",
    keywords: "",
    isDefault: false,
  });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<EditingField | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const categoryMap = new Map((categories as Category[]).map((c) => [c.id, c]));

  const grouped = (categories as Category[])
    .map((cat) => ({
      category: cat,
      projects: (projects as Project[]).filter((p) => p.categoryId === cat.id),
    }))
    .filter((g) => g.projects.length > 0);

  const uncategorized = (projects as Project[]).filter(
    (p) => !(categories as Category[]).find((c) => c.id === p.categoryId)
  );

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.categoryId) return;
    setSaving(true);
    try {
      const keywords = form.keywords.split(",").map((k) => k.trim()).filter(Boolean);
      await api.projects.create({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        categoryId: form.categoryId,
        keywords,
        isDefault: form.isDefault,
      });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      setShowForm(false);
      setForm({ name: "", description: "", categoryId: "", keywords: "", isDefault: false });
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function handleFieldClick(project: Project, field: "name" | "description") {
    setEditing({
      projectId: project.id,
      field,
      value: field === "name" ? project.name : (project.description ?? ""),
    });
  }

  async function handleFieldSave() {
    if (!editing) return;
    const original = (projects as Project[]).find((p) => p.id === editing.projectId);
    if (!original) { setEditing(null); return; }
    const current = editing.field === "name" ? original.name : (original.description ?? "");
    if (editing.value === current) { setEditing(null); return; }
    try {
      await api.projects.update(editing.projectId, { [editing.field]: editing.value });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    } catch (err) {
      console.error(err);
    } finally {
      setEditing(null);
    }
  }

  function handleFieldKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleFieldSave();
    if (e.key === "Escape") setEditing(null);
  }

  async function handleDeleteProject(projectId: string) {
    try {
      await api.projects.delete(projectId);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    } catch (err) {
      console.error(err);
    } finally {
      setConfirmDelete(null);
    }
  }

  function renderProject(project: Project) {
    const isEditingName = editing?.projectId === project.id && editing.field === "name";
    const isEditingDesc = editing?.projectId === project.id && editing.field === "description";
    const cat = categoryMap.get(project.categoryId);
    const accentColor = cat
      ? `hsl(${cat.hue}, ${cat.saturation}%, ${cat.lightness}%)`
      : "var(--border)";

    return (
      <div
        key={project.id}
        className={styles.projectCard}
        style={{ borderLeftColor: accentColor }}
      >
        <div className={styles.projectBody}>
          {isEditingName ? (
            <input
              autoFocus
              value={editing.value}
              onChange={(e) => setEditing((ed) => ed ? { ...ed, value: e.target.value } : null)}
              onBlur={handleFieldSave}
              onKeyDown={handleFieldKeyDown}
              className={styles.editInput}
            />
          ) : (
            <div
              className={styles.projectName}
              onClick={() => handleFieldClick(project, "name")}
              title="Click to edit name"
            >
              {project.name}
            </div>
          )}

          {isEditingDesc ? (
            <input
              autoFocus
              value={editing.value}
              onChange={(e) => setEditing((ed) => ed ? { ...ed, value: e.target.value } : null)}
              onBlur={handleFieldSave}
              onKeyDown={handleFieldKeyDown}
              className={`${styles.editInput} ${styles.editInputDesc}`}
            />
          ) : (
            <div
              className={`${styles.projectDesc} ${!project.description ? styles.projectDescPlaceholder : ""}`}
              onClick={() => handleFieldClick(project, "description")}
              title="Click to edit description"
            >
              {project.description || "Add description…"}
            </div>
          )}
        </div>

        {project.isDefault && (
          <span className={styles.defaultBadge}>Default</span>
        )}

        <div className={styles.cardActions}>
          <button
            className="btn-sm"
            onClick={() => handleFieldClick(project, "name")}
            title="Edit name"
          >
            Edit
          </button>
          {confirmDelete === project.id ? (
            <>
              <button
                className="btn-sm btn-active"
                onClick={() => handleDeleteProject(project.id)}
              >
                Confirm
              </button>
              <button
                className="btn-sm"
                onClick={() => setConfirmDelete(null)}
              >
                ✕
              </button>
            </>
          ) : (
            <button
              className="btn-sm"
              onClick={() => setConfirmDelete(project.id)}
              title="Delete project"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h2>Projects</h2>
        <button onClick={() => setShowForm((v) => !v)} className="btn">
          + New Project
        </button>
      </div>

      {(categoriesError || projectsError) && (
        <div className={styles.error}>Failed to load data</div>
      )}

      {showForm && (
        <form onSubmit={handleCreateProject} className={styles.newForm}>
          <h3>New Project</h3>

          <div className={styles.formRow}>
            <label className={`${styles.label} ${styles.labelFlex}`}>
              Name *
              <input required value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="form-input" />
            </label>
            <label className={`${styles.label} ${styles.labelFlex}`}>
              Category *
              <select required value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                className="form-input">
                <option value="">Select category</option>
                {(categories as Category[]).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          </div>

          <label className={styles.label}>
            Description
            <input value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="form-input" />
          </label>

          <label className={styles.label}>
            Keywords (comma-separated)
            <input value={form.keywords}
              onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
              placeholder="e.g. code, review, meeting"
              className="form-input" />
          </label>

          <label className={`${styles.label} ${styles.labelRow}`}>
            <input type="checkbox" checked={form.isDefault}
              onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))} />
            Default project for this category
          </label>

          <div className={styles.formActions}>
            <button type="button" onClick={() => setShowForm(false)} className="btn">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn">
              {saving ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      )}

      {grouped.map(({ category, projects: catProjects }: { category: Category; projects: Project[] }) => (
        <div key={category.id} className={styles.categoryGroup}>
          <div className={styles.categoryHeader}>
            <div
              className={styles.categoryDot}
              style={{ background: `hsl(${category.hue}, ${category.saturation}%, ${category.lightness}%)` }}
            />
            <h3
              className={styles.categoryName}
              style={{ color: `hsl(${category.hue}, ${category.saturation}%, ${category.lightness}%)` }}
            >
              {category.name}
            </h3>
          </div>
          {catProjects.map(renderProject)}
        </div>
      ))}

      {uncategorized.length > 0 && (
        <div className={styles.categoryGroup}>
          <h3 className={styles.categoryName} style={{ color: "var(--text-muted)" }}>
            Uncategorized
          </h3>
          {uncategorized.map(renderProject)}
        </div>
      )}

      {(projects as Project[]).length === 0 && !projectsError && (
        <div className={styles.empty}>No projects yet. Create one to get started.</div>
      )}
    </div>
  );
}
