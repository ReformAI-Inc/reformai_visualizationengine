import { IMAGE_ROLES } from '../../prompts/imageRoles.js';
import type { GenerateVisualizationParams, InjectedItem } from '../../shared/types/index.js';
import { buildInjectedItemLabel } from '../../prompts/blocks/injected-items.js';
import type { GeminiPart } from '../../shared/generation-parts.js';
import { bufferToGenerativePart } from '../../shared/generation-parts.js';
import { CANONICAL_BLOCK_SEQUENCE } from '../../prompts/shared/sequence.js';
import type { AGTInsertionContract } from '../../prompts/shared/contracts.js';

interface CommonBlocks {
    structuralPart: string;
    stylePart: string;
    moodboardScopeBlock: string;
    influencePrompt: string;
}

interface OptionalBlocks extends AGTInsertionContract {
    conflictClausesBlock?: string;
    constraintHierarchyBlock: string;
    renovationAnchorsBlock: string;
    injectedItemBlockHeader: string;
}

interface ComposeParams {
    request: GenerateVisualizationParams;
    common: CommonBlocks;
    optional: OptionalBlocks;
    // 0..MAX_INJECTED_ITEMS items, in caller order. Each gets its own label + image part.
    injectedItems?: InjectedItem[];
}

export const composeCanonicalGenerationParts = ({
    request,
    common,
    optional,
    injectedItems = [],
}: ComposeParams): GeminiPart[] => {
    // Ordering contract lives in prompts/shared/sequence.ts
    // to keep V5/V7 composition aligned and reviewable.
    void CANONICAL_BLOCK_SEQUENCE;
    const parts: GeminiPart[] = [];
    const {
        roomImage,
        moodBoardImages,
        isRefinement,
        previousResultImage,
    } = request;

    parts.push({ text: IMAGE_ROLES.BASE_ROOM() });
    parts.push(bufferToGenerativePart(roomImage));

    if (optional.agtConstraintBlock) {
        parts.push({ text: optional.agtConstraintBlock });
    }

    parts.push({ text: optional.constraintHierarchyBlock });
    parts.push({ text: common.structuralPart });

    if (optional.renovationAnchorsBlock) {
        parts.push({ text: optional.renovationAnchorsBlock });
    }

    parts.push({ text: common.stylePart });

    if (optional.conflictClausesBlock) {
        parts.push({ text: optional.conflictClausesBlock });
    }

    if (common.moodboardScopeBlock) {
        parts.push({ text: common.moodboardScopeBlock });
    }

    moodBoardImages.forEach((img, i) => {
        parts.push({ text: IMAGE_ROLES.MOODBOARD_V5(i + 1) });
        parts.push(bufferToGenerativePart(img));
    });

    if (injectedItems.length > 0) {
        // One header for the whole group, then a label + image pair per item.
        // With exactly one unlabeled item this is byte-identical to the V4 layout.
        parts.push({ text: optional.injectedItemBlockHeader });
        injectedItems.forEach((item, i) => {
            parts.push({ text: buildInjectedItemLabel(i + 1, injectedItems.length, item.description) });
            parts.push(bufferToGenerativePart(item.image));
        });
    }

    if (common.influencePrompt) {
        parts.push({ text: common.influencePrompt });
    }

    if (isRefinement && previousResultImage) {
        parts.push({ text: IMAGE_ROLES.PREVIOUS_RESULT() });
        parts.push(bufferToGenerativePart(previousResultImage));
    }

    if (optional.agtEchoBlock) {
        parts.push({ text: optional.agtEchoBlock });
    }

    parts.push({ text: IMAGE_ROLES.BASE_ROOM_REANCHOR() });
    parts.push(bufferToGenerativePart(roomImage));

    return parts;
};


