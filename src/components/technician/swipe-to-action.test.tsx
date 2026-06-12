import { render, fireEvent, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SwipeToAction } from './swipe-to-action'

describe('SwipeToAction', () => {
  const originalSetPointerCapture = Element.prototype.setPointerCapture
  const originalReleasePointerCapture = Element.prototype.releasePointerCapture
  
  beforeEach(() => {
    // Mock getBoundingClientRect
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 300,
      height: 64,
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      x: 0,
      y: 0,
      toJSON: () => {}
    }))
    
    // Mock Element.clientWidth getter since we use it in component
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      value: 300
    })

    // Mock pointer capture methods
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
  })
  
  afterEach(() => {
    Element.prototype.setPointerCapture = originalSetPointerCapture
    Element.prototype.releasePointerCapture = originalReleasePointerCapture
  })

  it('renders track, thumb, and label', () => {
    render(<SwipeToAction onComplete={() => {}} />)
    
    expect(screen.getByText('Geser untuk Berangkat')).toBeInTheDocument()
    const thumb = screen.getByTestId('swipe-thumb')
    expect(thumb).toBeInTheDocument()
  })

  it('triggers onComplete when swiped past 80% threshold', async () => {
    const onComplete = vi.fn()
    render(<SwipeToAction onComplete={onComplete} />)
    
    const thumb = screen.getByTestId('swipe-thumb')
    
    // Simulate pointer down
    fireEvent.pointerDown(thumb, { clientX: 0, pointerId: 1 })
    
    // Simulate pointer move past 80% of (300 - 48(thumb) - 16(padding) = 236) -> 0.8 * 236 = 188.8
    // We use a high enough value to make sure it passes threshold
    fireEvent.pointerMove(thumb, { clientX: 200, pointerId: 1 })
    
    // Simulate pointer up
    fireEvent.pointerUp(thumb, { pointerId: 1 })
    
    await Promise.resolve()
    
    // Check if onComplete is called
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('resets thumb to start when released before 80% threshold', () => {
    const onComplete = vi.fn()
    render(<SwipeToAction onComplete={onComplete} />)
    
    const thumb = screen.getByTestId('swipe-thumb')
    
    // Simulate pointer down
    fireEvent.pointerDown(thumb, { clientX: 0, pointerId: 1 })
    
    // Simulate pointer move to ~40% (100px)
    fireEvent.pointerMove(thumb, { clientX: 100, pointerId: 1 })
    
    // Simulate pointer up
    fireEvent.pointerUp(thumb, { pointerId: 1 })
    
    // Should not trigger completion
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('does not trigger when disabled or loading', () => {
    const onComplete = vi.fn()
    const { rerender } = render(<SwipeToAction onComplete={onComplete} disabled />)
    
    const thumb = screen.getByTestId('swipe-thumb')
    fireEvent.pointerDown(thumb, { clientX: 0, pointerId: 1 })
    fireEvent.pointerMove(thumb, { clientX: 200, pointerId: 1 })
    fireEvent.pointerUp(thumb, { pointerId: 1 })
    
    expect(onComplete).not.toHaveBeenCalled()
    
    rerender(<SwipeToAction onComplete={onComplete} loading />)
    fireEvent.pointerDown(thumb, { clientX: 0, pointerId: 1 })
    fireEvent.pointerMove(thumb, { clientX: 200, pointerId: 1 })
    fireEvent.pointerUp(thumb, { pointerId: 1 })
    
    expect(onComplete).not.toHaveBeenCalled()
  })
})