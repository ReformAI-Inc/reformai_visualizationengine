import { loadEnvFile } from 'node:process';
import { GoogleGenAI, Modality } from "@google/genai";
import type { MultipartFile } from '@fastify/multipart';
import { GenerateVisualizationParams } from '../../../shared/types/index.js';
import { buildVisualizationPrompt, buildInfluencePrompt, buildFurniturePrompt } from '../../../prompts/improved/visualization.prompt.js';
import { IMAGE_ROLES } from '../../../prompts/imageRoles.js';

if (!process.env.K_SERVICE) {
	try {
		loadEnvFile();
	} catch {
		// .env file not found — rely on environment variables already set
	}
}

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
	throw new Error(
		'API_KEY environment variable is not set. ' +
		'Add API_KEY=your_key to the .env file in the backend root.'
	);
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const bufferToGenerativePart = (file: MultipartFile & { buffer: Buffer }) => {
	const base64Data = file.buffer.toString('base64');
	return {
		inlineData: { data: base64Data, mimeType: file.mimetype },
	};
};

export const generateVisualization = async (params: GenerateVisualizationParams): Promise<{ image: string, debug: any }> => {
	const {
		roomImage,
		roomType,
		stylePreset,
		moodBoardImages,
		furnitureImage,
		textPrompt,
		styleInfluence,
		isRefinement,
		geometryPreservation,
		phaseAnchoring,
		phaseAnchoringV2,
		pipelineMode,
		previousResultImage,
	} = params;

	const model = 'gemini-2.5-flash-image';

	const influencePrompt = buildInfluencePrompt(moodBoardImages.length, styleInfluence, stylePreset.name);
	const furniturePrompt = buildFurniturePrompt(!!furnitureImage, roomType);

	const { fullPrompt, structuralPart, stylePart } = buildVisualizationPrompt({
		isRefinement: Boolean(isRefinement),
		roomType,
		stylePresetName: stylePreset.name,
		influencePrompt,
		textPrompt,
		furniturePrompt,
		geometryPreservation: Boolean(geometryPreservation),
		phaseAnchoring: Boolean(phaseAnchoring),
		phaseAnchoringV2: Boolean(phaseAnchoringV2),
		stylePreset,
		pipelineMode,
	});

	let parts: Array<{ inlineData: { data: string; mimeType: string } } | { text: string }> = [
		{ text: IMAGE_ROLES.BASE_ROOM() },
		bufferToGenerativePart(roomImage),
	];

	if (structuralPart) {
		parts.push({ text: structuralPart });
	}

	if (stylePart) {
		parts.push({ text: stylePart });
	}

	// Mood board images
	moodBoardImages.forEach((img, i) => {
		parts.push({ text: IMAGE_ROLES.MOODBOARD_V5(i + 1) });
		parts.push(bufferToGenerativePart(img));
	});

	// Furniture reference image
	if (furnitureImage) {
		parts.push({ text: IMAGE_ROLES.INJECTED_ITEM(1) });
		parts.push(bufferToGenerativePart(furnitureImage));
	}

	// Refinement context
	if (isRefinement && previousResultImage) {
		parts.push({ text: IMAGE_ROLES.PREVIOUS_RESULT() });
		parts.push(bufferToGenerativePart(previousResultImage));
	}

	// Final structural anchor
	parts.push({ text: IMAGE_ROLES.BASE_ROOM_REANCHOR() });
	parts.push(bufferToGenerativePart(roomImage));

	const response = await ai.models.generateContent({
		model,
		contents: { parts },
		config: {
			responseModalities: [Modality.IMAGE],
		},
	});

	const firstPart = response.candidates?.[0]?.content?.parts?.[0];

	if (firstPart?.inlineData?.data) {
		const base64Image = firstPart.inlineData.data;
		return {
			image: base64Image,
			debug: {
				pipelineMode: 'improved_current',
				structuralPart,
				stylePart,
				styleObject: stylePreset,
				structuralProtocol: stylePreset.pipeline_config.structural_protocol,
				requestStructure: parts.map(p => 'text' in p ? 'TEXT' : 'IMAGE'),
			}
		};
	}

	const finishReason = response.candidates?.[0]?.finishReason;
	throw new Error(
		`No image returned by Gemini.${finishReason ? ` Finish reason: ${finishReason}` : ' Response may have been blocked.'}`
	);
};



