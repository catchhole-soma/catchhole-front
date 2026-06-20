import React, { createContext, useContext, useState } from 'react';
import { WorkId, EditorMode } from '../components/catchhole/constants';

interface AppState {
  selectedWork: WorkId;
  setSelectedWork: (w: WorkId) => void;
  editorMode: EditorMode;
  setEditorMode: (m: EditorMode) => void;
}

const AppContext = createContext<AppState>(null!);

export function AppContextProvider({ children }: { children: React.ReactNode }) {
  const [selectedWork, setSelectedWork] = useState<WorkId>('detective');
  const [editorMode, setEditorMode] = useState<EditorMode>('edit');

  return (
    <AppContext.Provider value={{ selectedWork, setSelectedWork, editorMode, setEditorMode }}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => useContext(AppContext);
