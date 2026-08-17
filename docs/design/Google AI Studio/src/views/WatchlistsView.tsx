import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ListFilter,
  Plus,
  Edit2,
  Trash2,
  Check,
  Search,
  Tag,
  Hash,
  AtSign,
  Binary,
  Layers,
  AlertTriangle,
} from 'lucide-react';
import { Watchlist, MatchType } from '../types';
import { Slideover } from '../components/Slideover';
import { TagInput } from '../components/TagInput';
import { ConfirmModal } from '../components/ConfirmModal';
import { EmptyState } from '../components/EmptyState';

export const WatchlistsView: React.FC = () => {
  const {
    watchlists,
    connectors,
    createWatchlist,
    updateWatchlist,
    deleteWatchlist,
    toggleWatchlistActive,
    session,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingWatchlist, setEditingWatchlist] = useState<Watchlist | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Watchlist | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formMatchType, setFormMatchType] = useState<MatchType>('Keyword');
  const [formTerms, setFormTerms] = useState<string[]>([]);
  const [formBooleanQuery, setFormBooleanQuery] = useState('');
  const [formPlatforms, setFormPlatforms] = useState<string[]>(['GNews', 'Newswire']);
  const [formIsActive, setFormIsActive] = useState(true);

  const filteredWatchlists = watchlists.filter((w) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      w.name.toLowerCase().includes(q) ||
      w.query.toLowerCase().includes(q) ||
      w.owner.toLowerCase().includes(q)
    );
  });

  const handleOpenCreate = () => {
    setEditingWatchlist(null);
    setFormName('');
    setFormMatchType('Keyword');
    setFormTerms(['Acme Cloud', 'Enterprise AI']);
    setFormBooleanQuery('');
    setFormPlatforms(['GNews', 'Newswire']);
    setFormIsActive(true);
    setIsDrawerOpen(true);
  };

  const handleOpenEdit = (w: Watchlist) => {
    setEditingWatchlist(w);
    setFormName(w.name);
    setFormMatchType(w.matchType);
    setFormTerms(w.terms || []);
    setFormBooleanQuery(w.matchType === 'Boolean' ? w.query : '');
    setFormPlatforms(w.platforms || ['GNews']);
    setFormIsActive(w.isActive);
    setIsDrawerOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const query =
      formMatchType === 'Boolean'
        ? formBooleanQuery
        : formTerms.join(', ');

    if (editingWatchlist) {
      updateWatchlist(editingWatchlist.id, {
        name: formName.trim(),
        matchType: formMatchType,
        query,
        terms: formTerms,
        platforms: formPlatforms,
        isActive: formIsActive,
      });
    } else {
      createWatchlist({
        name: formName.trim(),
        matchType: formMatchType,
        query,
        terms: formTerms,
        platforms: formPlatforms,
        isActive: formIsActive,
        owner: session.name,
      });
    }

    setIsDrawerOpen(false);
  };

  const togglePlatform = (p: string) => {
    if (formPlatforms.includes(p)) {
      setFormPlatforms(formPlatforms.filter((item) => item !== p));
    } else {
      setFormPlatforms([...formPlatforms, p]);
    }
  };

  return (
    <div className="space-y-6" id="watchlists-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Monitoring Watchlists
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure matching rules, boolean query logic, and target ingestion platforms
          </p>
        </div>

        <button
          type="button"
          id="btn-new-watchlist"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>New watchlist</span>
        </button>
      </div>

      {/* Search & Stats bar */}
      <div className="flex items-center justify-between gap-4 bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search watchlists..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md placeholder:text-slate-400 text-slate-900 focus-ring"
          />
        </div>
        <div className="text-xs text-slate-500">
          <span className="font-semibold text-slate-900">{watchlists.length}</span> watchlists (
          <span className="text-emerald-600 font-semibold">{watchlists.filter((w) => w.isActive).length} active</span>)
        </div>
      </div>

      {/* Watchlist Table */}
      {filteredWatchlists.length === 0 ? (
        <EmptyState
          title="No watchlists found"
          description="Create your first monitoring watchlist to start capturing real-time social conversations and news."
          action={{
            label: 'New Watchlist',
            onClick: handleOpenCreate,
            icon: <Plus className="w-4 h-4" />,
          }}
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Watchlist Name</th>
                  <th className="py-3 px-4">Match Type</th>
                  <th className="py-3 px-4">Query / Terms Summary</th>
                  <th className="py-3 px-4">Owner</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredWatchlists.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span>{w.name}</span>
                        {w.matchedPostsCount > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-mono">
                            {w.matchedPostsCount} hits
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-normal mt-0.5">
                        Platforms: {w.platforms.join(', ')}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {w.matchType === 'Keyword' && <Tag className="w-3 h-3 text-blue-500" />}
                        {w.matchType === 'Hashtag' && <Hash className="w-3 h-3 text-purple-500" />}
                        {w.matchType === 'Account' && <AtSign className="w-3 h-3 text-emerald-500" />}
                        {w.matchType === 'Boolean' && <Binary className="w-3 h-3 text-amber-500" />}
                        <span>{w.matchType}</span>
                      </span>
                    </td>

                    <td className="py-3.5 px-4 max-w-xs truncate">
                      {w.matchType === 'Boolean' ? (
                        <code className="text-[11px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-amber-900 block truncate">
                          {w.query}
                        </code>
                      ) : (
                        <span className="text-slate-600 truncate block">
                          {w.query}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                      {w.owner}
                    </td>

                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => toggleWatchlistActive(w.id, !w.isActive)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border transition-all ${
                          w.isActive
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                            : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
                        }`}
                        title={w.isActive ? 'Click to pause watchlist' : 'Click to activate watchlist'}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${w.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        <span>{w.isActive ? 'Active' : 'Inactive'}</span>
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(w)}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors"
                          title="Edit Watchlist"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(w)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          title="Delete Watchlist"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Slideover Drawer */}
      <Slideover
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={editingWatchlist ? 'Edit Watchlist' : 'Create Watchlist'}
        subtitle="Specify brand query terms, match semantics, and connected platform distribution"
        width="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-xs"
            >
              {editingWatchlist ? 'Save Changes' : 'Create Watchlist'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave} className="space-y-5 text-xs">
          {/* Watchlist Name */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Watchlist Name
            </label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Acme Executive Mentions"
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus-ring"
            />
          </div>

          {/* Match Type */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Match Type
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['Keyword', 'Hashtag', 'Account', 'Boolean'] as MatchType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormMatchType(type)}
                  className={`p-2 rounded-md border text-center font-medium transition-all ${
                    formMatchType === type
                      ? 'bg-blue-50 border-blue-500 text-blue-700 font-semibold shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Query Inputs */}
          {formMatchType === 'Boolean' ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-700">
                  Boolean Query Syntax (JetBrains Mono)
                </label>
                <span className="text-[10px] text-slate-500">Supports AND, OR, NOT, (), ""</span>
              </div>
              <textarea
                rows={4}
                required
                value={formBooleanQuery}
                onChange={(e) => setFormBooleanQuery(e.target.value)}
                placeholder='("Acme Global" OR "Acme Cloud") AND (launch OR enterprise) NOT spam'
                className="w-full p-2.5 bg-slate-900 text-emerald-400 font-mono text-xs rounded-md border border-slate-700 focus-ring"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Evaluated against titles and bodies during stream ingestion.
              </p>
            </div>
          ) : (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {formMatchType} List (Enter or comma to add chips)
              </label>
              <TagInput
                values={formTerms}
                onChange={setFormTerms}
                placeholder={
                  formMatchType === 'Hashtag'
                    ? 'e.g. EnterpriseAI...'
                    : formMatchType === 'Account'
                    ? 'e.g. ReutersTech...'
                    : 'e.g. Acme Global...'
                }
                prefix={formMatchType === 'Hashtag' ? '#' : formMatchType === 'Account' ? '@' : ''}
              />
            </div>
          )}

          {/* Connected Platforms */}
          <div>
            <label className="block font-semibold text-slate-700 mb-2">
              Ingestion Platform Sources
            </label>
            <div className="space-y-2">
              {['GNews', 'Newswire', 'Tenant-Owned Feed'].map((platform) => {
                const isSelected = formPlatforms.includes(platform);
                return (
                  <label
                    key={platform}
                    onClick={() => togglePlatform(platform)}
                    className={`flex items-center justify-between p-2.5 rounded-md border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-50/50 border-blue-300 text-blue-900 font-medium'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <span>{platform}</span>
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center border ${
                        isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Active on save */}
          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus-ring"
              />
              <span className="font-semibold text-slate-800">
                Activate immediately on save
              </span>
            </label>
          </div>
        </form>
      </Slideover>

      {/* Delete Confirmation Modal (ADR-0044) */}
      {deleteTarget && (
        <ConfirmModal
          isOpen={!!deleteTarget}
          title={`Delete Watchlist "${deleteTarget.name}"?`}
          body={
            <div className="space-y-2">
              <p>
                Deleting this watchlist permanently removes the match rule from all active ingestion pipelines.
              </p>
              <p className="text-xs text-slate-500 font-medium bg-slate-50 p-2 rounded border border-slate-200">
                <strong>Historical Data Guarantee:</strong> Ingested posts previously matched by this watchlist will be preserved in your database feed.
              </p>
            </div>
          }
          confirmLabel="Delete Watchlist"
          confirmVariant="destructive"
          onConfirm={() => {
            deleteWatchlist(deleteTarget.id);
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};
