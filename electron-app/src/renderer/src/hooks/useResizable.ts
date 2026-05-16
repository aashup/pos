import { useState, useRef, useEffect, useCallback } from 'react'

export function useResizable(
  storageKey: string,
  defaultWidth: number,
  min: number,
  max: number,
  inverted = false,
) {
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem(storageKey)
    if (!saved) return defaultWidth
    const n = parseInt(saved, 10)
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defaultWidth
  })

  const widthRef = useRef(width)
  widthRef.current = width

  useEffect(() => {
    localStorage.setItem(storageKey, String(width))
  }, [storageKey, width])

  const startResize = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault()
      const startX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const startW = widthRef.current

      const onMove = (ev: MouseEvent | TouchEvent) => {
        const x =
          'touches' in ev
            ? (ev as TouchEvent).touches[0].clientX
            : (ev as MouseEvent).clientX
        const delta = inverted ? startX - x : x - startX
        setWidth(Math.min(max, Math.max(min, startW + delta)))
      }

      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        document.removeEventListener('touchmove', onMove)
        document.removeEventListener('touchend', onUp)
      }

      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
      document.addEventListener('touchmove', onMove, { passive: false })
      document.addEventListener('touchend', onUp)
    },
    [min, max],
  )

  return { width, startResize }
}
