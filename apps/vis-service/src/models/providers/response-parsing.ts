// Pure response-parsing helpers for @google/genai-shaped responses.
// No SDK import and no API-key dependency, so contract tests can exercise
// them directly (same pattern as resolveProvider in provider-registry.ts).
//
// Gemini 3.x models may interleave text parts (reasoning, commentary) before
// or after the image part, and may return multiple candidates — never assume
// candidates[0].content.parts[0] is the image.

export interface GenAIResponseLike {
    candidates?: Array<{
        content?: {
            parts?: Array<{
                text?: string;
                inlineData?: { data?: string; mimeType?: string };
            }>;
        };
        finishReason?: string;
    }>;
}

/** First inline image anywhere in the response (all candidates, all parts). */
export const extractInlineImage = (
    response: GenAIResponseLike,
): { data: string; mimeType?: string } | null => {
    for (const candidate of response.candidates ?? []) {
        for (const part of candidate.content?.parts ?? []) {
            if (part.inlineData?.data) {
                return { data: part.inlineData.data, mimeType: part.inlineData.mimeType };
            }
        }
    }
    return null;
};

/** All text parts of the first candidate that has any, joined in order. */
export const extractText = (response: GenAIResponseLike): string | null => {
    for (const candidate of response.candidates ?? []) {
        const texts = (candidate.content?.parts ?? [])
            .map(p => p.text)
            .filter((t): t is string => typeof t === 'string' && t.length > 0);
        if (texts.length > 0) return texts.join('');
    }
    return null;
};

export const firstFinishReason = (response: GenAIResponseLike): string | undefined =>
    response.candidates?.[0]?.finishReason;
