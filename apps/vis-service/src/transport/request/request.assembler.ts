// Request assembler.
// Takes raw parsed form data and produces validated, typed GenerateVisualizationParams.
// Responsibilities: image validation, Zod schema validation, style registry lookup,
// renovation selection parsing, and final params assembly.
// No multipart parsing logic belongs here.

import type { MultipartFile, Multipart } from '@fastify/multipart';
import {
    validateImageFile,
    validateImageFiles,
    parseNumber,
    parseBoolean,
    parseJSON,
    ValidationError,
} from '../../shared/validation/validation.utils.js';
import { generateVisualizationSchema } from '../schemas/visualization.schema.js';
import type { StylePreset, InjectedItem } from '../../shared/types/core.js';
import type { RenovationSelectionIds } from '../../shared/types/catalogue.js';
import type { GenerateVisualizationParams } from '../../shared/types/core.js';
import { STYLE_REGISTRY } from '../../shared/styles.registry.js';
import { parseMultipartForm } from './multipart.parser.js';

/**
 * Fills a style preset in from STYLE_REGISTRY when the caller only names it.
 *
 * Callers identify a style by whichever handle they hold — Reform-AI sends the
 * registry *id* ("contemporary") in the `name` field, while the sandbox sends
 * the display name ("Contemporary"). Matching id-to-id and name-to-name
 * case-sensitively meant neither of those resolved: the preset kept its empty
 * `model_inputs` default and the V7 prompt builder then rejected the request
 * with "core_materials must be a non-empty array" — surfacing as a 500 on every
 * generation.
 *
 * So: compare every handle the caller gave against both fields, case- and
 * whitespace-insensitively. A preset that carries its own `model_inputs` and
 * matches nothing in the registry is left untouched, which is what lets a
 * caller pass a bespoke style.
 */
export function resolveRegisteredStyle(stylePreset: StylePreset): StylePreset {
    const handles = [stylePreset.id, stylePreset.name]
        .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
        .map((value) => value.trim().toLowerCase());

    if (handles.length === 0) return stylePreset;

    const registeredStyle = STYLE_REGISTRY.find((s: { id?: string; name: string }) =>
        handles.includes((s.id ?? '').toLowerCase()) || handles.includes(s.name.toLowerCase()),
    );

    return registeredStyle
        ? { ...registeredStyle, imageUrl: stylePreset.imageUrl }
        : stylePreset;
}

export interface ProcessedVisualizationData {
    roomImage: MultipartFile & { buffer: Buffer };
    roomType: string;
    stylePreset: StylePreset;
    moodBoardImages: (MultipartFile & { buffer: Buffer })[];
    furnitureImage?: MultipartFile & { buffer: Buffer };
    injectedItems: InjectedItem[];
    textPrompt: string;
    styleInfluence: number;
    isRefinement: boolean;
    geometryPreservation: boolean;
    phaseAnchoring: boolean;
    phaseAnchoringV2: boolean;
    pipelineMode: NonNullable<GenerateVisualizationParams['pipelineMode']>;
    previousResultImage?: MultipartFile & { buffer: Buffer };
    contractorId?: string;
    renovationSelectionIds?: RenovationSelectionIds;
    verifyAGT: boolean;
}

export const processVisualizationFormData = async (
    parts: AsyncIterableIterator<Multipart>,
    queryMode?: GenerateVisualizationParams['pipelineMode'],
    contractorId?: string,
): Promise<ProcessedVisualizationData> => {
    const { fields, files } = await parseMultipartForm(parts);
    const { roomImage, moodBoardImages, furnitureImage, previousResultImage } = files;

    validateImageFile(roomImage, 'roomImage');
    if (moodBoardImages.length) validateImageFiles(moodBoardImages, 'moodBoardImages', { min: 1, max: 10 });
    if (furnitureImage) validateImageFile(furnitureImage, 'furnitureImage');
    if (previousResultImage) validateImageFile(previousResultImage, 'previousResultImage');

    const styleInfluence = parseNumber(fields['styleInfluence']?.toString(), 'styleInfluence');
    const isRefinement = parseBoolean(fields['isRefinement']?.toString());
    const geometryPreservation = fields['geometryPreservation'] !== undefined ? parseBoolean(fields['geometryPreservation'].toString()) : false;
    const phaseAnchoring = fields['phaseAnchoring'] !== undefined ? parseBoolean(fields['phaseAnchoring'].toString()) : false;
    const phaseAnchoringV2 = fields['phaseAnchoringV2'] !== undefined ? parseBoolean(fields['phaseAnchoringV2'].toString()) : false;
    const verifyAGT = fields['verifyAGT'] !== undefined ? parseBoolean(fields['verifyAGT'].toString()) : false;
    const pipelineMode = queryMode ?? (fields['pipelineMode']?.toString() as any) ?? 'balanced_v7';

    let stylePreset = parseJSON<StylePreset>(fields['stylePreset']?.toString(), 'stylePreset');
    stylePreset = resolveRegisteredStyle(stylePreset);

    const renovationSelectionIds: RenovationSelectionIds | undefined = fields['renovationSelectionIds']
        ? parseJSON<RenovationSelectionIds>(fields['renovationSelectionIds'].toString(), 'renovationSelectionIds')
        : undefined;

    const dataToValidate = {
        roomType: fields['roomType'],
        textPrompt: fields['textPrompt'],
        styleInfluence,
        isRefinement,
        geometryPreservation,
        phaseAnchoring,
        phaseAnchoringV2,
        verifyAGT,
        pipelineMode,
        stylePreset,
        renovationSelectionIds,
    };

    const validationResult = generateVisualizationSchema.safeParse(dataToValidate);
    if (!validationResult.success) {
        const errors = validationResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new ValidationError(`Errores de validación: ${errors}`);
    }

    const validatedData = validationResult.data;
    const injectedItems: InjectedItem[] = furnitureImage ? [{ image: furnitureImage }] : [];

    return {
        roomImage,
        roomType: validatedData.roomType,
        stylePreset: validatedData.stylePreset as StylePreset,
        moodBoardImages,
        furnitureImage,
        injectedItems,
        textPrompt: validatedData.textPrompt || '',
        styleInfluence: validatedData.styleInfluence,
        isRefinement: validatedData.isRefinement,
        geometryPreservation: validatedData.geometryPreservation,
        phaseAnchoring: validatedData.phaseAnchoring,
        phaseAnchoringV2: validatedData.phaseAnchoringV2,
        pipelineMode: validatedData.pipelineMode ?? pipelineMode,
        previousResultImage,
        contractorId,
        renovationSelectionIds: validatedData.renovationSelectionIds,
        verifyAGT: validatedData.verifyAGT,
    };
};



