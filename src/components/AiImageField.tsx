'use client'

import React, { useCallback } from 'react'
import { AiImageButton } from './AiImageButton.js'
import type { ImageAspectRatio } from '../types.js'

interface AiImageFieldProps {
  field: {
    setValue: (value: unknown) => void
    value: unknown
  }
  defaultAspectRatio?: ImageAspectRatio
  apiBasePath?: string
  maxRevisions?: number
}

async function uploadGeneratedImage(imageUrl: string, prompt: string): Promise<string> {
  let blob: Blob

  if (imageUrl.startsWith('data:')) {
    // base64 → Blob
    const [header, b64] = imageUrl.split(',')
    const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png'
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
    blob = new Blob([bytes], { type: mime })
  } else {
    // Remote URL → fetch → Blob
    const res = await fetch(imageUrl)
    blob = await res.blob()
  }

  const filename = `ai-generated-${Date.now()}.png`
  const formData = new FormData()
  formData.append('file', blob, filename)
  formData.append('alt', prompt.slice(0, 100))

  const uploadRes = await fetch('/api/media', {
    method: 'POST',
    body: formData,
  })

  if (!uploadRes.ok) {
    const err = await uploadRes.text()
    throw new Error(`Upload failed: ${uploadRes.status} — ${err}`)
  }

  const result = await uploadRes.json() as { doc?: { id: string } }
  const id = result.doc?.id
  if (!id) throw new Error('Upload succeeded but no document ID returned')
  return id
}

export function AiImageField({
  field,
  defaultAspectRatio,
  apiBasePath,
  maxRevisions,
}: AiImageFieldProps) {
  const handleApprove = useCallback(
    async (imageUrl: string, prompt: string) => {
      try {
        const id = await uploadGeneratedImage(imageUrl, prompt)
        field.setValue(id)
      } catch (err) {
        console.error('[payload-ai-image] upload error:', err)
        alert('Görsel yüklenirken hata oluştu: ' + (err instanceof Error ? err.message : String(err)))
      }
    },
    [field],
  )

  return (
    <div style={{ marginTop: 8 }}>
      <AiImageButton
        onApprove={handleApprove}
        defaultAspectRatio={defaultAspectRatio}
        apiBasePath={apiBasePath}
        maxRevisions={maxRevisions}
      />
    </div>
  )
}
