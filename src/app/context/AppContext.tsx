import React, { createContext, useContext, useState } from 'react';
import { WorkId, EditorMode } from '../components/catchhole/constants';
import type { SelectedWorkInfo } from '../lib/work-contract';

interface AppState {
  selectedWork: WorkId;
  setSelectedWork: (w: WorkId) => void;
  selectedWorkInfo: SelectedWorkInfo | null;
  setSelectedWorkInfo: (work: SelectedWorkInfo | null) => void;
  editorMode: EditorMode;
  setEditorMode: (m: EditorMode) => void;
}

const AppContext = createContext<AppState>(null!);

export function AppContextProvider({ children }: { children: React.ReactNode }) {
  const [selectedWork, setSelectedWork] = useState<WorkId>('detective');
  const [selectedWorkInfo, setSelectedWorkInfo] = useState<SelectedWorkInfo | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>('edit');

  return (
    <AppContext.Provider value={{
      selectedWork,
      setSelectedWork,
      selectedWorkInfo,
      setSelectedWorkInfo,
      editorMode,
      setEditorMode,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => useContext(AppContext);
