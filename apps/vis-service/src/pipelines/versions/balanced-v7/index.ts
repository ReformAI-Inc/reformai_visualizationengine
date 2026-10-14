import type {
    ClassifiedAGT,
    GenerateVisualizationParams,
    InjectedItem,
    ResolvedRenovationSelections,
} from '../../../shared/types/index.js';
import {
    buildAGTConstraintBlock,
    buildAGTEchoBlock,
    buildConflictClausesBlock,
    buildConstraintHierarchyBlock,
    buildRenovationAnchorsBlock,
    buildInjectedItemBlockHeader,
} from '../../../prompts/balanced_v7/visualization.constants.js';
import {
    buildVisualizationPrompt,
    buildInfluencePrompt,
    buildMoodboardBlock,
} from '../../../prompts/balanced_v7/visualization.prompt.js';
import {
    extractArchitecturalGroundTruth,
    FALLBACK_AGT,
} from '../../../guardrails/extract.js';
import { classifyAGTConfidence } from '../../../guardrails/classify.js';
import {
    resolveRenovationSelections,
    hasActiveSelections,
} from '../../../catalog/resolver.js';
import {
    GeminiPart,
    buildRequestStructure,
    normalizeInjectedItems,
} from '../../../shared/generation-parts.js';
import { composeCanonicalGenerationParts } from '../../core/pipeline-composer.js';
import { generateWithVerification } from '../../../guardrails/verified-generation.js';

// Pure prompt assembly for V7 (no I/O): given the request, its normalized injected
// items, the classified AGT, and resolved renovation selections, build every
// prompt block and the final ordered parts array. Split out of generateWithModel
// so the exact parts sent to the model are unit-testable without calling Gemini.
export const assembleBalancedV7Parts = ({
    params,
    injectedItems,
    classifiedAGT,
    resolvedRenovationSelections,
}: {
    params: GenerateVisualizationParams;
    injectedItems: InjectedItem[];
    classifiedAGT: ClassifiedAGT;
    resolvedRenovationSelections: ResolvedRenovationSelections | null;
}) => {
    const { roomType, stylePreset, moodBoardImages, textPrompt, styleInfluence } = params;
    const hasInjectedItem = injectedItems.length > 0;
    const hasMoodboards = moodBoardImages.length > 0;
    const hasHardAGTFacts = classifiedAGT.hard_fact_fields.length > 0;
    const hasRenovationAnchors =
        resolvedRenovationSelections !== null &&
        Object.values(resolvedRenovationSelections).some(Boolean);

    const stagingDensity = (stylePreset.pipeline_config?.staging_density ?? 'medium') as 'low' | 'medium' | 'high';

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
        injectedItemCount: injectedItems.length,
    });

    const agtConstraintBlock = buildAGTConstraintBlock(classifiedAGT);
    const agtEchoBlock = buildAGTEchoBlock(classifiedAGT);
    const conflictClausesBlock = buildConflictClausesBlock(stylePreset.conflict_resolution);
    const constraintHierarchy = buildConstraintHierarchyBlock(
        injectedItems.length,
        hasRenovationAnchors,
        hasHardAGTFacts,
    );
    const renovationAnchorsBlock = buildRenovationAnchorsBlock(
        resolvedRenovationSelections ?? {},
    );
    const moodboardScopeBlock = buildMoodboardBlock(
        stylePreset.name,
        stagingDensity,
        hasMoodboards,
    );
    const influencePrompt = buildInfluencePrompt(
        moodBoardImages.length,
        styleInfluence,
        stylePreset.name,
    );

    const parts: GeminiPart[] = composeCanonicalGenerationParts({
        request: params,
        common: {
            structuralPart,
            stylePart,
            moodboardScopeBlock,
            influencePrompt,
        },
        optional: {
            agtConstraintBlock,
            conflictClausesBlock,
            constraintHierarchyBlock: constraintHierarchy,
            renovationAnchorsBlock,
            agtEchoBlock,
            injectedItemBlockHeader: hasInjectedItem ? buildInjectedItemBlockHeader(injectedItems.length) : '',
        },
        injectedItems,
    });

    return {
        parts,
        structuralPart,
        stylePart,
        rawApertureLook,
        safeApertureLook,
        apertureSanitized,
        stagingDensityTier,
        stagingDensity,
        agtConstraintBlock,
        agtEchoBlock,
        conflictClausesBlock,
    };
};

// modelId undefined = DEFAULT_IMAGE_MODEL.
export const generateWithModel = async (
    params: GenerateVisualizationParams,
    modelId: string | undefined,
    debugMode: string,
): Promise<{ image: string; model: string; debug: any }> => {
    const {
        roomImage,
        stylePreset,
        moodBoardImages,
        contractorId,
        renovationSelectionIds,
    } = params;

    const {
        injectedItems,
        hasInjectedItem,
        shimmedFromFurnitureImage,
    } = normalizeInjectedItems(params, 'balanced_v7');

    const hasMoodboards = moodBoardImages.length > 0;

    let agtStatus: 'success' | 'fallback' = 'success';
    let agtFallbackReason: string | null = null;
    const rawAGT = await extractArchitecturalGroundTruth(roomImage).catch((error: unknown) => {
        agtStatus = 'fallback';
        agtFallbackReason = error instanceof Error ? error.message : String(error);
        return FALLBACK_AGT;
    });
    const classifiedAGT = classifyAGTConfidence(rawAGT);

    let resolvedRenovationSelections: ResolvedRenovationSelections | null = null;
    if (contractorId && hasActiveSelections(renovationSelectionIds)) {
        resolvedRenovationSelections = await resolveRenovationSelections(
            contractorId,
            renovationSelectionIds!,
        );
    }
    const hasRenovationAnchors =
        resolvedRenovationSelections !== null &&
        Object.values(resolvedRenovationSelections).some(Boolean);

    const {
        parts,
        structuralPart,
        stylePart,
        rawApertureLook,
        safeApertureLook,
        apertureSanitized,
        stagingDensityTier,
        stagingDensity,
        agtConstraintBlock,
        agtEchoBlock,
        conflictClausesBlock,
    } = assembleBalancedV7Parts({
        params,
        injectedItems,
        classifiedAGT,
        resolvedRenovationSelections,
    });

    const { image, modelId: usedModelId, verification } = await generateWithVerification(
        parts,
        rawAGT,
        classifiedAGT,
        { enabled: params.verifyAGT === true, modelId },
    );

    return {
        image,
        model: usedModelId,
        debug: {
            pipelineMode: debugMode,
            templateVersion: '7.0.0',
            imageModelId: usedModelId,
            agtVerification: verification,
            agtStatus,
            agtFallbackReason,
            agtExtractionOverall: rawAGT.extraction_confidence_overall,
            agtUncertainFields: rawAGT.uncertain_fields,
            agtConfidenceDistribution: classifiedAGT.confidence_distribution,
            agtHardFactFields: classifiedAGT.hard_fact_fields,
            agtAdvisoryFields: classifiedAGT.advisory_fields,
            agtSuppressedFields: classifiedAGT.suppressed_fields,
            agtConstraintBlock,
            agtEchoBlockInserted: !!agtEchoBlock,
            agtEchoBlock: agtEchoBlock || null,
            conflictClausesInserted: !!conflictClausesBlock,
            conflictClausesBlock: conflictClausesBlock || null,
            hasInjectedItem,
            injectedItem: hasInjectedItem ? { shimmedFromFurnitureImage } : null,
            injectedItemCount: injectedItems.length,
            injectedItemDescriptions: injectedItems.map((injected) => injected.description ?? null),
            moodboardScopeBlockInserted: hasMoodboards,
            moodboardCount: moodBoardImages.length,
            stagingDensity,
            contractorId: contractorId ?? null,
            renovationSelectionIds: renovationSelectionIds ?? null,
            resolvedRenovationSelections: resolvedRenovationSelections ?? null,
            renovationAnchorsInserted: hasRenovationAnchors,
            renovationAnchorCount: hasRenovationAnchors
                ? Object.values(resolvedRenovationSelections!).filter(Boolean).length
                : 0,
            requestStructure: buildRequestStructure(parts),
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
};




export const generateVisualization = async (
    params: GenerateVisualizationParams,
): Promise<{ image: string; model: string; debug: any }> =>
    generateWithModel(params, undefined, 'balanced_v7');
