import { buildAGTConstraintBlock, buildAGTEchoBlock, buildConflictClausesBlock, buildConstraintHierarchyBlock, buildRenovationAnchorsBlock, INJECTED_ITEM_BLOCK_HEADER, } from '../../../prompts/balanced_v7/visualization.constants.js';
import { buildVisualizationPrompt, buildInfluencePrompt, buildMoodboardBlock, } from '../../../prompts/balanced_v7/visualization.prompt.js';
import { extractArchitecturalGroundTruth, FALLBACK_AGT, } from '../../../guardrails/extract.js';
import { classifyAGTConfidence } from '../../../guardrails/classify.js';
import { resolveRenovationSelections, hasActiveSelections, } from '../../../catalog/resolver.js';
import { buildRequestStructure, normalizeInjectedItems, } from '../../../shared/generation-parts.js';
import { composeCanonicalGenerationParts } from '../../core/pipeline-composer.js';
import { generateWithVerification } from '../../../guardrails/verified-generation.js';
// modelId undefined = DEFAULT_IMAGE_MODEL. The balanced_v7_nb2 comparison
// mode runs these exact prompts on the Gemini 3.x successor model.
export const generateWithModel = async (params, modelId, debugMode) => {
    const { roomImage, roomType, stylePreset, moodBoardImages, textPrompt, styleInfluence, contractorId, renovationSelectionIds, } = params;
    const { injectedItems, item, hasInjectedItem, shimmedFromFurnitureImage, } = normalizeInjectedItems(params, 'balanced_v7');
    const hasMoodboards = moodBoardImages.length > 0;
    let agtStatus = 'success';
    let agtFallbackReason = null;
    const rawAGT = await extractArchitecturalGroundTruth(roomImage).catch((error) => {
        agtStatus = 'fallback';
        agtFallbackReason = error instanceof Error ? error.message : String(error);
        return FALLBACK_AGT;
    });
    const classifiedAGT = classifyAGTConfidence(rawAGT);
    const hasHardAGTFacts = classifiedAGT.hard_fact_fields.length > 0;
    let resolvedRenovationSelections = null;
    if (contractorId && hasActiveSelections(renovationSelectionIds)) {
        resolvedRenovationSelections = await resolveRenovationSelections(contractorId, renovationSelectionIds);
    }
    const hasRenovationAnchors = resolvedRenovationSelections !== null &&
        Object.values(resolvedRenovationSelections).some(Boolean);
    const stagingDensity = (stylePreset.pipeline_config?.staging_density ?? 'medium');
    const { structuralPart, stylePart, rawApertureLook, safeApertureLook, apertureSanitized, stagingDensityTier, } = buildVisualizationPrompt({
        roomType,
        stylePreset,
        textPrompt,
        hasInjectedItem,
    });
    const agtConstraintBlock = buildAGTConstraintBlock(classifiedAGT);
    const agtEchoBlock = buildAGTEchoBlock(classifiedAGT);
    const conflictClausesBlock = buildConflictClausesBlock(stylePreset.conflict_resolution);
    const constraintHierarchy = buildConstraintHierarchyBlock(injectedItems.length, hasRenovationAnchors, hasHardAGTFacts);
    const renovationAnchorsBlock = buildRenovationAnchorsBlock(resolvedRenovationSelections ?? {});
    const moodboardScopeBlock = buildMoodboardBlock(stylePreset.name, stagingDensity, hasMoodboards);
    const influencePrompt = buildInfluencePrompt(moodBoardImages.length, styleInfluence, stylePreset.name);
    const parts = composeCanonicalGenerationParts({
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
            injectedItemBlockHeader: INJECTED_ITEM_BLOCK_HEADER,
        },
        itemImage: item?.image ?? null,
    });
    const { image, verification } = await generateWithVerification(parts, rawAGT, classifiedAGT, { enabled: params.verifyAGT === true, modelId });
    return {
        image,
        debug: {
            pipelineMode: debugMode,
            templateVersion: '7.0.0',
            imageModelId: modelId ?? null,
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
            injectedItem: item ? { shimmedFromFurnitureImage } : null,
            moodboardScopeBlockInserted: hasMoodboards,
            moodboardCount: moodBoardImages.length,
            stagingDensity,
            contractorId: contractorId ?? null,
            renovationSelectionIds: renovationSelectionIds ?? null,
            resolvedRenovationSelections: resolvedRenovationSelections ?? null,
            renovationAnchorsInserted: hasRenovationAnchors,
            renovationAnchorCount: hasRenovationAnchors
                ? Object.values(resolvedRenovationSelections).filter(Boolean).length
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
export const generateVisualization = async (params) => generateWithModel(params, undefined, 'balanced_v7');
// NB2 comparison mode: identical V7 prompts/guardrails on the Gemini 3.x
// successor model. Override the model id via NB2_IMAGE_MODEL if the GA id
// differs in your environment.
export const NB2_IMAGE_MODEL = process.env.NB2_IMAGE_MODEL || 'gemini-3.1-flash-image';
export const generateVisualizationNB2 = async (params) => generateWithModel(params, NB2_IMAGE_MODEL, 'balanced_v7_nb2');
//# sourceMappingURL=index.js.map