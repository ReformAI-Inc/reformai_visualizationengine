import { GenerateVisualizationParams } from '../../../shared/types/index.js';
export declare const generateWithModel: (params: GenerateVisualizationParams, modelId: string | undefined, debugMode: string) => Promise<{
    image: string;
    debug: any;
}>;
export declare const generateVisualization: (params: GenerateVisualizationParams) => Promise<{
    image: string;
    debug: any;
}>;
export declare const NB2_IMAGE_MODEL: string;
export declare const generateVisualizationNB2: (params: GenerateVisualizationParams) => Promise<{
    image: string;
    debug: any;
}>;
//# sourceMappingURL=index.d.ts.map