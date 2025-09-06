import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ScrollSync } from './scrollSync'

// Mock EditorView
const mockView = {
  scrollDOM: {
    getBoundingClientRect: vi.fn(() => ({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
      right: 800,
      bottom: 600
    }))
  },
  coordsAtPos: vi.fn()
}

describe('ScrollSync', () => {
  let scrollSync: ScrollSync

  beforeEach(() => {
    vi.clearAllMocks()
    scrollSync = new ScrollSync(mockView as any, 36)
  })

  describe('basic suppression', () => {
    it('should suppress scroll events for specified duration', () => {
      const now = Date.now()
      
      scrollSync.suppress(150)
      
      expect(scrollSync.isSimplySuppressed(now)).toBe(true)
      expect(scrollSync.isSimplySuppressed(now + 100)).toBe(true)
      expect(scrollSync.isSimplySuppressed(now + 200)).toBe(false)
    })

    it('should release suppression after timeout', () => {
      const now = Date.now()
      
      scrollSync.suppress(150)
      
      expect(scrollSync.maybeRelease(now + 100)).toBe(false)
      expect(scrollSync.maybeRelease(now + 200)).toBe(true)
    })
  })

  describe('target-based suppression', () => {
    it('should suppress until target position is reached', () => {
      const now = Date.now()
      const targetPos = 1000
      
      // Mock coordsAtPos to return target coordinates far from viewport center (y=300)
      // Viewport center is at (400, 300), target at y=500, distance = 200px > 36px calm band
      mockView.coordsAtPos.mockReturnValue({ top: 500, left: 0, right: 100, bottom: 520 })
      
      scrollSync.suppressUntilTarget(targetPos, 800)
      
      expect(scrollSync.isSimplySuppressed(now)).toBe(false) // It's target-based, not simple
      expect(scrollSync.maybeRelease(now)).toBe(false) // Not within calm band yet
    })

    it('should release when target is within calm band', () => {
      const now = Date.now()
      const targetPos = 1000
      
      // Mock viewport center at y=300, target at y=320 (within 36px calm band)
      mockView.coordsAtPos.mockReturnValue({ top: 320, left: 0, right: 100, bottom: 340 })
      
      scrollSync.suppressUntilTarget(targetPos, 800)
      
      expect(scrollSync.maybeRelease(now)).toBe(true) // Within calm band
    })

    it('should release after timeout even if target not reached', () => {
      const now = Date.now()
      const targetPos = 1000
      
      // Mock target far from viewport center (outside calm band)
      mockView.coordsAtPos.mockReturnValue({ top: 500, left: 0, right: 100, bottom: 520 })
      
      scrollSync.suppressUntilTarget(targetPos, 800)
      
      expect(scrollSync.maybeRelease(now + 100)).toBe(false)
      expect(scrollSync.maybeRelease(now + 900)).toBe(true) // Timeout reached
    })

    it('should handle null coordsAtPos gracefully', () => {
      const now = Date.now()
      const targetPos = 1000
      
      mockView.coordsAtPos.mockReturnValue(null)
      
      scrollSync.suppressUntilTarget(targetPos, 800)
      
      expect(scrollSync.maybeRelease(now + 100)).toBe(false)
      expect(scrollSync.maybeRelease(now + 900)).toBe(true) // Falls back to timeout
    })
  })

  describe('calm band calculations', () => {
    it('should use custom calm band size', () => {
      const customScrollSync = new ScrollSync(mockView as any, 50)
      const now = Date.now()
      const targetPos = 1000
      
      // Mock viewport center at y=300, target at y=340 (40px away)
      mockView.coordsAtPos.mockReturnValue({ top: 340, left: 0, right: 100, bottom: 360 })
      
      customScrollSync.suppressUntilTarget(targetPos, 800)
      
      // Should be within 50px calm band
      expect(customScrollSync.maybeRelease(now)).toBe(true)
    })

    it('should calculate distance correctly for different viewport positions', () => {
      const now = Date.now()
      const targetPos = 1000
      
      // Mock different viewport rect
      mockView.scrollDOM.getBoundingClientRect.mockReturnValue({
        left: 100,
        top: 200,
        width: 600,
        height: 400,
        right: 700,
        bottom: 600
      })
      
      // Viewport center would be at (400, 400), target at y=430 (30px away)
      mockView.coordsAtPos.mockReturnValue({ top: 430, left: 0, right: 100, bottom: 450 })
      
      scrollSync.suppressUntilTarget(targetPos, 800)
      
      expect(scrollSync.maybeRelease(now)).toBe(true) // 30px < 36px calm band
    })
  })

  describe('state management', () => {
    it('should handle target release behavior', () => {
      const now = Date.now()
      const targetPos = 1000
      
      // Mock target well within calm band
      mockView.coordsAtPos.mockReturnValue({ top: 305, left: 0, right: 100, bottom: 325 })
      
      scrollSync.suppressUntilTarget(targetPos, 800)
      
      // Test that target-based suppression behaves correctly
      expect(scrollSync.isSimplySuppressed(now)).toBe(false) // It's target-based
    })

    it('should handle multiple suppress calls correctly', () => {
      const now = Date.now()
      
      scrollSync.suppress(100)
      expect(scrollSync.isSimplySuppressed(now + 50)).toBe(true)
      
      scrollSync.suppress(200) // Extends suppression
      expect(scrollSync.isSimplySuppressed(now + 150)).toBe(true)
      
      scrollSync.suppressUntilTarget(1000, 300) // Switches to target mode
      expect(scrollSync.isSimplySuppressed(now + 100)).toBe(false) // No longer simple suppression
    })
  })
})