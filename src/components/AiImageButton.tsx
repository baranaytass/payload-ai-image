'use client'

import React, { useState, useCallback, useRef } from 'react'
import type { ImageAspectRatio } from '../types.js'

interface AiImageButtonProps {
  /** Called when user approves a generated image — receives the remote URL */
  onApprove: (imageUrl: string, prompt: string) => void
  /** Aspect ratio options to show */
  aspectRatios?: ImageAspectRatio[]
  /** Default aspect ratio */
  defaultAspectRatio?: ImageAspectRatio
  /** API base path — defaults to /api/ai-image */
  apiBasePath?: string
  /** Max revisions allowed */
  maxRevisions?: number
}

type Step = 'idle' | 'input' | 'optimizing' | 'generating' | 'review' | 'error'

interface GenerationResult {
  imageUrl: string
  optimizedPrompt: string
  revisedPrompt?: string
  explanation: string
}

const ASPECT_LABELS: Record<ImageAspectRatio, string> = {
  '1:1': 'Kare (1:1)',
  '16:9': 'Geniş (16:9)',
  '4:3': 'Standart (4:3)',
  '3:2': 'Fotoğraf (3:2)',
  '9:16': 'Dikey (9:16)',
}

export function AiImageButton({
  onApprove,
  aspectRatios = ['16:9', '1:1', '4:3', '3:2', '9:16'],
  defaultAspectRatio = '16:9',
  apiBasePath = '/api/ai-image',
  maxRevisions = 5,
}: AiImageButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState<Step>('idle')
  const [userPrompt, setUserPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>(defaultAspectRatio)
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [revisionPrompt, setRevisionPrompt] = useState('')
  const [revisionCount, setRevisionCount] = useState(0)
  const [error, setError] = useState('')
  const [showOptimized, setShowOptimized] = useState(false)
  const promptRef = useRef<HTMLTextAreaElement>(null)

  const reset = useCallback(() => {
    setStep('idle')
    setUserPrompt('')
    setRevisionPrompt('')
    setResult(null)
    setError('')
    setRevisionCount(0)
    setShowOptimized(false)
  }, [])

  const open = useCallback(() => {
    reset()
    setIsOpen(true)
    setStep('input')
    setTimeout(() => promptRef.current?.focus(), 50)
  }, [reset])

  const close = useCallback(() => {
    setIsOpen(false)
    reset()
  }, [reset])

  const generate = useCallback(async (prompt: string, skipOptimization = false) => {
    setError('')
    setStep('generating')

    try {
      const res = await fetch(`${apiBasePath}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPrompt: prompt, aspectRatio, skipOptimization }),
      })

      if (!res.ok) {
        const data = await res.json() as { error: string }
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }

      const data = await res.json() as GenerationResult
      setResult(data)
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Görsel üretilemedi')
      setStep('error')
    }
  }, [aspectRatio, apiBasePath])

  const handleGenerate = useCallback(() => {
    if (!userPrompt.trim()) return
    generate(userPrompt)
  }, [userPrompt, generate])

  const handleRevise = useCallback(() => {
    if (!revisionPrompt.trim() || revisionCount >= maxRevisions) return
    setRevisionCount(c => c + 1)
    setRevisionPrompt('')
    generate(revisionPrompt)
  }, [revisionPrompt, revisionCount, maxRevisions, generate])

  const handleApprove = useCallback(() => {
    if (!result) return
    onApprove(result.imageUrl, result.optimizedPrompt)
    close()
  }, [result, onApprove, close])

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={open}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 14px',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 1px 3px rgba(99,102,241,0.4)',
          transition: 'opacity 0.15s',
        }}
        onMouseOver={e => (e.currentTarget.style.opacity = '0.9')}
        onMouseOut={e => (e.currentTarget.style.opacity = '1')}
      >
        <SparkleIcon />
        AI ile Görsel Üret
      </button>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={close}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          zIndex: 9998, backdropFilter: 'blur(2px)',
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(680px, 96vw)',
          maxHeight: '92vh',
          background: '#fff',
          borderRadius: '16px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 16px',
          borderBottom: '1px solid #f0f0f0',
          background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SparkleIcon size={20} color="#6366f1" />
            <span style={{ fontWeight: 700, fontSize: 16, color: '#1f1f1f' }}>
              AI Görsel Üretici
            </span>
            {revisionCount > 0 && (
              <span style={{
                background: '#e0e7ff', color: '#4338ca',
                fontSize: 11, fontWeight: 600,
                padding: '2px 8px', borderRadius: 99,
              }}>
                Revizyon {revisionCount}/{maxRevisions}
              </span>
            )}
          </div>
          <button onClick={close} style={closeButtonStyle}>✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>

          {/* ── INPUT STEP ── */}
          {(step === 'input' || step === 'error') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Ne üretmek istiyorsunuz?</label>
                <textarea
                  ref={promptRef}
                  value={userPrompt}
                  onChange={e => setUserPrompt(e.target.value)}
                  placeholder="Örnek: bahçe tasarımı, Akdeniz bitkileri, yaz sabahı..."
                  rows={3}
                  style={textareaStyle}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate()
                  }}
                />
                <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                  Kısa ve öz yazın — AI context'i otomatik ekler. ⌘+Enter ile üret.
                </p>
              </div>

              <div>
                <label style={labelStyle}>En-Boy Oranı</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {aspectRatios.map(ar => (
                    <button
                      key={ar}
                      type="button"
                      onClick={() => setAspectRatio(ar)}
                      style={{
                        ...aspectButtonStyle,
                        background: aspectRatio === ar ? '#6366f1' : '#f3f4f6',
                        color: aspectRatio === ar ? '#fff' : '#374151',
                        borderColor: aspectRatio === ar ? '#6366f1' : '#e5e7eb',
                      }}
                    >
                      {ASPECT_LABELS[ar]}
                    </button>
                  ))}
                </div>
              </div>

              {step === 'error' && (
                <div style={errorBoxStyle}>
                  <strong>Hata:</strong> {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleGenerate}
                disabled={!userPrompt.trim()}
                style={primaryButtonStyle(!userPrompt.trim())}
              >
                <SparkleIcon />
                Görsel Üret
              </button>
            </div>
          )}

          {/* ── GENERATING STEP ── */}
          {step === 'generating' && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={spinnerStyle} />
              <p style={{ marginTop: 20, fontWeight: 600, color: '#374151' }}>
                Görsel üretiliyor...
              </p>
              <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>
                Bu 15–30 saniye sürebilir
              </p>
            </div>
          )}

          {/* ── REVIEW STEP ── */}
          {step === 'review' && result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Generated image */}
              <div style={{
                borderRadius: 12, overflow: 'hidden',
                border: '2px solid #e0e7ff',
                background: '#f5f3ff',
              }}>
                <img
                  src={result.imageUrl}
                  alt="AI Generated"
                  style={{ width: '100%', display: 'block', maxHeight: 340, objectFit: 'contain' }}
                />
              </div>

              {/* Prompt info */}
              <div
                onClick={() => setShowOptimized(s => !s)}
                style={{
                  background: '#f9fafb', border: '1px solid #e5e7eb',
                  borderRadius: 8, padding: '10px 14px', cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>
                    Optimize edilmiş prompt {showOptimized ? '▲' : '▼'}
                  </span>
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>{result.explanation}</span>
                </div>
                {showOptimized && (
                  <p style={{ fontSize: 12, color: '#374151', marginTop: 8, lineHeight: 1.5 }}>
                    {result.revisedPrompt ?? result.optimizedPrompt}
                  </p>
                )}
              </div>

              {/* Revision input */}
              {revisionCount < maxRevisions && (
                <div>
                  <label style={labelStyle}>
                    Revize et ({maxRevisions - revisionCount} hak kaldı)
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      value={revisionPrompt}
                      onChange={e => setRevisionPrompt(e.target.value)}
                      placeholder="Daha açık, daha yeşil, gündüz sahnesi..."
                      style={inputStyle}
                      onKeyDown={e => { if (e.key === 'Enter') handleRevise() }}
                    />
                    <button
                      type="button"
                      onClick={handleRevise}
                      disabled={!revisionPrompt.trim()}
                      style={{ ...primaryButtonStyle(!revisionPrompt.trim()), whiteSpace: 'nowrap', padding: '0 16px' }}
                    >
                      Yeniden Üret
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'review' && result && (
          <div style={{
            padding: '14px 24px',
            borderTop: '1px solid #f0f0f0',
            display: 'flex', gap: 10, justifyContent: 'flex-end',
            background: '#fafafa',
          }}>
            <button type="button" onClick={close} style={secondaryButtonStyle}>
              İptal
            </button>
            <button type="button" onClick={handleApprove} style={approveButtonStyle}>
              ✓ Görseli Kullan
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600,
  color: '#374151', marginBottom: 6,
}

const textareaStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px',
  border: '1.5px solid #e5e7eb', borderRadius: 8,
  fontSize: 14, lineHeight: 1.5, resize: 'vertical',
  outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit',
  transition: 'border-color 0.15s',
}

const inputStyle: React.CSSProperties = {
  flex: 1, padding: '10px 12px',
  border: '1.5px solid #e5e7eb', borderRadius: 8,
  fontSize: 13, outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const aspectButtonStyle: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 6,
  border: '1.5px solid', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', transition: 'all 0.15s',
}

const primaryButtonStyle = (disabled: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '11px 20px', borderRadius: 8, border: 'none',
  background: disabled ? '#d1d5db' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  color: disabled ? '#9ca3af' : '#fff',
  fontWeight: 700, fontSize: 14, cursor: disabled ? 'not-allowed' : 'pointer',
  width: '100%', transition: 'opacity 0.15s',
})

const secondaryButtonStyle: React.CSSProperties = {
  padding: '9px 18px', borderRadius: 8,
  border: '1.5px solid #e5e7eb', background: '#fff',
  color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer',
}

const approveButtonStyle: React.CSSProperties = {
  padding: '9px 20px', borderRadius: 8, border: 'none',
  background: '#16a34a', color: '#fff',
  fontWeight: 700, fontSize: 13, cursor: 'pointer',
  boxShadow: '0 1px 3px rgba(22,163,74,0.4)',
}

const closeButtonStyle: React.CSSProperties = {
  background: 'none', border: 'none',
  color: '#9ca3af', fontSize: 18, cursor: 'pointer',
  padding: '4px 8px', borderRadius: 4,
  lineHeight: 1, transition: 'color 0.15s',
}

const errorBoxStyle: React.CSSProperties = {
  background: '#fef2f2', border: '1px solid #fecaca',
  color: '#dc2626', padding: '10px 14px',
  borderRadius: 8, fontSize: 13,
}

const spinnerStyle: React.CSSProperties = {
  width: 44, height: 44, margin: '0 auto',
  border: '4px solid #e0e7ff',
  borderTopColor: '#6366f1',
  borderRadius: '50%',
  animation: 'ai-spin 0.8s linear infinite',
}

// ── Icons ──────────────────────────────────────────────────────────────────

function SparkleIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
      <path d="M19 3l.75 2.25L22 6l-2.25.75L19 9l-.75-2.25L16 6l2.25-.75z" />
      <path d="M5 15l.75 2.25L8 18l-2.25.75L5 21l-.75-2.25L2 18l2.25-.75z" />
    </svg>
  )
}
