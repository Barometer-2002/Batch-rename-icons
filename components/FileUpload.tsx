import React, { useCallback } from 'react';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  disabled: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFilesSelected, disabled }) => {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (disabled) return;
      const droppedFiles = Array.from(e.dataTransfer.files).filter((f: File) => f.type === 'image/png');
      if (droppedFiles.length > 0) {
        onFilesSelected(droppedFiles);
      }
    },
    [onFilesSelected, disabled]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled || !e.target.files) return;
      const selectedFiles = Array.from(e.target.files).filter((f: File) => f.type === 'image/png');
      if (selectedFiles.length > 0) {
        onFilesSelected(selectedFiles);
      }
    },
    [onFilesSelected, disabled]
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
        disabled
          ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-60'
          : 'border-blue-300 bg-blue-50 hover:bg-blue-100 hover:border-blue-400 cursor-pointer'
      }`}
    >
      <input
        type="file"
        multiple
        accept="image/png"
        className="hidden"
        id="file-upload"
        onChange={handleChange}
        disabled={disabled}
      />
      <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-lg font-medium text-slate-700">
          拖入 PNG 文件或点击上传
        </p>
        <p className="text-sm text-slate-500 mt-2">
          支持批量上传 (如 2000+ 文件)
        </p>
      </label>
    </div>
  );
};