// Provider registry — maps a model id to the provider that serves it.
// Adding a provider (FLUX, Seedream, ...) means: implement ImageModelProvider
// in providers/<name>.ts and append it to PROVIDERS. Nothing else changes.
// Providers register here. Kept in a function-level import to avoid a
// circular dependency between this module and provider implementations.
const loadProviders = async () => {
    const { geminiProvider } = await import('./providers/gemini.js');
    return [geminiProvider];
};
let providersCache = null;
export const providerFor = async (modelId) => {
    providersCache ??= await loadProviders();
    const provider = providersCache.find(p => p.supports(modelId));
    if (!provider) {
        throw new Error(`No provider registered for model id '${modelId}'.`);
    }
    return provider;
};
// Synchronous resolution against an explicit provider list — used by contract
// tests to verify routing without touching provider modules (which need keys).
export const resolveProvider = (modelId, providers) => {
    const provider = providers.find(p => p.supports(modelId));
    if (!provider) {
        throw new Error(`No provider registered for model id '${modelId}'.`);
    }
    return provider.id;
};
//# sourceMappingURL=provider-registry.js.map