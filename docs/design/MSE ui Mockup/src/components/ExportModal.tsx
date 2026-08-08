import React, { useState } from 'react';
import { X, Download, Copy, Check } from 'lucide-react';
import { SourceItem, PostItem } from '../types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sources: SourceItem[];
  posts: PostItem[];
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  sources,
  posts,
}) => {
  const [copied, setCopied] = useState(false);
  const [format, setFormat] = useState<'csv' | 'json' | 'pdf'>('csv');

  if (!isOpen) return null;

  const handleCopy = () => {
    const dataStr = JSON.stringify(posts, null, 2);
    navigator.clipboard.writeText(dataStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    let content = '';
    let fileName = `social_engage_export.${format}`;
    let mimeType = 'text/plain';

    if (format === 'json') {
      content = JSON.stringify({ sources, posts }, null, 2);
      mimeType = 'application/json';
    } else if (format === 'csv') {
      mimeType = 'text/csv';
      const headers = 'Author,Handle,Source,Sentiment,Shares,Likes,Text\n';
      const rows = posts
        .map(
          (p) =>
            `"${p.author}","${p.handle}","${p.source}","${p.sentiment}",${p.shares},${p.likes},"${p.text.replace(/"/g, '""')}"`
        )
        .join('\n');
      content = headers + rows;
    } else {
      content = `SOCIALENGAGE ANALYTICS REPORT\nTotal Posts: ${posts.length}\nDate: ${new Date().toLocaleDateString()}\n\nSources:\n` +
        sources.map((s) => `${s.name}: ${s.count} posts`).join('\n');
      fileName = 'social_engage_report.txt';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-5 shadow-2xl animate-in zoom-in-95 text-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="font-semibold text-base">Export Analytics Data</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <label className="block font-semibold text-slate-700">Select Export Format</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'csv', label: 'CSV File' },
              { id: 'json', label: 'JSON Data' },
              { id: 'pdf', label: 'Summary Doc' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFormat(f.id as any)}
                className={`p-3 rounded-xl border text-center font-medium transition-colors ${
                  format === f.id
                    ? 'border-blue-500 bg-blue-50 text-blue-800 font-semibold'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-500 space-y-1">
            <div className="font-semibold text-slate-700">Payload summary:</div>
            <div>• {posts.length} matching posts</div>
            <div>• {sources.length} active channel sources</div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={handleCopy}
            className="flex-1 border border-slate-300 rounded-xl py-2.5 text-xs font-semibold hover:bg-slate-50 flex items-center justify-center gap-1.5 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" /> Copied
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-500" /> Copy JSON
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-xs font-semibold hover:bg-blue-700 flex items-center justify-center gap-1.5 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" /> Download File
          </button>
        </div>
      </div>
    </div>
  );
};
