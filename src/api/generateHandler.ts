import type { PayloadRequest } from 'payload'
import type { AiImagePluginConfig, GenerateImageRequest, OptimizePromptRequest } from '../types.js'
import { generateImage } from '../lib/imageProviders.js'
import { buildContextualPrompt, optimizePromptWithLLM } from '../lib/promptBuilder.js'

/**
 * Resolves the API key: explicit config > environment variable
 */
function resolveApiKey(config: AiImagePluginConfig): string {
  if (config.apiKey) return config.apiKey

  const provider = config.provider ?? 'fal-flux-pro'
  const envVars: Record<string, string> = {
    'fal-flux-pro': 'FAL_API_KEY',
    'openai-gpt-image-1': 'OPENAI_API_KEY',
    'replicate-flux': 'REPLICATE_API_TOKEN',
  }
  const envKey = process.env[envVars[provider]]
  if (!envKey) throw new Error(`Missing API key. Set config.apiKey or env var ${envVars[provider]}`)
  return envKey
}

/**
 * Returns a Next.js-compatible handler function for the /api/ai-image/generate endpoint.
 */
export function createGenerateHandler(config: AiImagePluginConfig) {
  return async (req: PayloadRequest): Promise<Response> => {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    try {
      const body = await (req.json as () => Promise<unknown>)() as {
        userPrompt: string
        aspectRatio: string
        skipOptimization?: boolean
      }

      if (!body.userPrompt?.trim()) {
        return Response.json({ error: 'userPrompt is required' }, { status: 400 })
      }

      const provider = config.provider ?? 'fal-flux-pro'
      const aspectRatio = (body.aspectRatio ?? config.defaultAspectRatio ?? '16:9') as GenerateImageRequest['aspectRatio']
      const apiKey = resolveApiKey(config)

      // ── Step 1: Optimize prompt ──────────────────────────────────────────
      const optimizeReq: OptimizePromptRequest = {
        userPrompt: body.userPrompt,
        projectContext: config.projectContext,
        aspectRatio,
      }

      let finalPrompt: string
      let explanation: string

      if (!body.skipOptimization) {
        const openAiKey = process.env['OPENAI_API_KEY'] ?? ''
        if (openAiKey && provider !== 'openai-gpt-image-1') {
          // Use LLM optimization when OpenAI key is available
          const result = await optimizePromptWithLLM(optimizeReq, openAiKey)
          finalPrompt = result.optimizedPrompt
          explanation = result.explanation
        } else {
          // Pure context injection — no extra API call
          finalPrompt = buildContextualPrompt(optimizeReq)
          explanation = 'Context-enriched prompt (no LLM optimizer configured)'
        }
      } else {
        finalPrompt = body.userPrompt
        explanation = 'Raw prompt used (optimization skipped)'
      }

      // ── Step 2: Generate image ───────────────────────────────────────────
      const result = await generateImage({
        prompt: finalPrompt,
        aspectRatio,
        provider,
        apiKey,
      })

      return Response.json({
        imageUrl: result.imageUrl,
        optimizedPrompt: finalPrompt,
        revisedPrompt: result.revisedPrompt,
        explanation,
        seed: result.seed,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error('[payload-ai-image] generate error:', message)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}

/**
 * Returns a handler for prompt-only optimization (no image generation).
 * Useful for the "preview optimized prompt" feature in the UI.
 */
export function createOptimizeHandler(config: AiImagePluginConfig) {
  return async (req: PayloadRequest): Promise<Response> => {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    try {
      const body = await (req.json as () => Promise<unknown>)() as { userPrompt: string; aspectRatio?: string }
      const aspectRatio = (body.aspectRatio ?? config.defaultAspectRatio ?? '16:9') as OptimizePromptRequest['aspectRatio']

      const optimizeReq: OptimizePromptRequest = {
        userPrompt: body.userPrompt,
        projectContext: config.projectContext,
        aspectRatio,
      }

      const openAiKey = process.env['OPENAI_API_KEY'] ?? ''
      if (openAiKey) {
        const result = await optimizePromptWithLLM(optimizeReq, openAiKey)
        return Response.json(result)
      }

      const optimizedPrompt = buildContextualPrompt(optimizeReq)
      return Response.json({
        optimizedPrompt,
        explanation: 'Context-enriched prompt',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return Response.json({ error: message }, { status: 500 })
    }
  }
}
