import React, { useState } from 'react';
import { Sparkles, Check, Loader2 } from 'lucide-react';

interface RunEnrichmentButtonProps {
  postId: string;
  onEnrich: (postId: string) => Promise<void>;
  id?: string;
}

export const RunEnrichmentButton: React.FC<RunEnrichmentButtonProps> = ({
  postId,
  onEnrich,
  id,
}) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    setSuccess(false);
    try {
      await onEnrich(postId);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      console.error('Enrichment failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      id={id || `enrich-btn-${postId}`}
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-all shadow-xs ${
        success
          ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
          : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300 active:bg-blue-200'
      } disabled:opacity-60 disabled:cursor-not-allowed`}
      title="Trigger on-demand Azure AI Language & Azure OpenAI reasoning"
    >
      {loading ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
          <span>Analyzing payload...</span>
        </>
      ) : success ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-600" />
          <span>Enriched!</span>
        </>
      ) : (
        <>
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Run enrichment now</span>
        </>
      )}
    </button>
  );
};
