/**
 * BeforeAfterSlider — comparador deslizante de imagen original vs mejorada.
 *
 * La imagen "después" se recorta con clip-path según la posición del divisor;
 * ambas imágenes ocupan el mismo espacio, así el alineado es perfecto.
 * Se controla arrastrando con el ratón (pointer events).
 */
import { useCallback, useRef, useState } from 'react'

interface BeforeAfterSliderProps {
  beforeSrc: string
  afterSrc: string
  beforeLabel?: string
  afterLabel?: string
}

export function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  beforeLabel = 'Antes',
  afterLabel = 'Después'
}: BeforeAfterSliderProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState(50) // porcentaje 0..100

  const updateFromEvent = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const pct = ((clientX - rect.left) / rect.width) * 100
    setPosition(Math.max(2, Math.min(98, pct)))
  }, [])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      updateFromEvent(e.clientX)
    },
    [updateFromEvent]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (e.buttons === 1) updateFromEvent(e.clientX)
    },
    [updateFromEvent]
  )

  return (
    <div
      className="compare"
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
    >
      <img src={beforeSrc} alt={beforeLabel} draggable={false} />
      <div className="after" style={{ clipPath: `inset(0 0 0 ${position}%)` }}>
        <img src={afterSrc} alt={afterLabel} draggable={false} />
      </div>
      <div className="divider" style={{ left: `calc(${position}% - 1.5px)` }} />
      <span className="tag left">{beforeLabel}</span>
      <span className="tag right">{afterLabel}</span>
    </div>
  )
}
