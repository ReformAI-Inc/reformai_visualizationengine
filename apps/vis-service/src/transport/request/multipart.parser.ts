// Multipart form parser.
// Single responsibility: iterate multipart fields, buffer binary image data,
// and return raw typed buckets. No validation, no schema checks, no lookups.

import type { MultipartFile, Multipart } from '@fastify/multipart';
import { ValidationError } from '../../shared/validation/validation.utils.js';

export interface RawFormFiles {
    roomImage: MultipartFile & { buffer: Buffer };
    moodBoardImages: (MultipartFile & { buffer: Buffer })[];
    furnitureImage?: MultipartFile & { buffer: Buffer };
    // Repeatable product reference images (multi-product injection). Count limits
    // and mutual exclusion with furnitureImage are enforced by the assembler.
    productImages: (MultipartFile & { buffer: Buffer })[];
    previousResultImage?: MultipartFile & { buffer: Buffer };
}

export interface RawFormData {
    fields: Record<string, string | boolean>;
    files: RawFormFiles;
}

// File fields that may appear more than once; every other file field keeps the last value.
const REPEATABLE_FILE_FIELDS = new Set(['moodBoardImages', 'productImages']);

export const parseMultipartForm = async (
    parts: AsyncIterableIterator<Multipart>,
): Promise<RawFormData> => {
    const fields: Record<string, string | boolean> = {};
    const rawFiles: Record<string, MultipartFile | MultipartFile[]> = {};

    for await (const part of parts) {
        const fieldName = part.fieldname;
        if (part.type === 'file') {
            const buffer = await part.toBuffer();
            const fileWithBuffer = { ...part, buffer };
            if (REPEATABLE_FILE_FIELDS.has(fieldName)) {
                if (!rawFiles[fieldName]) rawFiles[fieldName] = [];
                (rawFiles[fieldName] as MultipartFile[]).push(fileWithBuffer as any);
            } else {
                rawFiles[fieldName] = fileWithBuffer as any;
            }
        } else {
            fields[fieldName] = (part.value === 'true' || part.value === 'false')
                ? part.value === 'true'
                : part.value as string;
        }
    }

    const roomImage = rawFiles['roomImage'] as (MultipartFile & { buffer: Buffer });
    if (!roomImage) throw new ValidationError('El campo "roomImage" es requerido');

    return {
        fields,
        files: {
            roomImage,
            moodBoardImages: (rawFiles['moodBoardImages'] as (MultipartFile & { buffer: Buffer })[]) || [],
            furnitureImage: rawFiles['furnitureImage'] as (MultipartFile & { buffer: Buffer }) | undefined,
            productImages: (rawFiles['productImages'] as (MultipartFile & { buffer: Buffer })[]) || [],
            previousResultImage: rawFiles['previousResultImage'] as (MultipartFile & { buffer: Buffer }) | undefined,
        },
    };
};

// @fastify/multipart rejects the parts iterator with FST_* errors (statusCode 413)
// when a count limit is hit — e.g. far too many productImages. Those are client
// errors: answer 400 for count limits and pass through other 4xx (file too large),
// instead of letting them fall into the generic 500 branch.
const MULTIPART_COUNT_LIMIT_CODES = new Set(['FST_FILES_LIMIT', 'FST_PARTS_LIMIT', 'FST_FIELDS_LIMIT']);
const HTTP_BAD_REQUEST = 400;
const HTTP_CLIENT_ERROR_MAX = 499;

export function classifyMultipartLimitError(error: unknown): { status: number; message: string } | null {
    if (!error || typeof error !== 'object') return null;
    const { code, statusCode, message } = error as { code?: unknown; statusCode?: unknown; message?: unknown };
    if (typeof code !== 'string' || !code.startsWith('FST_')) return null;
    const text = typeof message === 'string' ? message : code;
    if (MULTIPART_COUNT_LIMIT_CODES.has(code)) return { status: HTTP_BAD_REQUEST, message: text };
    if (typeof statusCode === 'number' && statusCode >= HTTP_BAD_REQUEST && statusCode <= HTTP_CLIENT_ERROR_MAX) {
        return { status: statusCode, message: text };
    }
    return null;
}
