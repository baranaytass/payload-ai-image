import type { GenerateImageRequest, GenerateImageResponse, ImageAspectRatio } from '../types.js'

// ─── Aspect ratio → provider-specific dimensions ──────────────────────────

const FAL_IMAGE_SIZES: Record<ImageAspectRatio, string> = {
  '1:1': 'square_hd',
  '16:9': 'landscape_16_9',
  '4:3': 'landscape_4_3',
  '3:2': 'landscape_4_3', // closest available
  '9:16': 'portrait_16_9',
}

const OPENAI_SIZES: Record<ImageAspectRatio, '1024x1024' | '1536x1024' | '1024x1536'> = {
  '1:1': '1024x1024',
  '16:9': '1536x1024',
  '4:3': '1536x1024',
  '3:2': '1536x1024',
  '9:16': '1024x1536',
}

// ─── Fal.ai — Flux Pro ────────────────────────────────────────────────────

async function generateWithFalFlux(req: GenerateImageRequest): Promise<GenerateImageResponse> {
  // Submit job
  const submitRes = await fetch('https://queue.fal.run/fal-ai/flux-pro', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${req.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: req.prompt,
      image_size: FAL_IMAGE_SIZES[req.aspectRatio],
      num_inference_steps: 28,
      guidance_scale: 3.5,
      num_images: 1,
      enable_safety_checker: true,
    }),
  })

  if (!submitRes.ok) {
    const err = await submitRes.text()
    throw new Error(`Fal.ai submit failed: ${submitRes.status} — ${err}`)
  }

  const { request_id } = await submitRes.json() as { request_id: string }

  // Poll for result (max 120s)
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2000))

    const statusRes = await fetch(
      `https://queue.fal.run/fal-ai/flux-pro/requests/${request_id}/status`,
      { headers: { 'Authorization': `Key ${req.apiKey}` } },
    )

    const status = await statusRes.json() as { status: string }

    if (status.status === 'COMPLETED') {
      const resultRes = await fetch(
        `https://queue.fal.run/fal-ai/flux-pro/requests/${request_id}`,
        { headers: { 'Authorization': `Key ${req.apiKey}` } },
      )
      const result = await resultRes.json() as { images: { url: string }[] }
      return { imageUrl: result.images[0].url }
    }

    if (status.status === 'FAILED') {
      throw new Error('Fal.ai generation failed')
    }
  }

  throw new Error('Fal.ai generation timed out after 120s')
}

// ─── OpenAI — gpt-image-1 ─────────────────────────────────────────────────

async function generateWithOpenAI(req: GenerateImageRequest): Promise<GenerateImageResponse> {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${req.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: req.prompt,
      n: 1,
      size: OPENAI_SIZES[req.aspectRatio],
      quality: 'high',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI Images failed: ${res.status} — ${err}`)
  }

  const data = await res.json() as {
    data: { b64_json?: string; url?: string; revised_prompt?: string }[]
  }

  const item = data.data[0]

  // gpt-image-1 returns base64 — convert to data URL for display
  const imageUrl = item.url ?? `data:image/png;base64,${item.b64_json}`

  return {
    imageUrl,
    revisedPrompt: item.revised_prompt,
  }
}

// ─── Replicate — Flux Pro ─────────────────────────────────────────────────

async function generateWithReplicate(req: GenerateImageRequest): Promise<GenerateImageResponse> {
  // Map aspect ratio to width/height
  const dimensions: Record<ImageAspectRatio, { width: number; height: number }> = {
    '1:1': { width: 1024, height: 1024 },
    '16:9': { width: 1344, height: 768 },
    '4:3': { width: 1152, height: 896 },
    '3:2': { width: 1216, height: 832 },
    '9:16': { width: 768, height: 1344 },
  }

  const res = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-pro/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${req.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: {
        prompt: req.prompt,
        ...dimensions[req.aspectRatio],
        steps: 25,
        guidance: 3,
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Replicate submit failed: ${res.status} — ${err}`)
  }

  const prediction = await res.json() as { id: string; urls: { get: string } }

  // Poll
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2500))
    const pollRes = await fetch(prediction.urls.get, {
      headers: { 'Authorization': `Bearer ${req.apiKey}` },
    })
    const poll = await pollRes.json() as { status: string; output: string[] | null }
    if (poll.status === 'succeeded' && poll.output) {
      return { imageUrl: poll.output[0] }
    }
    if (poll.status === 'failed') throw new Error('Replicate generation failed')
  }

  throw new Error('Replicate generation timed out')
}

// ─── Router ───────────────────────────────────────────────────────────────

export async function generateImage(req: GenerateImageRequest): Promise<GenerateImageResponse> {
  switch (req.provider) {
    case 'fal-flux-pro':
      return generateWithFalFlux(req)
    case 'openai-gpt-image-1':
      return generateWithOpenAI(req)
    case 'replicate-flux':
      return generateWithReplicate(req)
    default:
      throw new Error(`Unknown provider: ${req.provider}`)
  }
}
