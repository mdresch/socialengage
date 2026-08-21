import type { SupportedPlatform, MediaAttachment, PlatformOverride } from '../types';

export interface SavedDraft {
  id: string;
  title: string;
  updatedAt: number;
  mainText: string;
  selectedPlatforms: SupportedPlatform[];
  media: MediaAttachment[];
  platformOverrides: Partial<Record<SupportedPlatform, PlatformOverride>>;
}

const STORAGE_KEY = 'se_polypost_saved_drafts';
const AUTOSAVE_KEY = 'se_polypost_autosave';

export function getSavedDrafts(): SavedDraft[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDraft(draft: Omit<SavedDraft, 'id' | 'updatedAt'>, existingId?: string): SavedDraft {
  const drafts = getSavedDrafts();
  const id = existingId || `draft_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const title = draft.mainText.trim().split('\n')[0].substring(0, 40) || 'Untitled Draft';

  const newDraft: SavedDraft = {
    ...draft,
    id,
    title,
    updatedAt: Date.now(),
  };

  const filtered = drafts.filter((d) => d.id !== id);
  const updated = [newDraft, ...filtered];

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // quota handling
    }
  }

  return newDraft;
}

export function deleteDraft(id: string): void {
  const drafts = getSavedDrafts().filter((d) => d.id !== id);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
    } catch {
      // ignore
    }
  }
}

export function saveAutoSave(draft: Omit<SavedDraft, 'id' | 'updatedAt' | 'title'>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      AUTOSAVE_KEY,
      JSON.stringify({
        ...draft,
        updatedAt: Date.now(),
      })
    );
  } catch {
    // ignore
  }
}

export function getAutoSave(): (Omit<SavedDraft, 'id' | 'title'> & { updatedAt: number }) | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
