import React, { useMemo, useState } from 'react';
import { ProcessedFile } from '../types';

interface ResultsTableProps {
  files: ProcessedFile[];
  onDownload: () => void;
  onDelete: (id: string) => void;
}

const filterLabels: Record<string, string> = {
  all: '全部',
  pending: '待处理',
  completed: '已完成',
  error: '失败'
};

export const ResultsTable: React.FC<ResultsTableProps> = ({ files, onDownload, onDelete }) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'error'>('all');

  const filteredFiles = useMemo(() => {
    if (filter === 'all') return files;
    return files.filter(f => f.status === filter);
  }, [files, filter]);

  const stats = useMemo(() => {
    return {
      all: files.length,
      pending: files.filter(f => f.status === 'pending').length,
      completed: files.filter(f => f.status === 'completed').length,
      error: files.filter(f => f.status === 'error').length
    };
  }, [files]);

  if (files.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px]">
      <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50">
        <div className="flex gap-2 text-sm">
          {(['all', 'completed', 'pending', 'error'] as const).map((type) => (
             <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-3 py-1.5 rounded-full capitalize transition-colors ${
                  filter === type
                    ? 'bg-slate-800 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
             >
                {filterLabels[type]} <span className="opacity-60 ml-1">({stats[type]})</span>
             </button>
          ))}
        </div>
        
        <button
          onClick={onDownload}
          disabled={stats.completed === 0}
          className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg font-bold shadow-sm transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          下载 {stats.completed} 个已完成文件
        </button>
      </div>

      <div className="overflow-auto flex-1">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 sticky top-0 z-10 text-slate-500 font-medium">
            <tr>
              <th className="p-4 w-16">#</th>
              <th className="p-4">原始文件名</th>
              <th className="p-4 text-center">状态</th>
              <th className="p-4">新文件名 (英文--中文--域名)</th>
              <th className="p-4 w-16">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredFiles.map((file, index) => (
              <tr key={file.id} className="hover:bg-slate-50 group">
                <td className="p-4 text-slate-400 font-mono text-xs">{index + 1}</td>
                <td className="p-4 text-slate-700 truncate max-w-[200px]" title={file.originalName}>
                  {file.originalName}
                </td>
                <td className="p-4 text-center">
                   {file.status === 'completed' && <span className="inline-block w-2 h-2 rounded-full bg-green-500" title="已完成"></span>}
                   {file.status === 'pending' && <span className="inline-block w-2 h-2 rounded-full bg-slate-300" title="待处理"></span>}
                   {file.status === 'processing' && <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse" title="处理中"></span>}
                   {file.status === 'error' && <span className="inline-block w-2 h-2 rounded-full bg-red-500" title="失败"></span>}
                </td>
                <td className="p-4 font-mono text-slate-800">
                  {file.newName ? (
                    <span className="text-blue-700">{file.newName}</span>
                  ) : (
                    <span className="text-slate-300 italic">等待 AI 处理...</span>
                  )}
                </td>
                <td className="p-4 text-center">
                  <button 
                    onClick={() => onDelete(file.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="删除文件"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
            {filteredFiles.length === 0 && (
                <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                        未找到符合条件的文件。
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};