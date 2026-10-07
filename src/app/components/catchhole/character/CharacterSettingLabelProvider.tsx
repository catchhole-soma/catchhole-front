/* eslint-disable react-refresh/only-export-components -- 작품별 표시명 context와 소비 hook을 함께 관리합니다. */
import { createContext, useContext, type ReactNode } from 'react';
import { characterFactTypeLabels } from '../../../lib/character-setting-labels';

const CharacterSettingLabelContext = createContext(characterFactTypeLabels());

export function CharacterSettingLabelProvider({ genre, children }: {
  genre?: string | null;
  children: ReactNode;
}) {
  return <CharacterSettingLabelContext.Provider value={characterFactTypeLabels(genre)}>
    {children}
  </CharacterSettingLabelContext.Provider>;
}

export function useCharacterSettingLabels() {
  return useContext(CharacterSettingLabelContext);
}
