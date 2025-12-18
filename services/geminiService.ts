import { GoogleGenAI, Type } from "@google/genai";
import { BatchResult } from "../types";

const genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Switch to 2.5 Flash which is stable and cost-effective
const MODEL_NAME = 'gemini-2.5-flash';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Batch analysis using standard generateContent with strict Schema.
 * Includes retry logic for rate limits (429) or temporary server errors (503).
 */
export const analyzeFilenamesBatch = async (
  items: { i: string; n: string }[]
): Promise<BatchResult[]> => {
  
  const responseSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        i: { type: Type.STRING },
        n: { type: Type.STRING },
        e: { type: Type.STRING },
        c: { type: Type.STRING },
        d: { type: Type.STRING },
      },
      required: ["i", "n", "e", "c", "d"],
    },
  };

  const prompt = `
    Task: Rename icon filenames.
    Input: ${JSON.stringify(items)}
    
    Rules:
    1. i: Keep exact ID.
    2. n: Keep exact original name.
    3. e: English name (Snake_Case, No hyphens).
    4. c: Chinese name (No hyphens, simplify if needed).
    5. d: Domain/Brand (e.g. "google.com", "wechat").
    
    IMPORTANT: Return exactly ${items.length} items.
  `;

  let retries = 3;
  
  while (retries >= 0) {
    try {
        const response = await genAI.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: responseSchema,
            temperature: 0.1,
        }
        });

        let text = response.text;
        if (!text) return [];

        // Cleanup: Sometimes Gemini returns Markdown code blocks despite JSON mime type
        if (text.startsWith('```json')) {
            text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (text.startsWith('```')) {
            text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        const rawData = JSON.parse(text) as any[];

        return rawData.map(item => ({
        id: item.i,
        originalName: item.n,
        english: item.e,
        chinese: item.c,
        domain: item.d
        }));

    } catch (error: any) {
        // If it's a rate limit (429) or service unavailable (503), wait and retry
        const isRateLimit = error.message?.includes('429') || error.status === 429;
        const isServerBusy = error.message?.includes('503') || error.status === 503;
        
        if ((isRateLimit || isServerBusy) && retries > 0) {
            const waitTime = 3000 * (4 - retries); // 3s, 6s, 9s (increased wait time)
            console.warn(`Hit rate limit. Retrying in ${waitTime}ms... (${retries} retries left)`);
            await sleep(waitTime);
            retries--;
            continue;
        }
        
        console.error("Gemini Batch API Error:", error);
        throw error;
    }
  }
  return [];
};