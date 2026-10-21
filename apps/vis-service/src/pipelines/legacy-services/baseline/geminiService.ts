import type { GenerateVisualizationParams } from '../../../shared/types/index.js';
import { bufferToGenerativePart, type GeminiPart } from '../../../shared/generation-parts.js';
import { callImageModel } from '../../../models/image-model.client.js';
import { buildVisualizationPrompt, buildInfluencePrompt, buildFurniturePrompt } from '../../../prompts/baseline/visualization.prompt.js';

// The original production service's pipeline (archive/Visualization_Engine_Baseline):
// one prompt plus the images, in the same order and with the same prompt text.
// Only the model call moved: it used to hardcode gemini-2.5-flash-image (shut
// down 2026-10-02) and read the image from the response's first part only.
// It now runs through the shared image-model client, so it uses the
// environment's model (IMAGE_MODEL, 3.1 by default) and finds the image in any
// part, as Gemini 3.x can return text before it.

/** The exact parts the baseline sends, and the prompt among them — pure, for tests. */
export const assembleBaselineParts = (params: GenerateVisualizationParams): { parts: GeminiPart[]; fullPrompt: string } => {
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

	const influencePrompt = buildInfluencePrompt(moodBoardImages.length, styleInfluence, stylePreset.name);
	const furniturePrompt = buildFurniturePrompt(!!furnitureImage, roomType);

	const fullPrompt = buildVisualizationPrompt({
		isRefinement: Boolean(isRefinement),
		roomType,
		stylePresetName: stylePreset.name,
		influencePrompt,
		textPrompt,
		furniturePrompt,
	});

	const parts: GeminiPart[] = [bufferToGenerativePart(roomImage)];

	// Add previous result image for refinement context
	if (isRefinement && previousResultImage) {
		parts.push(bufferToGenerativePart(previousResultImage));
	}

	// Add the prompt
	parts.push({ text: fullPrompt });

	// Add mood board images
	parts.push(...moodBoardImages.map(bufferToGenerativePart));

	if (furnitureImage) {
		parts.push(bufferToGenerativePart(furnitureImage));
	}

	return { parts, fullPrompt };
};

export const generateVisualization = async (params: GenerateVisualizationParams): Promise<{ image: string, model: string, debug: any }> => {
	const { parts, fullPrompt } = assembleBaselineParts(params);
	const result = await callImageModel({ parts });
	return {
		image: result.image,
		model: result.modelId,
		debug: {
			pipelineMode: 'baseline_original',
			finalPrompt: fullPrompt,
			requestStructure: 'SINGLE_PROMPT_SINGLE_IMAGE',
		},
	};
};
