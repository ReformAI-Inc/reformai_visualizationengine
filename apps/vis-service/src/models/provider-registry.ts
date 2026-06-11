// Provider registry — maps a model id to the provider that serves it.
// Adding a provider (FLUX, Seedream, ...) means: implement ImageModelProvider
// in providers/<name>.ts and append it to PROVIDERS. Nothing else changes.

import type { GeminiPart } from '../shared/generation-parts.js';

export interface ImageModelProvider {
    id: string;
    supports: (modelId: string) => boolean;
    generateImage: (parts: GeminiPart[], modelId: string) => Promise<{ image: string; modelId: string }>;
    generateText: (parts: GeminiPart[], modelId: string) => Promise<{ text: string; modelId: string }>;
}

// Providers register here. Kept in a function-level import to avoid a
// circular dependency between this module and provider implementations.
const loadProviders = async (): Promise<ImageModelProvider[]> => {
    const { geminiProvider } = await import('./providers/gemini.js');
    return [geminiProvider];
};

let providersCache: ImageModelProvider[] | null = null;

export const providerFor = async (modelId: string): Promise<ImageModelProvider> => {
    providersCache ??= await loadProviders();
    const provider = providersCache.find(p => p.supports(modelId));
    if (!provider) {
        throw new Error(`No provider registered for model id '${modelId}'.`);
    }
    return provider;
};

// Synchronous resolution against an explicit provider list — used by contract
// tests to verify routing without touching provider modules (which need keys).
export const resolveProvider = (
    modelId: string,
    providers: Pick<ImageModelProvider, 'id' | 'supports'>[],
): string => {
    const provider = providers.find(p => p.supports(modelId));
    if (!provider) {
        throw new Error(`No provider registered for model id '${modelId}'.`);
    }
    return provider.id;
};
