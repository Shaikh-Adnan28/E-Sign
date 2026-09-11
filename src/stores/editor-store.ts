import { create } from 'zustand';

type Field = any;

interface EditorState {
  fields: Field[];
  addField: (field: Field) => void;
  updateField: (id: string, updates: Partial<Field>) => void;
  removeField: (id: string) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  fields: [],
  addField: (field) => set((state) => ({ fields: [...state.fields, field] })),
  updateField: (id, updates) => set((state) => ({
    fields: state.fields.map(f => f.id === id ? { ...f, ...updates } : f)
  })),
  removeField: (id) => set((state) => ({ fields: state.fields.filter(f => f.id !== id) })),
}));
