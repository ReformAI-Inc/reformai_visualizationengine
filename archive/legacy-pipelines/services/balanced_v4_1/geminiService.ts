// ============================================================
// BALANCED V4.1 — GEMINI SERVICE
//
// Request assembly for pipelineMode 'balanced_v4_1'.
//
// Identical to balanced_v4_0 service except:
//   - Imports from balanced_v4_1 prompts
//   - pipelineMode and templateVersion debug fields updated to '4.1'
//   - Multi-item error message updated to reference v4.1
//
// Part ordering (unchanged from v4.0):
//   1. [LABEL] Base room
//   2. [IMAGE] Base room
//   3. [TEXT]  Constraint hierarchy block
//   4. [TEXT]  Structural part
//   5. [TEXT]  Style part
//   6. [LABEL] Moodboard N  (repeated per image)
//   7. [IMAGE] Moodboard N
//   8. [TEXT]  Injected item block header  (if item present)
//   9. [LABEL] Injected item 1             (if item present)
//  10. [IMAGE] Injected item 1             (if item present)
//  11. [TEXT]  Influence prompt
//  12. [LABEL] Previous result             (if refinement)
//  13. [IMAGE] Previous result             (if refinement)
//  14. [LABEL] Base room re-anchor
//  15. [IMAGE] Base room re-anchor
// ============================================================

import { loadEnvFile } from 'node:process';
import { GoogleGenAI, Modality } from '@google/genai';
import type { MultipartFile } from '@fastify/multipart';
import { GenerateVisualizationParams, InjectedItem } from '../../../shared/types/index.js';
import { IMAGE_ROLES } from '../../../prompts/imageRoles.js';
import {
    buildConstraintHierarchyBlock,
    INJECTED_ITEM_BLOCK_HEADER,
} from '../../../prompts/balanced_v4_1/visualization.constants.js';
import {
    buildVisualizationPrompt,
    buildInfluencePrompt,
} from '../../../prompts/balanced_v4_1/visualization.prompt.js';

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
        textPrompt,
        styleInfluence,
        isRefinement,
        previousResultImage,
    } = params;

    // ── Resolve injected items ────────────────────────────────────────────────
    let injectedItems: InjectedItem[] = params.injectedItems ?? [];

    if (injectedItems.length === 0 && params.furnitureImage) {
        injectedItems = [{ image: params.furnitureImage }];
    }

    // ── Validate: max 1 item in v4.1 ─────────────────────────────────────────
    if (injectedItems.length > 1) {
        throw new Error(
            `balanced_v4_1 supports a maximum of 1 injected item. ` +
            `Received ${injectedItems.length}. Multi-item support is planned for a future version.`,
        );
    }

    const item = injectedItems[0] ?? null;
    const hasInjectedItem = item !== null;

    // ── Build prompt parts ────────────────────────────────────────────────────
    const influencePrompt = buildInfluencePrompt(
        moodBoardImages.length,
        styleInfluence,
        stylePreset.name,
    );

    const {
        structuralPart,
        stylePart,
        rawApertureLook,
        safeApertureLook,
        apertureSanitized,
        stagingDensityTier,
    } = buildVisualizationPrompt({
        roomType,
        stylePreset,
        textPrompt,
        hasInjectedItem,
    });

    const constraintHierarchyBlock = buildConstraintHierarchyBlock(injectedItems.length);

    // ── Assemble request parts ────────────────────────────────────────────────
    type Part = { inlineData: { data: string; mimeType: string } } | { text: string };
    const parts: Part[] = [];

    // 1–2. Base room
    parts.push({ text: IMAGE_ROLES.BASE_ROOM() });
    parts.push(bufferToGenerativePart(roomImage));

    // 3. Constraint hierarchy
    parts.push({ text: constraintHierarchyBlock });

    // 4. Structural part
    parts.push({ text: structuralPart });

    // 5. Style part
    parts.push({ text: stylePart });

    // 6–7. Moodboard images
    moodBoardImages.forEach((img, i) => {
        parts.push({ text: IMAGE_ROLES.MOODBOARD(i + 1) });
        parts.push(bufferToGenerativePart(img));
    });

    // 8–10. Injected item (if present)
    if (item) {
        parts.push({ text: INJECTED_ITEM_BLOCK_HEADER });
        parts.push({ text: IMAGE_ROLES.INJECTED_ITEM(1) });
        parts.push(bufferToGenerativePart(item.image));
    }

    // 11. Influence prompt
    if (influencePrompt) {
        parts.push({ text: influencePrompt });
    }

    // 12–13. Refinement context
    if (isRefinement && previousResultImage) {
        parts.push({ text: IMAGE_ROLES.PREVIOUS_RESULT() });
        parts.push(bufferToGenerativePart(previousResultImage));
    }

    // 14–15. Base room re-anchor
    parts.push({ text: IMAGE_ROLES.BASE_ROOM_REANCHOR() });
    parts.push(bufferToGenerativePart(roomImage));

    // ── API call ──────────────────────────────────────────────────────────────
    const model = 'gemini-2.5-flash-image';

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
                pipelineMode: 'balanced_v4_1',
                templateVersion: '4.1',
                hasInjectedItem,
                injectedItem: item ? { shimmedFromFurnitureImage: !params.injectedItems?.length } : null,
                requestStructure: parts.map(p =>
                    'text' in p
                        ? (p.text.startsWith('[') ? `LABEL:${p.text.slice(1, p.text.indexOf(']'))}` : 'TEXT')
                        : 'IMAGE'
                ),
                structuralPart,
                stylePart,
                styleObject: stylePreset,
                structuralProtocol: stylePreset.pipeline_config?.structural_protocol ?? 'rigid_base',
                stagingDensityTier,
                rawApertureLook,
                safeApertureLook,
                apertureSanitized,
            },
        };
    }

    const finishReason = response.candidates?.[0]?.finishReason;
    throw new Error(
        `No image returned by Gemini.${finishReason ? ` Finish reason: ${finishReason}` : ' Response may have been blocked.'}`,
    );
};



