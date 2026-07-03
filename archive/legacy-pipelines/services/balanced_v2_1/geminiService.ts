import { loadEnvFile } from 'node:process';
import { GoogleGenAI, Modality } from "@google/genai";
import type { MultipartFile } from '@fastify/multipart';
import { GenerateVisualizationParams } from '../../../shared/types/index.js';
import { buildVisualizationPrompt, buildInfluencePrompt, buildFurniturePrompt } from '../../../prompts/balanced_v2_1/visualization.prompt.js';

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

const bufferToGenerativePart = (file: MultipartFile & { buffer: Buffer }) => ({
    inlineData: { data: file.buffer.toString('base64'), mimeType: file.mimetype },
});

export const generateVisualization = async (
    params: GenerateVisualizationParams,
): Promise<{ image: string; debug: any }> => {
    const {
        roomImage,
        roomType,
        stylePreset,
        moodBoardImages,
        furnitureImage,
        textPrompt,
        styleInfluence,
        isRefinement,
        previousResultImage,
    } = params;

    const model = 'gemini-2.5-flash-image';

    const influencePrompt = buildInfluencePrompt(moodBoardImages.length, styleInfluence, stylePreset.name);
    const furniturePrompt = buildFurniturePrompt(!!furnitureImage, roomType);

    const { structuralPart, stylePart } = buildVisualizationPrompt({
        roomType,
        stylePresetName: stylePreset.name,
        stylePreset,
        influencePrompt,
        textPrompt,
        furniturePrompt,
        isRefinement: Boolean(isRefinement),
    });

    // Request structure: original → structural anchor → style → moodboard → furniture → original (re-anchor)
    const parts: Array<{ inlineData: { data: string; mimeType: string } } | { text: string }> = [
        bufferToGenerativePart(roomImage),
        { text: structuralPart },
        { text: stylePart },
        ...moodBoardImages.map(bufferToGenerativePart),
    ];

    if (furnitureImage) {
        parts.push(bufferToGenerativePart(furnitureImage));
    }

    if (isRefinement && previousResultImage) {
        parts.push(bufferToGenerativePart(previousResultImage));
    }

    // Final structural anchor — structural sandwich preserved from balanced_v2
    parts.push(bufferToGenerativePart(roomImage));

    const response = await ai.models.generateContent({
        model,
        contents: { parts },
        config: { responseModalities: [Modality.IMAGE] },
    });

    const firstPart = response.candidates?.[0]?.content?.parts?.[0];

    if (firstPart?.inlineData?.data) {
        return {
            image: firstPart.inlineData.data,
            debug: {
                pipelineMode: 'balanced_v2_1',
                structuralPart,
                stylePart,
                styleObject: stylePreset,
                structuralProtocol: stylePreset.pipeline_config?.structural_protocol ?? 'rigid_base',
                requestStructure: parts.map(p => 'text' in p ? 'TEXT' : 'IMAGE'),
            },
        };
    }

    const finishReason = response.candidates?.[0]?.finishReason;
    throw new Error(
        `No image returned by Gemini.${finishReason ? ` Finish reason: ${finishReason}` : ' Response may have been blocked.'}`,
    );
};



