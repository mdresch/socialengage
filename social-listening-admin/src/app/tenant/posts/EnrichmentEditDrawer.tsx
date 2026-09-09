'use client';

import { useState, useEffect, useRef, type ReactElement } from 'react';
import type { PostDetailPanelPost } from './PostDetailPanel';
import type { PostEnrichmentUpdateInput } from '@/lib/core-client';

const ISO_LANGUAGES: Array<{ code: string; label: string }> = [
  { code: 'en', label: 'English (en)' },
  { code: 'es', label: 'Spanish (es)' },
  { code: 'fr', label: 'French (fr)' },
  { code: 'de', label: 'German (de)' },
  { code: 'nl', label: 'Dutch (nl)' },
  { code: 'it', label: 'Italian (it)' },
  { code: 'pt', label: 'Portuguese (pt)' },
  { code: 'zh', label: 'Chinese (zh)' },
  { code: 'ja', label: 'Japanese (ja)' },
  { code: 'ko', label: 'Korean (ko)' },
  { code: 'ar', label: 'Arabic (ar)' },
  { code: 'ru', label: 'Russian (ru)' },
  { code: 'tr', label: 'Turkish (tr)' },
  { code: 'pl', label: 'Polish (pl)' },
  { code: 'sv', label: 'Swedish (sv)' },
  { code: 'da', label: 'Danish (da)' },
  { code: 'fi', label: 'Finnish (fi)' },
  { code: 'no', label: 'Norwegian (no)' },
  { code: 'el', label: 'Greek (el)' },
  { code: 'he', label: 'Hebrew (he)' },
  { code: 'hi', label: 'Hindi (hi)' },
  { code: 'id', label: 'Indonesian (id)' },
  { code: 'vi', label: 'Vietnamese (vi)' },
  { code: 'uk', label: 'Ukrainian (uk)' },
  { code: 'th', label: 'Thai (th)' },
  { code: 'cs', label: 'Czech (cs)' },
  { code: 'ro', label: 'Romanian (ro)' },
  { code: 'hu', label: 'Hungarian (hu)' },
];

const ISO_COUNTRIES: Array<{ code: string; name: string }> = [
  { code: 'US', name: 'United States (US)' },
  { code: 'GB', name: 'United Kingdom (GB)' },
  { code: 'NL', name: 'Netherlands (NL)' },
  { code: 'DE', name: 'Germany (DE)' },
  { code: 'FR', name: 'France (FR)' },
  { code: 'CA', name: 'Canada (CA)' },
  { code: 'AU', name: 'Australia (AU)' },
  { code: 'BR', name: 'Brazil (BR)' },
  { code: 'JP', name: 'Japan (JP)' },
  { code: 'CN', name: 'China (CN)' },
  { code: 'IN', name: 'India (IN)' },
  { code: 'IT', name: 'Italy (IT)' },
  { code: 'ES', name: 'Spain (ES)' },
  { code: 'MX', name: 'Mexico (MX)' },
  { code: 'KR', name: 'South Korea (KR)' },
  { code: 'CH', name: 'Switzerland (CH)' },
  { code: 'BE', name: 'Belgium (BE)' },
  { code: 'SE', name: 'Sweden (SE)' },
  { code: 'PL', name: 'Poland (PL)' },
  { code: 'AR', name: 'Argentina (AR)' },
  { code: 'ZA', name: 'South Africa (ZA)' },
  { code: 'AE', name: 'United Arab Emirates (AE)' },
  { code: 'SG', name: 'Singapore (SG)' },
  { code: 'IE', name: 'Ireland (IE)' },
  { code: 'NZ', name: 'New Zealand (NZ)' },
  { code: 'AT', name: 'Austria (AT)' },
  { code: 'NO', name: 'Norway (NO)' },
  { code: 'DK', name: 'Denmark (DK)' },
  { code: 'FI', name: 'Finland (FI)' },
  { code: 'PT', name: 'Portugal (PT)' },
  { code: 'GR', name: 'Greece (GR)' },
  { code: 'IL', name: 'Israel (IL)' },
];

export interface EnrichmentEditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  post: PostDetailPanelPost;
  onSave: (updates: PostEnrichmentUpdateInput) => Promise<void>;
}

export function EnrichmentEditDrawer({
  isOpen,
  onClose,
  post,
  onSave,
}: EnrichmentEditDrawerProps): ReactElement | null {
  const current = post.enrichmentSummary;

  const [sentiment, setSentiment] = useState<'positive' | 'neutral' | 'negative' | 'mixed'>(
    (current?.sentiment as 'positive' | 'neutral' | 'negative' | 'mixed') ?? 'neutral'
  );
  const [confidence, setConfidence] = useState<number>(
    typeof current?.sentimentConfidence === 'number' ? current.sentimentConfidence : 0.8
  );
  const [reason, setReason] = useState<string>('');
  const [keyPhrases, setKeyPhrases] = useState<string[]>(current?.keyPhrases ?? []);
  const [newPhraseInput, setNewPhraseInput] = useState('');
  const [detectedLanguage, setDetectedLanguage] = useState<string>(current?.language ?? 'en');
  const [geoCountry, setGeoCountry] = useState<string>(current?.geoCountry ?? '');
  const [summary, setSummary] = useState<string>(current?.summary ?? '');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const drawerRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus initial element
    const timeout = setTimeout(() => {
      firstFocusableRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      clearTimeout(timeout);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function handleAddPhrase() {
    const trimmed = newPhraseInput.trim().replace(/<[^>]*>/g, '');
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    if (keyPhrases.some((p) => p.toLowerCase() === lower)) {
      setNewPhraseInput('');
      return;
    }
    if (keyPhrases.length >= 50) return;
    setKeyPhrases([...keyPhrases, trimmed.slice(0, 200)]);
    setNewPhraseInput('');
  }

  function handleRemovePhrase(indexToRemove: number) {
    setKeyPhrases(keyPhrases.filter((_, idx) => idx !== indexToRemove));
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    setErrorMsg(null);

    const updates: PostEnrichmentUpdateInput = {
      sentiment,
      sentimentScore: confidence,
      reason: reason.trim() ? reason.trim() : undefined,
      keyPhrases,
      detectedLanguage: detectedLanguage ? detectedLanguage : null,
      geoCountry: geoCountry ? geoCountry : null,
      summary: summary.trim() ? summary.trim().slice(0, 1000) : null,
    };

    try {
      await onSave(updates);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save enrichment overrides.');
      setSaving(false);
    }
  }

  return (
    <div
      className="enrichment-edit-drawer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="enrichment-edit-drawer-title"
      ref={drawerRef}
    >
      <div className="enrichment-edit-drawer-header">
        <div>
          <button
            type="button"
            className="enrichment-edit-back-btn"
            onClick={onClose}
            aria-label="Back to post details"
          >
            ← Back to Details
          </button>
          <h2 id="enrichment-edit-drawer-title" className="enrichment-edit-drawer-title">
            Edit AI Cognitive Analysis
          </h2>
          <p className="enrichment-edit-drawer-subtitle">
            Post ID: <code>{post.id}</code>
          </p>
        </div>
        <button
          ref={firstFocusableRef}
          type="button"
          className="slideover-close-btn"
          onClick={onClose}
          aria-label="Close edit drawer"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleFormSubmit} className="enrichment-edit-drawer-content">
        {errorMsg && (
          <div role="alert" className="pf-edit-error-banner">
            {errorMsg}
          </div>
        )}

        {/* Sentiment Segmented Control */}
        <div className="pf-edit-section">
          <label className="pf-edit-label">Sentiment Classification</label>
          <div className="pf-segmented-control" role="radiogroup" aria-label="Sentiment Classification">
            {(['positive', 'neutral', 'negative', 'mixed'] as const).map((s) => {
              const isActive = sentiment === s;
              const capitalized = s.charAt(0).toUpperCase() + s.slice(1);
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  className={`pf-segmented-btn pf-segmented-${s}${isActive ? ' active' : ''}`}
                  onClick={() => setSentiment(s)}
                >
                  {capitalized}
                </button>
              );
            })}
          </div>
        </div>

        {/* Override Audit Reason */}
        <div className="pf-edit-section">
          <label htmlFor="enrichment-override-reason" className="pf-edit-label">
            Override Reason (Optional)
          </label>
          <input
            id="enrichment-override-reason"
            type="text"
            className="pf-edit-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Sarcasm missed by AI model, manual customer review"
            maxLength={300}
          />
        </div>

        {/* Key Phrases Tag Editor */}
        <div className="pf-edit-section">
          <label className="pf-edit-label">
            Key Phrases & Topics ({keyPhrases.length}/50)
          </label>
          <div className="pf-tag-editor">
            <div className="pf-tag-pill-list">
              {keyPhrases.map((phrase, idx) => (
                <span key={`${phrase}-${idx}`} className="pf-tag-pill">
                  #{phrase}
                  <button
                    type="button"
                    className="pf-tag-remove-btn"
                    onClick={() => handleRemovePhrase(idx)}
                    aria-label={`Remove phrase ${phrase}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="pf-tag-input-row">
              <input
                type="text"
                value={newPhraseInput}
                onChange={(e) => setNewPhraseInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddPhrase();
                  }
                }}
                placeholder="Type key phrase and press Enter..."
                maxLength={200}
                className="pf-tag-input"
              />
              <button
                type="button"
                onClick={handleAddPhrase}
                disabled={!newPhraseInput.trim() || keyPhrases.length >= 50}
                className="pf-tag-add-btn"
              >
                + Add
              </button>
            </div>
          </div>
        </div>

        {/* Detected Language Dropdown */}
        <div className="pf-edit-section">
          <label htmlFor="edit-detected-language" className="pf-edit-label">
            Detected Language (ISO 639-1)
          </label>
          <select
            id="edit-detected-language"
            name="detectedLanguage"
            value={detectedLanguage}
            onChange={(e) => setDetectedLanguage(e.target.value)}
            className="pf-edit-select"
          >
            <option value="">None / Unset</option>
            {ISO_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>

        {/* Country / Region Selector */}
        <div className="pf-edit-section">
          <label htmlFor="edit-geo-country" className="pf-edit-label">
            Geospatial Country Attribution (ISO 3166-1 alpha-2)
          </label>
          <select
            id="edit-geo-country"
            name="geoCountry"
            value={geoCountry}
            onChange={(e) => setGeoCountry(e.target.value)}
            className="pf-edit-select"
          >
            <option value="">Unknown / Unmapped</option>
            {ISO_COUNTRIES.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
        </div>

        {/* Executive Summary / Notes Textarea */}
        <div className="pf-edit-section">
          <div className="pf-edit-label-row">
            <label htmlFor="edit-summary" className="pf-edit-label">
              Executive Summary & Analyst Notes
            </label>
            <span className="pf-edit-char-count">{summary.length}/1000</span>
          </div>
          <textarea
            id="edit-summary"
            name="summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Add analyst context or corrected executive summary..."
            maxLength={1000}
            rows={4}
            className="pf-edit-textarea"
          />
        </div>

        {/* Action Footer */}
        <div className="enrichment-edit-drawer-footer">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="pf-edit-cancel-btn"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="pf-edit-save-btn"
          >
            {saving ? (
              <>
                <span className="pf-enrich-spinner" aria-hidden="true" />
                Saving…
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
