// Gemini provider — the only module that touches @google/genai.
// SDK init, API-key handling, response parsing, and error handling live here.

import { loadEnvFile } from 'node:process';
import { GoogleGenAI, Modality } from '@google/genai';
import type { GeminiPart } from '../../shared/generation-parts.js';
import type { ImageModelProvider } from '../provider-registry.js';

if (!process.env.K_SERVICE) {
    try {
        loadEnvFile();
    } catch {
        // .env file not found — rely on environment variables already set
    }
}

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
    throw new Error('API_KEY environment variable is not set.');
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export const geminiProvider: ImageModelProvider = {
    id: 'gemini',

    supports: (modelId: string) => modelId.startsWith('gemini-'),

    generateImage: async (parts: GeminiPart[], modelId: string) => {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: { parts },
            config: { responseModalities: [Modality.IMAGE] },
        });

        const firstPart = response.candidates?.[0]?.content?.parts?.[0];

        if (firstPart?.inlineData?.data) {
            return { image: firstPart.inlineData.data, modelId };
        }

        const finishReason = response.candidates?.[0]?.finishReason;
        throw new Error(
            `No image returned by Gemini.${finishReason ? ` Finish reason: ${finishReason}` : ' Response may have been blocked.'}`,
        );
    },

    generateText: async (parts: GeminiPart[], modelId: string) => {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: { parts },
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error(`No text returned by Gemini model ${modelId}.`);
        return { text, modelId };
    },
};
