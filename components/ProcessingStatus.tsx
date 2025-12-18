import React from 'react';

interface ProcessingStatusProps {
  total: number;
  completed: number;
  isProcessing: boolean;
  onCancel: () => void;
  onStart: () => void;
  onRestart: () => void;
  hasFiles: boolean;
}

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({
  total,
  completed,
  isProcessing,
  onCancel,
  onStart,
  onRestart,
  hasFiles
}) => {
  if (!hasFiles) return null;

  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">处理进度</h3>
          <p className="text-slate-500 text-sm">
            已处理 {completed} / {total} 个文件
          </p>
        </div>
        <div className="flex gap-3">
            {!isProcessing && (
                <button
                    onClick={onRestart}
                    className="px-4 py-2 border border-slate-300 text-slate-600 hover:bg-slate-50 hover:text-slate-800 rounded-lg font-medium transition-colors shadow-sm text-sm"
                >
                    清空 / 重新开始
                </button>
            )}
            {!isProcessing && completed < total && (
                <button
                onClick={onStart}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
                >
                {completed > 0 ? '继续处理' : '开始 AI 重命名'}
                </button>
            )}
            {isProcessing && (
                <button
                onClick={onCancel}
                className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium transition-colors"
                title="强制停止当前任务并允许导出"
                >
                中断/停止
                </button>
            )}
        </div>
      </div>

      <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
        <div
          className="bg-blue-500 h-full transition-all duration-300 ease-out flex items-center justify-center"
          style={{ width: `${percentage}%` }}
        >
            {percentage > 5 && <span className="text-[10px] text-white font-bold">{percentage}%</span>}
        </div>
      </div>
    </div>
  );
};