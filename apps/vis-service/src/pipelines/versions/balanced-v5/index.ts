import { GenerateVisualizationParams, ResolvedRenovationSelections } from '../../../shared/types/index.js';
import {
    buildConstraintHierarchyBlock,
    buildRenovationAnchorsBlock,
    INJECTED_ITEM_BLOCK_HEADER,
} from '../../../prompts/balanced_v5/visualization.constants.js';
import {
    buildVisualizationPrompt,
    buildInfluencePrompt,
    buildMoodboardBlock,
} from '../../../prompts/balanced_v5/visualization.prompt.js';
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
import { callGemini } from '../../../models/gemini.client.js';

export const generateVisualization = async (
    params: GenerateVisualizationParams,
): Promise<{ image: string; model: string; debug: any }> => {
    const {
        roomType,
        stylePreset,
        moodBoardImages,
        textPrompt,
        styleInfluence,
        contractorId,
        renovationSelectionIds,
    } = params;

    const {
        injectedItems,
        item,
        hasInjectedItem,
        shimmedFromFurnitureImage,
    } = normalizeInjectedItems(params, 'balanced_v5');

    const hasMoodboards = moodBoardImages.length > 0;

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
    });

    const constraintHierarchyBlock = buildConstraintHierarchyBlock(
        injectedItems.length,
        hasRenovationAnchors,
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
            constraintHierarchyBlock,
            renovationAnchorsBlock,
            injectedItemBlockHeader: INJECTED_ITEM_BLOCK_HEADER,
        },
        itemImage: item?.image ?? null,
    });

    const { image, modelId } = await callGemini(parts);

    return {
        image,
        model: modelId,
        debug: {
            pipelineMode: 'balanced_v5',
            templateVersion: '6.0.0',
            hasInjectedItem,
            injectedItem: item ? { shimmedFromFurnitureImage } : null,
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
            renovationAnchorsBlock: renovationAnchorsBlock || null,
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



