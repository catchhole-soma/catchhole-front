import React, { createContext, useContext, useState } from 'react';
import { WorkId, EditorMode } from '../components/catchhole/constants';

export interface SelectedWorkMeta {
  id: WorkId;
  title: string;
  genre: string;
}

const SELECTED_WORK_KEY = 'catchhole_selected_work';
const DEFAULT_WORK: SelectedWorkMeta = { id: 'detective', title: '빛나는 검사 로맨스', genre: '로맨스' };

function loadSelectedWork(): SelectedWorkMeta {
  try {
    const raw = sessionStorage.getItem(SELECTED_WORK_KEY);
    if (!raw) return DEFAULT_WORK;
    const parsed = JSON.parse(raw) as Partial<SelectedWorkMeta>;
    return typeof parsed.id === 'string' && typeof parsed.title === 'string' && typeof parsed.genre === 'string'
      ? { id: parsed.id, title: parsed.title, genre: parsed.genre }
      : DEFAULT_WORK;
  } catch {
    return DEFAULT_WORK;
  }
}

interface AppState {
  selectedWork: WorkId;
  selectedWorkMeta: SelectedWorkMeta;
  selectWork: (work: SelectedWorkMeta) => void;
  editorMode: EditorMode;
  setEditorMode: (m: EditorMode) => void;
}

const AppContext = createContext<AppState>(null!);

export function AppContextProvider({ children }: { children: React.ReactNode }) {
  const [selectedWorkMeta, setSelectedWorkMeta] = useState<SelectedWorkMeta>(loadSelectedWork);
  const [editorMode, setEditorMode] = useState<EditorMode>('edit');

  const selectWork = (work: SelectedWorkMeta) => {
    setSelectedWorkMeta(work);
    sessionStorage.setItem(SELECTED_WORK_KEY, JSON.stringify(work));
  };

  return (
    <AppContext.Provider value={{
      selectedWork: selectedWorkMeta.id,
      selectedWorkMeta,
      selectWork,
      editorMode,
      setEditorMode,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => useContext(AppContext);
