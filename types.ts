export interface ProcessedFile {
  id: string;
  originalFile: File;
  originalName: string;
  newName: string | null;
  status: 'pending' | 'processing' | 'completed' | 'error';
  metadata?: IconMetadata;
}

export interface IconMetadata {
  englishName: string;
  chineseName: string;
  domainOrNote: string;
}

export interface BatchResult {
  id: string; // Added ID for robust matching
  originalName: string;
  english: string;
  chinese: string;
  domain: string;
}

// Declare globals for CDN libraries
declare global {
  interface Window {
    JSZip: any;
    saveAs: any;
  }
}