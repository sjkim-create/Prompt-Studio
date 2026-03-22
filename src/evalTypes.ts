import type { TokenUsage, PlanType, ModelInfo } from './export/evaluateWithOpenAI';

/** 각 탭이 App에 등록하는 평가 컨텍스트 */
export interface EvalContext {
  source: string;              // "A안 이미지" | "B안 이미지" | "동영상 1x" | "동영상 2x"
  plan: PlanType;              // 'A' | 'B' | 'video'
  imageBlobs?: Blob[];
  videoBlob?: Blob;
  speed?: number;
  pdfPath: string;
  availableModels: ModelInfo[];
  canEvaluate: boolean;
}

/** DB에 저장되는 히스토리 엔트리 */
export interface EvalHistoryEntry {
  id: string;
  source: string;
  modelId: string;
  modelLabel: string;
  timestamp: number;           // Date.now()
  content: string;
  usage: TokenUsage | null;
  costUsd: number | null;
  promptText: string;
  fileName: string;
}

/** 프롬프트 사이드바의 첨부 파일 정보 */
export interface AttachedFileInfo {
  label: string;
  type: 'image' | 'video' | 'pdf';
  size?: number;
}
