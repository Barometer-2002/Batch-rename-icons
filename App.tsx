import React, { useState, useRef, useEffect } from 'react';
import { FileUpload } from './components/FileUpload';
import { ProcessingStatus } from './components/ProcessingStatus';
import { ResultsTable } from './components/ResultsTable';
import { ProcessedFile } from './types';
import { analyzeFilenamesBatch } from './services/geminiService';

// Optimization: 
// Increased to 50 to reduce total number of HTTP requests. 
// Gemini Flash has a huge context window, processing 50 lines is easy for it.
// Fewer requests = less chance of hitting Rate Limit (RPM).
const CHUNK_SIZE = 50;

const App: React.FC = () => {
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchTick, setBatchTick] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string>("");
  
  const isRequestInFlight = useRef(false);
  const filesRef = useRef<ProcessedFile[]>([]);
  
  useEffect(() => { filesRef.current = files; }, [files]);

  const handleFilesSelected = (newFiles: File[]) => {
    const processedNewFiles: ProcessedFile[] = newFiles.map((file) => ({
      id: Math.random().toString(36).substring(2) + Date.now().toString(36),
      originalFile: file,
      originalName: file.name,
      newName: null,
      status: 'pending',
    }));
    setFiles((prev) => [...prev, ...processedNewFiles]);
  };

  const handleDeleteFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const sanitizePart = (str: string | undefined, allowDots: boolean = false): string => {
    if (!str) return 'Unknown';
    const regex = allowDots 
        ? /[^a-zA-Z0-9\u4e00-\u9fa5.]/g 
        : /[^a-zA-Z0-9\u4e00-\u9fa5]/g;
    let safe = str.replace(regex, '_');
    safe = safe.replace(/_+/g, '_');
    safe = safe.replace(/^_|_$/g, '');
    if (allowDots) safe = safe.replace(/^\.+|\.+$/g, '');
    return safe || 'Unknown';
  };

  useEffect(() => {
    if (!isProcessing) return;
    if (isRequestInFlight.current) return;

    const pendingFiles = files.filter((f) => f.status === 'pending');
    
    if (pendingFiles.length === 0) {
      // Check for stuck files (zombies)
      const hasStuckFiles = files.some(f => f.status === 'processing');
      if (hasStuckFiles) {
           setFiles(prev => prev.map(f => f.status === 'processing' ? { ...f, status: 'error' } : f));
      } else {
           setIsProcessing(false);
           setStatusMessage("");
      }
      return;
    }

    const processNextBatch = async () => {
        isRequestInFlight.current = true;
        
        const chunk = pendingFiles.slice(0, CHUNK_SIZE);
        const chunkIds = new Set(chunk.map((f) => f.id));
        
        // Prepare strict minimal payload
        const chunkData = chunk.map((f) => {
            const lastDotIndex = f.originalName.lastIndexOf('.');
            const nameWithoutExt = lastDotIndex !== -1 ? f.originalName.substring(0, lastDotIndex) : f.originalName;
            const ext = lastDotIndex !== -1 ? f.originalName.substring(lastDotIndex + 1) : '';
            return { id: f.id, nameWithoutExt, ext, originalName: f.originalName };
        });

        const itemsToSend = chunkData.map(d => ({
            i: d.id,
            n: d.nameWithoutExt
        }));

        // Set status to processing
        setFiles((prev) =>
            prev.map((f) => {
                if (chunkIds.has(f.id)) return { ...f, status: 'processing' };
                if (f.status === 'processing') return { ...f, status: 'error' }; 
                return f;
            })
        );
        setStatusMessage(`正在 AI 处理第 ${files.length - pendingFiles.length + 1} - ${Math.min(files.length - pendingFiles.length + CHUNK_SIZE, files.length)} 个文件...`);

        // Get used names for local deduplication
        const usedNames = new Set<string>();
        filesRef.current.forEach(f => {
             if (f.newName && f.status === 'completed') {
                 usedNames.add(f.newName.toLowerCase());
             }
        });

        try {
            const results = await analyzeFilenamesBatch(itemsToSend);
            
            setFiles((prev) => {
                return prev.map((file) => {
                    if (!chunkIds.has(file.id)) return file;

                    const res = results.find(r => r.id === file.id);
                    if (!res) {
                        return { ...file, status: 'error' };
                    }

                    const pData = chunkData.find(d => d.id === file.id);
                    const originalExt = pData?.ext ? `.${pData.ext}` : '';

                    const safeEng = sanitizePart(res.english, false);
                    const safeChn = sanitizePart(res.chinese, false);
                    const safeDom = sanitizePart(res.domain, true);
                    
                    const baseFinalName = `${safeEng}--${safeChn}--${safeDom}${originalExt}`;

                    let uniqueName = baseFinalName;
                    let counter = 1;
                    while (usedNames.has(uniqueName.toLowerCase())) {
                        const dotIndex = baseFinalName.lastIndexOf('.');
                        if (dotIndex !== -1) {
                            uniqueName = `${baseFinalName.substring(0, dotIndex)}_${counter}${baseFinalName.substring(dotIndex)}`;
                        } else {
                            uniqueName = `${baseFinalName}_${counter}`;
                        }
                        counter++;
                    }
                    usedNames.add(uniqueName.toLowerCase());

                    return {
                        ...file,
                        status: 'completed',
                        newName: uniqueName,
                        metadata: {
                            englishName: safeEng,
                            chineseName: safeChn,
                            domainOrNote: safeDom
                        }
                    };
                });
            });

        } catch (error) {
            console.error('Batch processing failed:', error);
            setFiles((prev) =>
                prev.map((f) => (chunkIds.has(f.id) ? { ...f, status: 'error' } : f))
            );
        } finally {
            setStatusMessage("API 冷却中，准备下一批...");
            // Increased delay to 2000ms. 
            // 50 items take ~5-8s to process. + 2s delay = ~10s per cycle.
            // This is ~6 requests per minute, which is VERY safe for rate limits.
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            isRequestInFlight.current = false;
            setBatchTick(t => t + 1);
        }
    };

    processNextBatch();

  }, [files, isProcessing, batchTick]);

  const handleStartProcessing = () => {
    setIsProcessing(true);
  };

  const handleStopProcessing = () => {
    setIsProcessing(false);
    setStatusMessage("");
    setFiles(prev => prev.map(f => {
        if (f.status === 'processing') return { ...f, status: 'pending' };
        return f;
    }));
    isRequestInFlight.current = false;
  };
  
  const handleRestart = () => {
    if (window.confirm("确定要清空所有文件并重新开始吗？")) {
        setIsProcessing(false);
        setStatusMessage("");
        setFiles([]);
        isRequestInFlight.current = false;
    }
  };

  const handleDownload = async () => {
    if (!window.JSZip) {
      alert("JSZip 库未加载");
      return;
    }

    const zip = new window.JSZip();
    const completedFiles = files.filter(f => f.status === 'completed' && f.newName);
    
    if (completedFiles.length === 0) {
        alert("没有已完成的文件可下载");
        return;
    }

    const folder = zip.folder("renamed_icons");
    completedFiles.forEach(file => {
       if (file.newName && folder) {
           folder.file(file.newName, file.originalFile);
       }
    });

    const content = await zip.generateAsync({ type: "blob" });
    window.saveAs(content, "organized_icons.zip");
  };

  const completedCount = files.filter(f => f.status === 'completed' || f.status === 'error').length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="bg-amber-500 w-10 h-10 rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/30">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
             </div>
             <div>
                <h1 className="text-xl font-bold text-slate-800 tracking-tight">IconOrganizer AI</h1>
                <p className="text-xs text-slate-500 font-medium">Flash 稳定版</p>
             </div>
          </div>
          <div className="flex items-center gap-4">
            {statusMessage && <span className="text-xs text-blue-600 font-mono animate-pulse">{statusMessage}</span>}
            <span className="text-sm text-slate-500 hidden sm:inline-block">Gemini 2.5 Flash</span>
            <div className={`w-3 h-3 rounded-full ${process.env.API_KEY ? 'bg-green-500' : 'bg-red-500'}`} title={process.env.API_KEY ? 'API Key 已激活' : '缺少 API Key'}></div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {files.length === 0 && (
            <div className="mb-8 max-w-2xl mx-auto text-center">
                <h2 className="text-3xl font-bold text-slate-800 mb-4">极速图标整理工具</h2>
                <p className="text-slate-600 mb-8 leading-relaxed">
                    上传您的 2000+ 图标。我们使用 <strong>Gemini 2.5 Flash</strong> 批量处理，智能防频控。
                </p>
                <FileUpload onFilesSelected={handleFilesSelected} disabled={isProcessing} />
            </div>
        )}

        {files.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    <ProcessingStatus 
                        total={files.length}
                        completed={completedCount}
                        isProcessing={isProcessing}
                        onStart={handleStartProcessing}
                        onCancel={handleStopProcessing}
                        onRestart={handleRestart}
                        hasFiles={files.length > 0}
                    />
                    
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="font-semibold text-slate-800 mb-4">添加更多文件</h3>
                        <FileUpload onFilesSelected={handleFilesSelected} disabled={isProcessing} />
                    </div>
                </div>

                <div className="lg:col-span-3">
                    <ResultsTable files={files} onDownload={handleDownload} onDelete={handleDeleteFile} />
                </div>
            </div>
        )}

      </main>
    </div>
  );
};

export default App;