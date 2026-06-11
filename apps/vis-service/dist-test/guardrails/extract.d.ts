import type { MultipartFile } from '@fastify/multipart';
import type { ArchitecturalGroundTruth } from '../shared/types/agt.js';
export declare const FALLBACK_AGT: ArchitecturalGroundTruth;
export declare const extractAGTFromImageData: (base64Data: string, mimeType: string) => Promise<ArchitecturalGroundTruth>;
export declare const extractArchitecturalGroundTruth: (roomImage: MultipartFile & {
    buffer: Buffer;
}) => Promise<ArchitecturalGroundTruth>;
//# sourceMappingURL=extract.d.ts.map