export type ImageProvider = 'fal-flux-pro' | 'openai-gpt-image-1' | 'replicate-flux'

export type ImageAspectRatio = '1:1' | '16:9' | '4:3' | '3:2' | '9:16'

export interface ProjectContext {
  /** Business name shown in prompts */
  businessName: string
  /** Industry / sector — e.g. "landscape architecture", "real estate", "restaurant" */
  industry: string
  /** Country / region — e.g. "Cyprus", "Turkey", "Germany" */
  country: string
  /** Visual style keywords appended to every prompt */
  visualStyle?: string[]
  /** Colors to avoid in generated images */
  avoidColors?: string[]
  /** Extra instructions always appended to prompts */
  additionalContext?: string
}

export interface AiImagePluginConfig {
  /**
   * Which image generation API to use.
   * Default: 'fal-flux-pro'
   */
  provider?: ImageProvider

  /**
   * API key for the selected provider.
   * Can also be set via environment variable:
   *   - fal-flux-pro   → FAL_API_KEY
   *   - openai-*       → OPENAI_API_KEY
   *   - replicate-*    → REPLICATE_API_TOKEN
   */
  apiKey?: string

  /**
   * Project-level context injected into every generated prompt.
   * This is what makes the plugin "context-aware" without per-image prompting.
   */
  projectContext: ProjectContext

  /**
   * Payload collection slugs where the AI generate button appears.
   * Defaults to ['media'] — the standard media collection.
   */
  collections?: string[]

  /**
   * Default aspect ratio for generated images.
   * Default: '16:9'
   */
  defaultAspectRatio?: ImageAspectRatio

  /**
   * Maximum number of revision iterations allowed in the UI.
   * Default: 5
   */
  maxRevisions?: number

  /**
   * Whether to store prompt history on the media document.
   * Default: true
   */
  storePromptHistory?: boolean
}

export interface GenerateImageRequest {
  prompt: string
  aspectRatio: ImageAspectRatio
  provider: ImageProvider
  apiKey: string
}

export interface GenerateImageResponse {
  imageUrl: string
  revisedPrompt?: string
  seed?: number
}

export interface OptimizePromptRequest {
  userPrompt: string
  projectContext: ProjectContext
  aspectRatio: ImageAspectRatio
}

export interface OptimizePromptResponse {
  optimizedPrompt: string
  explanation: string
}
