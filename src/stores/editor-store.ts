import { create } from "zustand";

export type FieldType = "SIGNATURE" | "INITIALS" | "TEXT" | "DATE" | "CHECKBOX";

export interface LocalField {
  id: string;
  documentId: string;
  signerId?: string | null;
  type: FieldType;
  pageNumber: number;
  x: number; // normalized 0-1
  y: number;
  width: number;
  height: number;
  required: boolean;
  value?: string | null;
  _isNew?: boolean;   // not yet saved to DB
  _deleted?: boolean; // marked for deletion
  _dirty?: boolean;   // needs PATCH
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface EditorStore {
  // State
  documentId: string | null;
  envelopeId: string | null;
  pageCount: number;
  currentPage: number;
  zoom: number;
  fields: LocalField[];
  selectedFieldId: string | null;
  saveStatus: SaveStatus;

  // Internal
  _saveTimer: ReturnType<typeof setTimeout> | null;

  // Actions
  init: (opts: {
    documentId: string;
    envelopeId: string;
    pageCount: number;
    initialFields: LocalField[];
  }) => void;
  reset: () => void;
  setPage: (page: number) => void;
  setZoom: (zoom: number) => void;
  selectField: (id: string | null) => void;

  addField: (field: Omit<LocalField, "id" | "_isNew" | "_dirty">) => string;
  updateField: (id: string, updates: Partial<LocalField>) => void;
  deleteField: (id: string) => void;

  scheduleSave: () => void;
  flushSave: () => Promise<void>;
}

let _tempIdCounter = 0;
function tempId() {
  return `__new__${++_tempIdCounter}`;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  documentId: null,
  envelopeId: null,
  pageCount: 1,
  currentPage: 1,
  zoom: 1,
  fields: [],
  selectedFieldId: null,
  saveStatus: "idle",
  _saveTimer: null,

  init({ documentId, envelopeId, pageCount, initialFields }) {
    set({
      documentId,
      envelopeId,
      pageCount,
      currentPage: 1,
      fields: initialFields,
      selectedFieldId: null,
      saveStatus: "idle",
    });
  },

  reset() {
    const timer = get()._saveTimer;
    if (timer) clearTimeout(timer);
    set({
      documentId: null,
      envelopeId: null,
      pageCount: 1,
      currentPage: 1,
      zoom: 1,
      fields: [],
      selectedFieldId: null,
      saveStatus: "idle",
      _saveTimer: null,
    });
  },

  setPage(page) {
    const { pageCount } = get();
    set({ currentPage: Math.max(1, Math.min(page, pageCount)) });
  },

  setZoom(zoom) {
    set({ zoom: Math.max(0.5, Math.min(zoom, 2.5)) });
  },

  selectField(id) {
    set({ selectedFieldId: id });
  },

  addField(field) {
    const id = tempId();
    set((state) => ({
      fields: [...state.fields, { ...field, id, _isNew: true, _dirty: false }],
      selectedFieldId: id,
    }));
    get().scheduleSave();
    return id;
  },

  updateField(id, updates) {
    set((state) => ({
      fields: state.fields.map((f) =>
        f.id === id ? { ...f, ...updates, _dirty: true } : f
      ),
    }));
    get().scheduleSave();
  },

  deleteField(id) {
    const { fields } = get();
    const field = fields.find((f) => f.id === id);
    if (!field) return;

    if (field._isNew) {
      // Never saved — just remove locally
      set((state) => ({
        fields: state.fields.filter((f) => f.id !== id),
        selectedFieldId: state.selectedFieldId === id ? null : state.selectedFieldId,
      }));
    } else {
      // Mark for deletion, schedule save
      set((state) => ({
        fields: state.fields.map((f) =>
          f.id === id ? { ...f, _deleted: true } : f
        ),
        selectedFieldId: state.selectedFieldId === id ? null : state.selectedFieldId,
      }));
      get().scheduleSave();
    }
  },

  scheduleSave() {
    const existing = get()._saveTimer;
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      get().flushSave();
    }, 500);
    set({ _saveTimer: timer });
  },

  async flushSave() {
    const { documentId, fields } = get();
    if (!documentId) return;

    const toCreate = fields.filter((f) => f._isNew && !f._deleted);
    const toUpdate = fields.filter((f) => f._dirty && !f._isNew && !f._deleted);
    const toDelete = fields.filter((f) => f._deleted && !f._isNew);

    if (toCreate.length === 0 && toUpdate.length === 0 && toDelete.length === 0)
      return;

    set({ saveStatus: "saving" });

    try {
      // Create new fields
      const createdIds: Record<string, string> = {};
      for (const f of toCreate) {
        const res = await fetch(`/api/documents/${documentId}/fields`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: f.type,
            pageNumber: f.pageNumber,
            x: f.x,
            y: f.y,
            width: f.width,
            height: f.height,
            required: f.required,
            signerId: f.signerId ?? null,
          }),
        });
        if (res.ok) {
          const saved = await res.json();
          createdIds[f.id] = saved.id;
        }
      }

      // Patch dirty fields
      for (const f of toUpdate) {
        await fetch(`/api/documents/${documentId}/fields/${f.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            x: f.x,
            y: f.y,
            width: f.width,
            height: f.height,
            required: f.required,
            signerId: f.signerId ?? null,
            pageNumber: f.pageNumber,
          }),
        });
      }

      // Delete removed fields
      for (const f of toDelete) {
        await fetch(`/api/documents/${documentId}/fields/${f.id}`, {
          method: "DELETE",
        });
      }

      // Update local state: assign real IDs, clear flags
      set((state) => ({
        saveStatus: "saved",
        fields: state.fields
          .filter((f) => !f._deleted)
          .map((f) => {
            if (f._isNew && createdIds[f.id]) {
              return { ...f, id: createdIds[f.id], _isNew: false, _dirty: false };
            }
            return { ...f, _dirty: false };
          }),
      }));
    } catch (err) {
      console.error("[EditorStore.flushSave]", err);
      set({ saveStatus: "error" });
    }
  },
}));

