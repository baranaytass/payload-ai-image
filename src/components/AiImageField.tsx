'use client'

import React, { useCallback } from 'react'
import { AiImageButton } from './AiImageButton.js'
import type { ImageAspectRatio } from '../types.js'

interface AiImageFieldProps {
  /** Payload's useField hook — injected by the custom field component */
  field: {
    setValue: (value: unknown) => void
    value: unknown
  }
  defaultAspectRatio?: ImageAspectRatio
  apiBasePath?: string
  maxRevisions?: number
}

/**
 * Wraps the AiImageButton and connects it to a Payload upload field via setValue.
 * When the user approves a generated image, the remote URL is set as the field value.
 * The Media collection's beforeChange hook will download and store the image.
 */
export function AiImageField({
  field,
  defaultAspectRatio,
  apiBasePath,
  maxRevisions,
}: AiImageFieldProps) {
  const handleApprove = useCallback(
    (imageUrl: string, _prompt: string) => {
      // Set the remote URL — Payload's upload system will handle the rest
      field.setValue(imageUrl)
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
