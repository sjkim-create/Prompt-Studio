const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY as string;
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;

export type Provider = 'openai' | 'gemini';

export interface ModelInfo {
  id: string;
  label: string;
  provider: Provider;
  inputPricePer1M: number;
  outputPricePer1M: number;
}

export const ALL_MODELS: ModelInfo[] = [
  // OpenAI — GPT-5.4 (2026-03)
  { id: 'gpt-5.4',       label: 'GPT-5.4',           provider: 'openai',  inputPricePer1M: 2.50,  outputPricePer1M: 15.00 },
  { id: 'gpt-5.4-mini',  label: 'GPT-5.4 Mini',      provider: 'openai',  inputPricePer1M: 0.75,  outputPricePer1M: 4.50 },
  { id: 'gpt-5.4-nano',  label: 'GPT-5.4 Nano',      provider: 'openai',  inputPricePer1M: 0.20,  outputPricePer1M: 1.25 },
  // OpenAI — GPT-5.2
  { id: 'gpt-5.2',       label: 'GPT-5.2',           provider: 'openai',  inputPricePer1M: 1.75,  outputPricePer1M: 14.00 },
  // OpenAI — GPT-4.1
  { id: 'gpt-4.1',       label: 'GPT-4.1',           provider: 'openai',  inputPricePer1M: 2.00,  outputPricePer1M: 8.00 },
  { id: 'gpt-4.1-mini',  label: 'GPT-4.1 Mini',      provider: 'openai',  inputPricePer1M: 0.40,  outputPricePer1M: 1.60 },
  { id: 'gpt-4.1-nano',  label: 'GPT-4.1 Nano',      provider: 'openai',  inputPricePer1M: 0.10,  outputPricePer1M: 0.40 },
  // OpenAI — GPT-4o
  { id: 'gpt-4o',        label: 'GPT-4o',             provider: 'openai',  inputPricePer1M: 2.50,  outputPricePer1M: 10.00 },
  { id: 'gpt-4o-mini',   label: 'GPT-4o Mini',        provider: 'openai',  inputPricePer1M: 0.15,  outputPricePer1M: 0.60 },
  // Gemini — 3.1 (2026-02~03)
  { id: 'gemini-3.1-pro-preview',        label: 'Gemini 3.1 Pro',        provider: 'gemini', inputPricePer1M: 2.00,  outputPricePer1M: 12.00 },
  { id: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite', provider: 'gemini', inputPricePer1M: 0.10,  outputPricePer1M: 0.40 },
  // Gemini — 3.0
  { id: 'gemini-3-flash',  label: 'Gemini 3 Flash',  provider: 'gemini', inputPricePer1M: 0.50,  outputPricePer1M: 3.00 },
  // Gemini — 2.5
  { id: 'gemini-2.5-pro',   label: 'Gemini 2.5 Pro',   provider: 'gemini', inputPricePer1M: 1.25, outputPricePer1M: 10.00 },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'gemini', inputPricePer1M: 0.15, outputPricePer1M: 0.60 },
];

// 하위 호환용
export const OPENAI_MODELS = ALL_MODELS;

export const DEFAULT_MODEL = 'gpt-5.4-mini';

export type PlanType = 'A' | 'B' | 'video';

/** 동영상 입력을 지원하는 Gemini 모델만 필터 */
export const VIDEO_MODELS = ALL_MODELS.filter(m => m.provider === 'gemini');
export const DEFAULT_VIDEO_MODEL = 'gemini-3.1-pro-preview';

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface EvaluateResult {
  content: string;
  usage: TokenUsage;
  model: string;
  costUsd: number;
}

export interface EvaluateParams {
  plan: PlanType;
  model: string;
  imageBlobs?: Blob[];
  videoBlob?: Blob;
  speed?: number;
  pdfPath: string;
  /** 미리 편집된 프롬프트. 없으면 파일에서 로드 */
  customPrompt?: string;
  onProgress?: (msg: string) => void;
  onStream?: (partialContent: string) => void;
}

async function blobToBase64DataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** data URL에서 순수 base64 부분만 추출 */
function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.split(',')[1] ?? '';
}

/** data URL에서 MIME type 추출 */
function dataUrlToMime(dataUrl: string): string {
  const m = dataUrl.match(/^data:([^;]+);/);
  return m?.[1] ?? 'application/octet-stream';
}

async function fetchAsBase64DataUrl(path: string, mimeType: string): Promise<string> {
  const resp = await fetch(path);
  const blob = await resp.blob();
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = btoa(binary);
  return `data:${mimeType};base64,${b64}`;
}

async function fetchText(path: string): Promise<string> {
  const resp = await fetch(path);
  return resp.text();
}

export function calcCost(modelId: string, usage: TokenUsage): number {
  const info = ALL_MODELS.find(m => m.id === modelId);
  if (!info) return 0;
  const inputCost = (usage.promptTokens / 1_000_000) * info.inputPricePer1M;
  const outputCost = (usage.completionTokens / 1_000_000) * info.outputPricePer1M;
  return inputCost + outputCost;
}

const EVAL_INSTRUCTION = '위의 프롬프트 지침에 따라, 첨부된 학생 필기 이미지와 문제 정보 PDF를 분석하여 채점 결과를 출력하세요. 템플릿 변수는 다음과 같이 설정합니다: MAX_SCORE=10, EVALUATION_MODE=Automatic, SCALE_TYPE=5-Step. 출력은 반드시 한국어로 작성하세요.';

// ─── OpenAI ───

function buildOpenAIContent(
  plan: PlanType,
  systemPrompt: string,
  imageDataUrls: string[],
  pdfDataUrl: string,
): Array<Record<string, unknown>> {
  const content: Array<Record<string, unknown>> = [];
  content.push({ type: 'text', text: systemPrompt });

  for (let i = 0; i < imageDataUrls.length; i++) {
    const label = plan === 'A'
      ? '메타데이터 이미지 (획 순서 + 딜레이)'
      : i === 0 ? '이미지 1: 원본 필기 (검은색)' : '이미지 2: 메타데이터 (획 순서 + 딜레이)';
    content.push({ type: 'text', text: `[${label}]` });
    content.push({ type: 'image_url', image_url: { url: imageDataUrls[i], detail: 'high' } });
  }

  content.push({ type: 'text', text: '[문제 정보 + 채점 기준 PDF]' });
  content.push({ type: 'file', file: { filename: '문제 정보 + 채점 기준.pdf', file_data: pdfDataUrl } });
  content.push({ type: 'text', text: EVAL_INSTRUCTION });
  return content;
}

async function callOpenAI(
  model: string,
  content: Array<Record<string, unknown>>,
  onProgress?: (msg: string) => void,
  onStream?: (partialContent: string) => void,
): Promise<EvaluateResult> {
  const body = {
    model,
    stream: true,
    stream_options: { include_usage: true },
    messages: [{ role: 'user' as const, content }],
  };

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`OpenAI API 오류 (${resp.status}): ${errBody}`);
  }

  onProgress?.('스트리밍 수신 중...');
  return parseSSEStream(resp, model, onStream);
}

async function parseSSEStream(
  resp: Response,
  model: string,
  onStream?: (partialContent: string) => void,
): Promise<EvaluateResult> {
  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const payload = trimmed.slice(6);
      if (payload === '[DONE]') continue;

      try {
        const parsed = JSON.parse(payload);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          fullContent += delta;
          onStream?.(fullContent);
        }
        if (parsed.usage) {
          usage = {
            promptTokens: parsed.usage.prompt_tokens ?? 0,
            completionTokens: parsed.usage.completion_tokens ?? 0,
            totalTokens: parsed.usage.total_tokens ?? 0,
          };
        }
      } catch { /* skip */ }
    }
  }

  if (!fullContent) throw new Error('API 응답에서 결과를 찾을 수 없습니다.');

  return { content: fullContent, usage, model, costUsd: calcCost(model, usage) };
}

// ─── Gemini ───

function buildGeminiParts(
  plan: PlanType,
  systemPrompt: string,
  imageDataUrls: string[],
  pdfDataUrl: string,
): Array<Record<string, unknown>> {
  const parts: Array<Record<string, unknown>> = [];

  parts.push({ text: systemPrompt });

  for (let i = 0; i < imageDataUrls.length; i++) {
    const label = plan === 'A'
      ? '메타데이터 이미지 (획 순서 + 딜레이)'
      : i === 0 ? '이미지 1: 원본 필기 (검은색)' : '이미지 2: 메타데이터 (획 순서 + 딜레이)';
    parts.push({ text: `[${label}]` });
    parts.push({
      inline_data: {
        mime_type: dataUrlToMime(imageDataUrls[i]),
        data: dataUrlToBase64(imageDataUrls[i]),
      },
    });
  }

  parts.push({ text: '[문제 정보 + 채점 기준 PDF]' });
  parts.push({
    inline_data: {
      mime_type: 'application/pdf',
      data: dataUrlToBase64(pdfDataUrl),
    },
  });

  parts.push({ text: EVAL_INSTRUCTION });
  return parts;
}

async function callGemini(
  model: string,
  parts: Array<Record<string, unknown>>,
  onProgress?: (msg: string) => void,
  onStream?: (partialContent: string) => void,
): Promise<EvaluateResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;

  const body = {
    contents: [{ role: 'user', parts }],
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`Gemini API 오류 (${resp.status}): ${errBody}`);
  }

  onProgress?.('스트리밍 수신 중...');

  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const payload = trimmed.slice(6);

      try {
        const parsed = JSON.parse(payload);
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          fullContent += text;
          onStream?.(fullContent);
        }
        if (parsed.usageMetadata) {
          usage = {
            promptTokens: parsed.usageMetadata.promptTokenCount ?? 0,
            completionTokens: parsed.usageMetadata.candidatesTokenCount ?? 0,
            totalTokens: parsed.usageMetadata.totalTokenCount ?? 0,
          };
        }
      } catch { /* skip */ }
    }
  }

  if (!fullContent) throw new Error('Gemini 응답에서 결과를 찾을 수 없습니다.');

  return { content: fullContent, usage, model, costUsd: calcCost(model, usage) };
}

// ─── Gemini 동영상 parts 빌더 ───

function buildGeminiVideoParts(
  systemPrompt: string,
  videoBase64: string,
  pdfDataUrl: string,
): Array<Record<string, unknown>> {
  const parts: Array<Record<string, unknown>> = [];
  parts.push({ text: systemPrompt });
  parts.push({ text: '[학생 필기 동영상]' });
  parts.push({
    inline_data: {
      mime_type: 'video/webm',
      data: videoBase64,
    },
  });
  parts.push({ text: '[문제 정보 + 채점 기준 PDF]' });
  parts.push({
    inline_data: {
      mime_type: 'application/pdf',
      data: dataUrlToBase64(pdfDataUrl),
    },
  });
  parts.push({ text: EVAL_INSTRUCTION });
  return parts;
}

// ─── 프롬프트 로딩 유틸 (외부에서도 사용) ───

export async function loadPromptText(plan: PlanType, speed?: number): Promise<string> {
  if (plan === 'video') {
    const [promptText, strokeText] = await Promise.all([
      fetchText('data/prompt/movie_prompt.md'),
      fetchText('data/prompt/movie_stroke_prompt.md'),
    ]);
    const speedNote = speed && speed > 1
      ? `\n\n**⚠️ 이 동영상은 ${speed}배속으로 재생됩니다. 실제 멈춤 시간과 필기 시간은 동영상 시간에 ${speed}를 곱해서 계산하세요.**`
      : '';
    return `${promptText}\n\n${strokeText}${speedNote}`;
  }
  const promptPath = plan === 'A' ? 'data/prompt/a_prompt.md' : 'data/prompt/b_prompt.md';
  const [promptText, strokeText] = await Promise.all([
    fetchText(promptPath),
    fetchText('data/prompt/stroke_prompt.md'),
  ]);
  return `${promptText}\n\n${strokeText}`;
}

// ─── 통합 진입점 ───

export async function evaluateWithOpenAI({
  plan,
  model,
  imageBlobs,
  videoBlob,
  speed,
  pdfPath,
  customPrompt,
  onProgress,
  onStream,
}: EvaluateParams): Promise<EvaluateResult> {
  const modelInfo = ALL_MODELS.find(m => m.id === model);
  const provider = modelInfo?.provider ?? 'openai';
  const modelLabel = modelInfo?.label ?? model;

  if (provider === 'openai' && !OPENAI_API_KEY) {
    throw new Error('OpenAI API 키가 설정되지 않았습니다.');
  }
  if (provider === 'gemini' && !GEMINI_API_KEY) {
    throw new Error('Gemini API 키가 설정되지 않았습니다.');
  }

  onProgress?.('프롬프트 로딩 중...');

  const systemPrompt = customPrompt ?? await loadPromptText(plan, speed);

  // 동영상 평가
  if (plan === 'video' && videoBlob) {
    onProgress?.('동영상 변환 중...');
    const videoDataUrl = await blobToBase64DataUrl(videoBlob);
    const videoBase64 = dataUrlToBase64(videoDataUrl);

    onProgress?.('PDF 로딩 중...');
    const pdfDataUrl = await fetchAsBase64DataUrl(pdfPath, 'application/pdf');

    onProgress?.(`${modelLabel} 평가 요청 중...`);
    const parts = buildGeminiVideoParts(systemPrompt, videoBase64, pdfDataUrl);
    return callGemini(model, parts, onProgress, onStream);
  }

  // 이미지 평가 (A안 / B안)
  onProgress?.('이미지 변환 중...');
  const imageDataUrls = await Promise.all((imageBlobs ?? []).map(blob => blobToBase64DataUrl(blob)));

  onProgress?.('PDF 로딩 중...');
  const pdfDataUrl = await fetchAsBase64DataUrl(pdfPath, 'application/pdf');

  onProgress?.(`${modelLabel} 평가 요청 중...`);

  if (provider === 'gemini') {
    const parts = buildGeminiParts(plan, systemPrompt, imageDataUrls, pdfDataUrl);
    return callGemini(model, parts, onProgress, onStream);
  } else {
    const content = buildOpenAIContent(plan, systemPrompt, imageDataUrls, pdfDataUrl);
    return callOpenAI(model, content, onProgress, onStream);
  }
}
