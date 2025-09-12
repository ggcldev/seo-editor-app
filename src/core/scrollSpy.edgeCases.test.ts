import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { scrollSpyPlugin } from '../cmScrollSpy'
import type { Heading } from './outlineParser'

// Mock EditorView for testing
const createMockView = (overrides = {}) => ({
  scrollDOM: {
    getBoundingClientRect: vi.fn(() => ({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
      right: 800,
      bottom: 600
    })),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    ...overrides.scrollDOM
  },
  posAtCoords: vi.fn(() => 100),
  ...overrides
})

describe('ScrollSpy Edge Cases', () => {
  let mockOutline: Heading[]
  let mockOnActive: ReturnType<typeof vi.fn>
  
  beforeEach(() => {
    vi.clearAllMocks()
    mockOutline = [
      { id: 'h1', text: 'First', level: 1, offset: 0 },
      { id: 'h2', text: 'Second', level: 2, offset: 100 },
      { id: 'h3', text: 'Third', level: 1, offset: 200 }
    ]
    mockOnActive = vi.fn()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Viewport Size Edge Cases', () => {
    it('should handle extremely small viewports', () => {
      const mockView = createMockView({
        scrollDOM: {
          getBoundingClientRect: vi.fn(() => ({
            left: 0, top: 0, width: 50, height: 30, right: 50, bottom: 30
          })),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn()
        }
      })

      const { plugin } = scrollSpyPlugin(
        () => mockOutline,
        mockOnActive,
        'center'
      )

      expect(() => {
        const instance = plugin.create(mockView as any)
        instance.destroy()
      }).not.toThrow()
    })

    it('should handle extremely large viewports', () => {
      const mockView = createMockView({
        scrollDOM: {
          getBoundingClientRect: vi.fn(() => ({
            left: 0, top: 0, width: 5000, height: 3000, right: 5000, bottom: 3000
          })),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn()
        }
      })

      const { plugin } = scrollSpyPlugin(
        () => mockOutline,
        mockOnActive,
        'third'
      )

      expect(() => {
        const instance = plugin.create(mockView as any)
        instance.destroy()
      }).not.toThrow()
    })

    it('should clamp anchor position to sane bounds', () => {
      const mockView = createMockView({
        scrollDOM: {
          getBoundingClientRect: vi.fn(() => ({
            left: 0, top: 0, width: 800, height: 6000, right: 800, bottom: 6000
          })),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn()
        }
      })

      const { plugin } = scrollSpyPlugin(
        () => mockOutline,
        mockOnActive,
        'center'
      )

      const instance = plugin.create(mockView as any)
      
      // Simulate scroll - should not throw with large viewport
      const scrollHandler = mockView.scrollDOM.addEventListener.mock.calls
        .find(([event]) => event === 'scroll')?.[1]
      
      expect(() => scrollHandler?.()).not.toThrow()
      
      instance.destroy()
    })
  })

  describe('Rapid Interaction Edge Cases', () => {
    it('should handle rapid scroll events without race conditions', () => {
      vi.useFakeTimers()
      const mockView = createMockView()

      const { plugin } = scrollSpyPlugin(
        () => mockOutline,
        mockOnActive
      )

      const instance = plugin.create(mockView as any)
      const scrollHandler = mockView.scrollDOM.addEventListener.mock.calls
        .find(([event]) => event === 'scroll')?.[1]

      // Simulate rapid scrolling
      for (let i = 0; i < 100; i++) {
        scrollHandler?.()
      }

      // Should only call onActive after debouncing
      expect(mockOnActive).not.toHaveBeenCalled()

      // Fast forward all timers
      vi.runAllTimers()
      
      // Should have been called once after debouncing
      expect(mockOnActive).toHaveBeenCalledTimes(1)

      instance.destroy()
      vi.useRealTimers()
    })

    it('should handle suppression during rapid interactions', () => {
      vi.useFakeTimers()
      const mockView = createMockView()

      const { plugin, suppress } = scrollSpyPlugin(
        () => mockOutline,
        mockOnActive
      )

      const instance = plugin.create(mockView as any)
      
      // Suppress scroll spy
      suppress(mockView as any, 500)
      
      const scrollHandler = mockView.scrollDOM.addEventListener.mock.calls
        .find(([event]) => event === 'scroll')?.[1]

      // Scroll while suppressed
      scrollHandler?.()
      vi.runAllTimers()

      // Should not have been called while suppressed
      expect(mockOnActive).not.toHaveBeenCalled()

      // Fast forward past suppression period
      vi.advanceTimersByTime(600)
      scrollHandler?.()
      vi.runAllTimers()

      // Should work again after suppression
      expect(mockOnActive).toHaveBeenCalledTimes(1)

      instance.destroy()
      vi.useRealTimers()
    })
  })

  describe('Empty/Invalid State Edge Cases', () => {
    it('should handle empty outline gracefully', () => {
      const mockView = createMockView()

      const { plugin } = scrollSpyPlugin(
        () => [], // Empty outline
        mockOnActive
      )

      const instance = plugin.create(mockView as any)
      const scrollHandler = mockView.scrollDOM.addEventListener.mock.calls
        .find(([event]) => event === 'scroll')?.[1]

      expect(() => scrollHandler?.()).not.toThrow()
      expect(mockOnActive).not.toHaveBeenCalled()

      instance.destroy()
    })

    it('should handle posAtCoords returning null', () => {
      const mockView = createMockView({
        posAtCoords: vi.fn(() => null) // Simulate measurement failure
      })

      const { plugin } = scrollSpyPlugin(
        () => mockOutline,
        mockOnActive
      )

      const instance = plugin.create(mockView as any)
      const scrollHandler = mockView.scrollDOM.addEventListener.mock.calls
        .find(([event]) => event === 'scroll')?.[1]

      expect(() => scrollHandler?.()).not.toThrow()
      
      instance.destroy()
    })

    it('should handle getBoundingClientRect throwing', () => {
      const mockView = createMockView({
        scrollDOM: {
          getBoundingClientRect: vi.fn(() => {
            throw new Error('Measurement failed')
          }),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn()
        }
      })

      const { plugin } = scrollSpyPlugin(
        () => mockOutline,
        mockOnActive
      )

      const instance = plugin.create(mockView as any)
      const scrollHandler = mockView.scrollDOM.addEventListener.mock.calls
        .find(([event]) => event === 'scroll')?.[1]

      expect(() => scrollHandler?.()).not.toThrow()
      
      instance.destroy()
    })
  })

  describe('Memory and Performance Edge Cases', () => {
    it('should handle very large outline arrays efficiently', () => {
      const largeOutline: Heading[] = Array.from({ length: 10000 }, (_, i) => ({
        id: `h${i}`,
        text: `Heading ${i}`,
        level: (i % 6) + 1,
        offset: i * 100
      }))

      const mockView = createMockView()

      const { plugin } = scrollSpyPlugin(
        () => largeOutline,
        mockOnActive
      )

      const startTime = performance.now()
      const instance = plugin.create(mockView as any)
      
      const scrollHandler = mockView.scrollDOM.addEventListener.mock.calls
        .find(([event]) => event === 'scroll')?.[1]

      scrollHandler?.()
      
      const endTime = performance.now()
      expect(endTime - startTime).toBeLessThan(50) // Should be fast

      instance.destroy()
    })

    it('should properly clean up on destroy', () => {
      const mockView = createMockView()

      const { plugin } = scrollSpyPlugin(
        () => mockOutline,
        mockOnActive
      )

      const instance = plugin.create(mockView as any)
      
      // Verify event listeners were added
      expect(mockView.scrollDOM.addEventListener).toHaveBeenCalled()
      
      instance.destroy()
      
      // Verify cleanup was called
      expect(mockView.scrollDOM.removeEventListener).toHaveBeenCalled()
    })
  })

  describe('Browser Compatibility Edge Cases', () => {
    it('should handle browsers without scrollend support', () => {
      const mockScrollDOM = {
        getBoundingClientRect: vi.fn(() => ({
          left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600
        })),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }
      
      // Mock as HTMLElement without scrollend support
      delete (mockScrollDOM as any).onscrollend

      const mockView = createMockView({
        scrollDOM: mockScrollDOM
      })

      const { plugin } = scrollSpyPlugin(
        () => mockOutline,
        mockOnActive
      )

      const instance = plugin.create(mockView as any)
      
      // Should still work without scrollend
      const addEventListenerCalls = mockView.scrollDOM.addEventListener.mock.calls
      const hasScrollEndListener = addEventListenerCalls.some(([event]) => event === 'scrollend')
      
      expect(hasScrollEndListener).toBe(false)
      
      instance.destroy()
    })
  })

  describe('Hysteresis and Timing Edge Cases', () => {
    it('should prevent flickering with hysteresis', () => {
      vi.useFakeTimers()
      const mockView = createMockView()

      const _currentHeading = 0
      const getOutline = () => mockOutline
      
      // Mock posAtCoords to alternate between boundaries
      mockView.posAtCoords = vi.fn()
        .mockReturnValueOnce(99)  // Just before second heading
        .mockReturnValueOnce(101) // Just after second heading
        .mockReturnValueOnce(99)  // Back to before

      const { plugin } = scrollSpyPlugin(getOutline, mockOnActive)
      const instance = plugin.create(mockView as any)
      
      const scrollHandler = mockView.scrollDOM.addEventListener.mock.calls
        .find(([event]) => event === 'scroll')?.[1]

      // First scroll - should activate first heading
      scrollHandler?.()
      vi.runAllTimers()
      expect(mockOnActive).toHaveBeenCalledWith('h1', 'scroll')

      // Quick boundary crossing - should be suppressed by hysteresis
      vi.advanceTimersByTime(50) // Less than 90ms hysteresis
      scrollHandler?.()
      vi.runAllTimers()
      
      // Should not have changed due to hysteresis
      expect(mockOnActive).toHaveBeenCalledTimes(1)

      instance.destroy()
      vi.useRealTimers()
    })
  })
})