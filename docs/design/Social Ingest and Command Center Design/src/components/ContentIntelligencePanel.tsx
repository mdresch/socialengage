import React, { useState } from 'react';
import { Sparkles, ThumbsUp, ThumbsDown, MessageSquare, Save, RotateCcw, AlertTriangle, RefreshCw } from 'lucide-react';
import { Post } from '../types';

interface ContentIntelligencePanelProps {
  post: Post;
  onUpdatePost: (updatedPost: Post) => void;
  onClose: () => void;
}

export const ContentIntelligencePanel: React.FC<ContentIntelligencePanelProps> = ({
  post,
  onUpdatePost,
  onClose,
}) => {
  const [sentiment, setSentiment] = useState<'positive' | 'neutral' | 'negative'>(post.sentiment);
  const [draftReply, setDraftReply] = useState('');
  const [selectedTone, setSelectedTone] = useState('empathetic and supportive');
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [phrasesText, setPhrasesText] = useState(post.keyPhrases.join(', '));

  // Call the draft reply API
  const handleDraftReply = async () => {
    setDrafting(true);
    try {
      const res = await fetch('/api/draft-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postContent: post.content, tone: selectedTone }),
      });
      const data = await res.json();
      setDraftReply(data.reply || '');
    } catch (err) {
      console.error(err);
      setDraftReply("Hi there! We hear you loud and clear. Our team is actively investigating this behavior to restore your workflow as fast as possible. Thank you for your patience.");
    } finally {
      setDrafting(false);
    }
  };

  const handleSaveChanges = () => {
    setSaving(true);
    // Parse phrases
    const keyPhrases = phrasesText
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    // Call update callback
    onUpdatePost({
      ...post,
      sentiment,
      keyPhrases,
      sentimentAssignedBy: 'user', // flag as manually curated
    });

    setTimeout(() => {
      setSaving(false);
      onClose();
    }, 400);
  };

  return (
    <div className="bg-slate-50 p-4 border border-slate-200/80 rounded-none text-left space-y-4 shadow-sm select-none">
      {/* SECTION 1: INGEST INTEGRITY & SENTIMENT GAUGE */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Gemini Ingestion Audit
          </span>
        </div>
        <span className="text-[9px] uppercase tracking-wider bg-slate-200 px-1 py-0.5 font-bold text-slate-600">
          Source: {post.source}
        </span>
      </div>

      {/* POST DETAILS PREVIEW */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-900">{post.author.name || post.author.handle}</span>
          <span className="text-[10px] text-slate-400">@{post.author.handle}</span>
        </div>
        <p className="text-xs text-slate-700 italic border-l-2 border-slate-300 pl-2 bg-white/70 py-1.5 rounded-none font-medium">
          "{post.content}"
        </p>
      </div>

      {/* ADJUST SENTIMENT STATE */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Adjust Sentiment State
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setSentiment('positive')}
            className={`py-1.5 text-xs font-semibold flex items-center justify-center gap-1 border transition-all ${
              sentiment === 'positive'
                ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <ThumbsUp className="w-3.5 h-3.5" />
            <span>Positive</span>
          </button>
          <button
            type="button"
            onClick={() => setSentiment('neutral')}
            className={`py-1.5 text-xs font-semibold flex items-center justify-center gap-1 border transition-all ${
              sentiment === 'neutral'
                ? 'bg-slate-800 text-white border-slate-800 font-bold'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <span>Neutral</span>
          </button>
          <button
            type="button"
            onClick={() => setSentiment('negative')}
            className={`py-1.5 text-xs font-semibold flex items-center justify-center gap-1 border transition-all ${
              sentiment === 'negative'
                ? 'bg-rose-700 text-white border-rose-700 font-bold'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <ThumbsDown className="w-3.5 h-3.5" />
            <span>Negative</span>
          </button>
        </div>
        {sentiment !== post.sentiment && (
          <p className="text-[10px] text-amber-600 flex items-center gap-1 mt-1 font-medium bg-amber-50 p-1 border border-amber-200/50">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Overriding automated ratings will tag this post as "Manual".</span>
          </p>
        )}
      </div>

      {/* DYNAMIC KEYPHRASE TAGGER */}
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Extracted Taggers (Comma Separated)
        </label>
        <input
          type="text"
          value={phrasesText}
          onChange={(e) => setPhrasesText(e.target.value)}
          className="w-full border border-slate-200 bg-white px-2 py-1.5 text-xs focus:outline-hidden focus:border-slate-800 font-medium"
        />
      </div>

      {/* SECTION 2: CONTEXTUAL REPLY DRAFTING */}
      <div className="border-t border-slate-200/60 pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Contextual Reply Draft
          </label>
          {/* Tone Selector */}
          <select
            value={selectedTone}
            onChange={(e) => setSelectedTone(e.target.value)}
            className="text-[10px] border border-slate-200 px-1 py-0.5 bg-white text-slate-700 font-semibold focus:outline-hidden"
          >
            <option value="empathetic and supportive">Empathetic / Warm</option>
            <option value="technical and factual">Technical / Explanatory</option>
            <option value="formal and corporate">Formal / Corporate</option>
            <option value="concise and apologetic">Direct / Apologetic</option>
          </select>
        </div>

        {/* Generate / Trigger button */}
        {!draftReply ? (
          <button
            type="button"
            onClick={handleDraftReply}
            disabled={drafting}
            className="w-full py-2 bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {drafting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Drafting corporate reply...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate Brand Reply Draft</span>
              </>
            )}
          </button>
        ) : (
          <div className="space-y-2">
            <textarea
              value={draftReply}
              onChange={(e) => setDraftReply(e.target.value)}
              className="w-full h-24 border border-dashed border-emerald-400 bg-emerald-50/20 p-2 text-xs leading-relaxed text-slate-800 focus:outline-hidden placeholder-slate-400 rounded-none font-medium"
              placeholder="Response draft..."
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={handleDraftReply}
                disabled={drafting}
                className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1 flex items-center gap-1"
                title="Regenerate draft"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Regenerate</span>
              </button>
              <button
                type="button"
                onClick={() => setDraftReply('')}
                className="text-[10px] bg-rose-50 hover:bg-rose-100 text-rose-700 px-2 py-1"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SAVE CONTROLS */}
      <div className="flex gap-2 justify-end border-t border-slate-200 pt-3">
        <button
          type="button"
          onClick={onClose}
          className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-800 px-3 py-1.5"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSaveChanges}
          disabled={saving}
          className="text-xs bg-slate-900 text-white hover:bg-slate-800 px-3 py-1.5 font-semibold flex items-center gap-1 disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{saving ? 'Saving...' : 'Save Audit'}</span>
        </button>
      </div>
    </div>
  );
};
