import type { Config } from 'payload'
import type { AiImagePluginConfig } from './types.js'
import { createGenerateHandler, createOptimizeHandler } from './api/generateHandler.js'

/**
 * aiImagePlugin(config) → (payloadConfig) => payloadConfig
 *
 * Usage in payload.config.ts:
 *
 *   import { aiImagePlugin } from 'payload-ai-image'
 *
 *   export default buildConfig({
 *     plugins: [
 *       aiImagePlugin({
 *         provider: 'fal-flux-pro',
 *         projectContext: {
 *           businessName: 'Peyzaj Kıbrıs',
 *           industry: 'landscape architecture',
 *           country: 'Cyprus',
 *           visualStyle: ['photorealistic', 'mediterranean', 'lush greenery'],
 *         },
 *       }),
 *     ],
 *   })
 */
export function aiImagePlugin(pluginConfig: AiImagePluginConfig) {
  return (incomingConfig: Config): Config => {
    const targetCollections = pluginConfig.collections ?? ['media']
    // Payload strips the /api prefix automatically — endpoints are registered without it
    // but the client still calls /api/ai-image/... via the Next.js route handler
    const apiBasePath = '/api/ai-image'
    const endpointBasePath = '/ai-image'
    const defaultAspectRatio = pluginConfig.defaultAspectRatio ?? '16:9'
    const maxRevisions = pluginConfig.maxRevisions ?? 5

    const generateHandler = createGenerateHandler(pluginConfig)
    const optimizeHandler = createOptimizeHandler(pluginConfig)

    // ── 1. Inject custom endpoints ────────────────────────────────────────
    const existingEndpoints = incomingConfig.endpoints ?? []

    const newEndpoints: NonNullable<Config['endpoints']> = [
      ...existingEndpoints,
      {
        path: `${endpointBasePath}/generate`,
        method: 'post',
        handler: generateHandler,
      },
      {
        path: `${endpointBasePath}/optimize`,
        method: 'post',
        handler: optimizeHandler,
      },
    ]

    // ── 2. Inject AI button into upload collections ───────────────────────
    const updatedCollections = (incomingConfig.collections ?? []).map(collection => {
      if (!targetCollections.includes(collection.slug)) return collection

      // Only inject into upload collections
      const isUpload = Boolean(collection.upload)
      if (!isUpload) return collection

      const aiField = {
        name: 'aiGenerateButton',
        type: 'ui' as const,
        admin: {
          components: {
            Field: {
              path: 'payload-ai-image/client#AiImageField',
              clientProps: {
                defaultAspectRatio,
                apiBasePath,
                maxRevisions,
              },
            },
          },
        },
      }

      return {
        ...collection,
        fields: [aiField, ...(collection.fields ?? [])],
      }
    })

    // ── 3. Optionally store prompt history as a field ─────────────────────
    const collectionsWithHistory = pluginConfig.storePromptHistory !== false
      ? updatedCollections.map(collection => {
          if (!targetCollections.includes(collection.slug)) return collection
          if (!Boolean(collection.upload)) return collection

          const historyField = {
            name: 'aiPromptHistory',
            type: 'array' as const,
            label: 'AI Prompt Geçmişi',
            admin: {
              readOnly: true,
              position: 'sidebar' as const,
              description: 'Bu görsel için kullanılan AI promptları',
            },
            fields: [
              { name: 'prompt', type: 'text' as const, label: 'Prompt' },
              { name: 'provider', type: 'text' as const, label: 'Provider' },
              { name: 'createdAt', type: 'text' as const, label: 'Tarih' },
            ],
          }

          return {
            ...collection,
            fields: [...(collection.fields ?? []), historyField],
          }
        })
      : updatedCollections

    return {
      ...incomingConfig,
      endpoints: newEndpoints,
      collections: collectionsWithHistory,
    }
  }
}
