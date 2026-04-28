import type { ProjectContext, ImageAspectRatio, OptimizePromptRequest, OptimizePromptResponse } from '../types.js'

const ASPECT_RATIO_HINTS: Record<ImageAspectRatio, string> = {
  '1:1': 'square composition',
  '16:9': 'wide landscape composition',
  '4:3': 'standard photo composition',
  '3:2': 'classic photo composition',
  '9:16': 'vertical portrait composition',
}

/**
 * Builds a context-enriched prompt from a bare user input.
 * No external API call — pure string composition.
 * Used as the base; optionally enhanced by LLM if OPENAI_API_KEY is available.
 */
export function buildContextualPrompt(req: OptimizePromptRequest): string {
  const { userPrompt, projectContext: ctx, aspectRatio } = req
  const parts: string[] = []

  // 1. User's core intent
  parts.push(userPrompt.trim())

  // 2. Industry context
  if (ctx.industry) {
    parts.push(`for ${ctx.industry} industry`)
  }

  // 3. Geographic context
  if (ctx.country) {
    parts.push(`in ${ctx.country}`)
  }

  // 4. Visual style
  if (ctx.visualStyle && ctx.visualStyle.length > 0) {
    parts.push(ctx.visualStyle.join(', '))
  }

  // 5. Composition hint from aspect ratio
  parts.push(ASPECT_RATIO_HINTS[aspectRatio])

  // 6. Quality boosters always appended
  parts.push('professional photography, high resolution, sharp focus, natural lighting')

  // 7. Negative hints
  if (ctx.avoidColors && ctx.avoidColors.length > 0) {
    parts.push(`avoid colors: ${ctx.avoidColors.join(', ')}`)
  }

  // 8. Extra context
  if (ctx.additionalContext) {
    parts.push(ctx.additionalContext)
  }

  return parts.join(', ')
}

/**
 * Enhances the prompt using OpenAI GPT-4o-mini if an API key is available.
 * Falls back to buildContextualPrompt() silently if the call fails.
 */
export async function optimizePromptWithLLM(
  req: OptimizePromptRequest,
  openAiApiKey: string,
): Promise<OptimizePromptResponse> {
  const basePrompt = buildContextualPrompt(req)
  const { projectContext: ctx } = req

  const systemMessage = `You are an expert image generation prompt engineer specializing in ${ctx.industry || 'professional'} photography for ${ctx.country || 'international'} markets.

Your task: Transform a basic image description into a rich, detailed prompt optimized for photorealistic AI image generation (Flux Pro / DALL-E quality).

Rules:
- Keep the user's core intent intact
- Add specific visual details: lighting (golden hour, soft diffused, etc.), textures, depth of field
- Add photographic style: lens type, perspective, mood
- Incorporate the business context naturally — don't force it
- Maximum 150 words
- Output ONLY the optimized prompt, no explanation`

  const userMessage = `Business: ${ctx.businessName || 'Unknown'}
Industry: ${ctx.industry}
Country: ${ctx.country}
Visual style preference: ${ctx.visualStyle?.join(', ') || 'professional, clean'}

User's raw prompt: "${req.userPrompt}"
Base contextual prompt: "${basePrompt}"

Optimize this into a world-class image generation prompt.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 250,
        temperature: 0.7,
      }),
    })

    if (!response.ok) throw new Error(`OpenAI error: ${response.status}`)

    const data = await response.json() as { choices: { message: { content: string } }[] }
    const optimizedPrompt = data.choices[0]?.message?.content?.trim() ?? basePrompt

    return {
      optimizedPrompt,
      explanation: 'Enhanced with GPT-4o-mini for richer visual detail',
    }
  } catch {
    // Graceful fallback — never fail the user
    return {
      optimizedPrompt: basePrompt,
      explanation: 'Using context-enriched prompt (LLM optimization unavailable)',
    }
  }
}
