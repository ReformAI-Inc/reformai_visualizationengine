// ============================================================
// ARCHITECTURAL GROUND TRUTH EXTRACTION — V7
//
// Runs a dedicated Gemini text-only pass on the room image
// before the main generation request. Extracts structural
// facts (window count, door count, ceiling fixture, built-in
// niches, camera perspective) with per-field confidence levels.
//
// The caller (pipelines/v7) catches any error and falls back
// to FALLBACK_AGT, so this function may throw freely on
// malformed responses.
// ============================================================

import type { MultipartFile } from '@fastify/multipart';
import type { ArchitecturalGroundTruth, ConfidenceLevel, CountFieldInstance } from '../shared/types/agt.js';
import { AGT_EXTRACTION_MODEL, callTextModel } from '../models/image-model.client.js';

export const FALLBACK_AGT: ArchitecturalGroundTruth = {
    window_count:    { value: 0, confidence: 'low', instances: [] },
    door_count:      { value: 0, confidence: 'low', instances: [] },
    has_ceiling_fixture: { value: false, confidence: 'low' },
    has_built_in_niches: { value: false, confidence: 'low' },
    camera_perspective:  { value: 'unknown', confidence: 'low' },
    extraction_confidence_overall: 'low',
    uncertain_fields: ['window_count', 'door_count', 'has_ceiling_fixture', 'has_built_in_niches', 'camera_perspective'],
};

const EXTRACTION_PROMPT = `You are an architectural analysis system. Analyze this room image and extract structural facts as JSON.

Return ONLY valid JSON matching this exact schema — no markdown, no explanation:

{
  "window_count": {
    "value": <integer — count of distinct window openings visible>,
    "confidence": <"high" | "medium" | "low">,
    "instances": [
      { "location": "<spatial description e.g. left wall, rear wall>", "type": "<e.g. external_glazed, skylight, clerestory>" }
    ]
  },
  "door_count": {
    "value": <integer — count of distinct door openings visible>,
    "confidence": <"high" | "medium" | "low">,
    "instances": [
      { "location": "<spatial description>", "type": "<e.g. solid_door, sliding_door, french_door, open_archway>" }
    ]
  },
  "has_ceiling_fixture": {
    "value": <boolean — true if any ceiling-mounted lighting fixture is visible>,
    "confidence": <"high" | "medium" | "low">
  },
  "has_built_in_niches": {
    "value": <boolean — true if any built-in recessed niche, alcove, or built-in shelving unit is visible>,
    "confidence": <"high" | "medium" | "low">
  },
  "camera_perspective": {
    "value": <"corner" | "straight_on" | "diagonal" | "overhead" | "unknown">,
    "confidence": <"high" | "medium" | "low">
  },
  "extraction_confidence_overall": <"high" | "medium" | "low">,
  "uncertain_fields": [<field names where extraction was ambiguous>]
}

Confidence rules:
- "high": element is clearly visible and unambiguous; instances array must be fully populated for count fields
- "medium": element is probably present but partially obscured or ambiguous
- "low": element cannot be reliably determined from this image

For instances: populate only when confidence is "high". Leave as [] for medium/low.`;

const parseConfidence = (raw: unknown): ConfidenceLevel => {
    if (raw === 'high' || raw === 'medium' || raw === 'low') return raw;
    return 'low';
};

const parseInstances = (raw: unknown): CountFieldInstance[] => {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter(i => i && typeof i === 'object' && typeof i.location === 'string' && typeof i.type === 'string')
        .map(i => ({ location: i.location as string, type: i.type as string }));
};

const parseAndValidate = (raw: string): ArchitecturalGroundTruth => {
    const json = JSON.parse(raw.trim());

    const windowConf = parseConfidence(json.window_count?.confidence);
    const doorConf = parseConfidence(json.door_count?.confidence);

    return {
        window_count: {
            value: typeof json.window_count?.value === 'number' ? Math.max(0, Math.round(json.window_count.value)) : 0,
            confidence: windowConf,
            instances: parseInstances(json.window_count?.instances),
        },
        door_count: {
            value: typeof json.door_count?.value === 'number' ? Math.max(0, Math.round(json.door_count.value)) : 0,
            confidence: doorConf,
            instances: parseInstances(json.door_count?.instances),
        },
        has_ceiling_fixture: {
            value: Boolean(json.has_ceiling_fixture?.value),
            confidence: parseConfidence(json.has_ceiling_fixture?.confidence),
        },
        has_built_in_niches: {
            value: Boolean(json.has_built_in_niches?.value),
            confidence: parseConfidence(json.has_built_in_niches?.confidence),
        },
        camera_perspective: {
            value: typeof json.camera_perspective?.value === 'string' ? json.camera_perspective.value : 'unknown',
            confidence: parseConfidence(json.camera_perspective?.confidence),
        },
        extraction_confidence_overall: parseConfidence(json.extraction_confidence_overall),
        uncertain_fields: Array.isArray(json.uncertain_fields)
            ? json.uncertain_fields.filter((f: unknown) => typeof f === 'string')
            : [],
    };
};

// Core extraction over raw image data. Used both for the input room photo
// (pre-generation) and for generated output images (post-generation verification).
export const extractAGTFromImageData = async (
    base64Data: string,
    mimeType: string,
): Promise<ArchitecturalGroundTruth> => {
    const text = await callTextModel(
        [
            { text: EXTRACTION_PROMPT },
            { inlineData: { data: base64Data, mimeType } },
        ],
        AGT_EXTRACTION_MODEL,
    );

    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

    return parseAndValidate(cleaned);
};

export const extractArchitecturalGroundTruth = async (
    roomImage: MultipartFile & { buffer: Buffer },
): Promise<ArchitecturalGroundTruth> =>
    extractAGTFromImageData(roomImage.buffer.toString('base64'), roomImage.mimetype);



