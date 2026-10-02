import { FastifyRequest, FastifyReply } from 'fastify';
import { processVisualizationFormData } from '../request/request.assembler.js';
import { ValidationError } from '../../shared/validation/validation.utils.js';
import { CatalogueValidationError } from '../../catalog/resolver.js';
import { generateVisualization } from '../../pipelines/core/pipeline-dispatcher.js';

export async function generateVisualizationController(
    request: FastifyRequest,
    reply: FastifyReply,
) {
    try {
        if (!request.isMultipart()) {
            return reply.status(400).send({
                error: 'Bad Request',
                message: 'El contenido debe ser multipart/form-data',
            });
        }

        const parts = request.parts();
        const queryMode = (request.query as any)?.mode as import('../../shared/types/index.js').GenerateVisualizationParams['pipelineMode'];
        const contractorId = (request.headers['x-contractor-id'] as string) || undefined;
        const data = await processVisualizationFormData(parts, queryMode, contractorId);
        const result = await generateVisualization(data);

        return reply.status(200).send({
            message: 'Visualización generada exitosamente',
            data: {
                image: result.image,
                metadata: {
                    model: result.model,
                    roomType: data.roomType,
                    stylePreset: data.stylePreset.name,
                    isRefinement: data.isRefinement,
                },
                debug: result.debug,
            },
        });

    } catch (error) {
        if (error instanceof ValidationError) {
            return reply.status(400).send({ error: 'Validation Error', message: error.message });
        }
        if (error instanceof CatalogueValidationError) {
            return reply.status(400).send({ error: 'Catalogue Validation Error', message: error.message });
        }

        const geminiError = extractGeminiError(error);
        if (geminiError) {
            request.log.error({ geminiError }, 'Gemini API error');
            return reply.status(502).send({
                error: 'Gemini API Error',
                message: geminiError.message,
                code: geminiError.code,
                status: geminiError.status,
            });
        }

        request.log.error(error);
        return reply.status(500).send({
            error: 'Internal Server Error',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}

function extractGeminiError(error: unknown): { message: string; code?: number; status?: string } | null {
    if (!error || typeof error !== 'object') return null;
    const err = error as Record<string, unknown>;
    if (err['name'] !== 'ApiError') return null;
    try {
        const raw = JSON.parse(err['message'] as string) as { error?: { message?: string; code?: number; status?: string } };
        return {
            message: raw?.error?.message ?? String(err['message']),
            code: raw?.error?.code,
            status: raw?.error?.status,
        };
    } catch {
        return { message: String(err['message']) };
    }
}


