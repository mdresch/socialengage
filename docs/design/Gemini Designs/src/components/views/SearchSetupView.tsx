import React, { useState } from 'react';
import { Plus, X, Search, Check } from 'lucide-react';
import { TopicItem, RuleItem } from '../../types';
import { TOPICS, INITIAL_RULES } from '../../data/mockData';

export const SearchSetupView: React.FC = () => {
  const [topics, setTopics] = useState<TopicItem[]>(TOPICS);
  const [selectedTopicName, setSelectedTopicName] = useState<string>('SocialEngage · AI · ADPA');
  const [rules, setRules] = useState<RuleItem[]>(INITIAL_RULES);
  const [addRuleOpen, setAddRuleOpen] = useState(false);
  const [ruleType, setRuleType] = useState<'Keyword' | 'Hashtag' | 'Account' | 'Boolean'>('Keyword');
  const [ruleKeywords, setRuleKeywords] = useState('');
  const [newTopicInput, setNewTopicInput] = useState('');
  const [addingTopic, setAddingTopic] = useState(false);

  const ruleBadgeStyle = {
    Keyword: 'bg-blue-50 text-blue-700',
    Hashtag: 'bg-purple-50 text-purple-700',
    Account: 'bg-emerald-50 text-emerald-700',
    Boolean: 'bg-amber-50 text-amber-700',
  };

  const handleSaveRule = () => {
    if (!ruleKeywords.trim()) return;
    setRules((prev) => [
      ...prev,
      {
        type: ruleType,
        text: ruleKeywords.trim(),
        scope: 'All sources',
      },
    ]);
    setRuleKeywords('');
    setAddRuleOpen(false);
  };

  const handleCreateTopic = () => {
    if (!newTopicInput.trim()) return;
    const newTopic: TopicItem = {
      name: newTopicInput.trim(),
      rules: 1,
      volume: '120',
    };
    setTopics((prev) => [...prev, newTopic]);
    setSelectedTopicName(newTopic.name);
    setNewTopicInput('');
    setAddingTopic(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Topics List Sidebar */}
      <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm self-start">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-800">Search Topics</span>
          <button
            onClick={() => setAddingTopic(true)}
            className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-0.5"
          >
            <Plus className="w-3.5 h-3.5" /> New
          </button>
        </div>

        {addingTopic && (
          <div className="p-3 bg-blue-50/50 border-b border-blue-100 space-y-2">
            <input
              type="text"
              value={newTopicInput}
              onChange={(e) => setNewTopicInput(e.target.value)}
              placeholder="Topic Name (e.g., Campaign 2026)"
              className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:border-blue-500 bg-white"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setAddingTopic(false)}
                className="text-xs text-slate-500 px-2.5 py-1 rounded hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTopic}
                className="text-xs bg-blue-600 text-white font-semibold px-3 py-1 rounded-md"
              >
                Create
              </button>
            </div>
          </div>
        )}

        <div className="divide-y divide-slate-100">
          {topics.map((t) => {
            const isSelected = selectedTopicName === t.name;
            return (
              <div
                key={t.name}
                onClick={() => setSelectedTopicName(t.name)}
                className={`p-3.5 cursor-pointer transition-colors ${
                  isSelected ? 'bg-blue-50/80 border-l-4 border-blue-600' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs ${
                      isSelected ? 'font-semibold text-blue-900' : 'font-medium text-slate-800'
                    }`}
                  >
                    {t.name}
                  </span>
                  <span className="text-[11px] text-slate-400">{t.rules} rules</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">{t.volume} posts/mo</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Rules Management Panel */}
      <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{selectedTopicName}</h2>
            <p className="text-xs text-slate-400">
              Rules define which social posts are matched into this topic
            </p>
          </div>

          <button
            onClick={() => setAddRuleOpen(!addRuleOpen)}
            className="border border-blue-600 text-blue-700 bg-white hover:bg-blue-50 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add rule
          </button>
        </div>

        {/* Add Rule Drawer Form */}
        {addRuleOpen && (
          <div className="border border-blue-200 bg-blue-50/50 rounded-xl p-5 space-y-3 animate-in fade-in">
            <div className="text-xs font-semibold text-slate-800">New Rule</div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center text-xs">
              <span className="md:col-span-3 text-slate-500 font-medium">Rule type</span>
              <div className="md:col-span-9 flex gap-2 flex-wrap">
                {(['Keyword', 'Hashtag', 'Account', 'Boolean'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setRuleType(type)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      ruleType === type
                        ? 'bg-blue-100 border-blue-300 text-blue-800 font-semibold'
                        : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              <span className="md:col-span-3 text-slate-500 font-medium">Keywords</span>
              <input
                type="text"
                value={ruleKeywords}
                onChange={(e) => setRuleKeywords(e.target.value)}
                placeholder="e.g., SocialEngage, ADPA, adaptive analytics"
                className="md:col-span-9 border border-slate-300 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500 bg-white text-slate-800"
              />

              <span className="md:col-span-3 text-slate-500 font-medium">Sources</span>
              <span className="md:col-span-9 text-slate-600">All sources · English, Dutch</span>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSaveRule}
                className="bg-blue-600 text-white rounded-lg px-4 py-2 text-xs font-semibold hover:bg-blue-700 transition-colors"
              >
                Save rule
              </button>
              <button
                onClick={() => setAddRuleOpen(false)}
                className="border border-slate-300 bg-white rounded-lg px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Rules Table / List */}
        <div className="divide-y divide-slate-100">
          {rules.map((rule, idx) => (
            <div key={idx} className="py-3 flex items-center gap-3 text-xs">
              <span
                className={`px-2.5 py-0.5 rounded-full font-semibold text-[10px] ${ruleBadgeStyle[rule.type]}`}
              >
                {rule.type}
              </span>
              <span className="flex-1 font-medium text-slate-800">{rule.text}</span>
              <span className="text-slate-400 text-[11px]">{rule.scope}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
