import { describe, it, expect } from 'vitest'
import { OutlineIndex } from './outlineCore'
import type { Heading } from './outlineParser'

describe('OutlineIndex', () => {
  const headings: Heading[] = [
    { id: 'intro', text: 'Introduction', level: 1, offset: 0 },
    { id: 'section-1', text: 'Section 1', level: 2, offset: 100 },
    { id: 'section-2', text: 'Section 2', level: 2, offset: 200 },
    { id: 'conclusion', text: 'Conclusion', level: 1, offset: 300 }
  ]
  
  const index = new OutlineIndex(headings)

  describe('indexAtOrBefore', () => {
    it('should return correct index when offset exactly matches heading position', () => {
      expect(index.indexAtOrBefore(0)).toBe(0)    // exactly at intro
      expect(index.indexAtOrBefore(100)).toBe(1)  // exactly at section-1
      expect(index.indexAtOrBefore(200)).toBe(2)  // exactly at section-2
      expect(index.indexAtOrBefore(300)).toBe(3)  // exactly at conclusion
    })

    it('should return correct index when offset is between headings', () => {
      expect(index.indexAtOrBefore(50)).toBe(0)   // between intro and section-1 → intro
      expect(index.indexAtOrBefore(150)).toBe(1)  // between section-1 and section-2 → section-1
      expect(index.indexAtOrBefore(250)).toBe(2)  // between section-2 and conclusion → section-2
    })

    it('should handle edge cases correctly', () => {
      expect(index.indexAtOrBefore(-10)).toBe(0)  // before first heading → first index
      expect(index.indexAtOrBefore(1000)).toBe(3) // after last heading → last index
    })

    it('should maintain stability (no jumping between headings)', () => {
      // Test the "at or before" behavior prevents outline jumping
      let prevIndex = -1
      for (let pos = -50; pos <= 400; pos += 5) {
        const currentIndex = index.indexAtOrBefore(pos)
        expect(currentIndex).toBeGreaterThanOrEqual(prevIndex)
        expect(currentIndex).toBeGreaterThanOrEqual(0)
        expect(currentIndex).toBeLessThan(headings.length)
        prevIndex = currentIndex
      }
    })
  })

  describe('idAtOrBefore', () => {
    it('should return correct heading IDs for boundary positions', () => {
      expect(index.idAtOrBefore(0)).toBe('intro')
      expect(index.idAtOrBefore(100)).toBe('section-1')
      expect(index.idAtOrBefore(200)).toBe('section-2')
      expect(index.idAtOrBefore(300)).toBe('conclusion')
    })

    it('should return correct heading IDs for intermediate positions', () => {
      expect(index.idAtOrBefore(50)).toBe('intro')
      expect(index.idAtOrBefore(150)).toBe('section-1')
      expect(index.idAtOrBefore(250)).toBe('section-2')
      expect(index.idAtOrBefore(350)).toBe('conclusion')
    })

    it('should handle empty outline gracefully', () => {
      const emptyIndex = new OutlineIndex([])
      expect(emptyIndex.indexAtOrBefore(100)).toBe(-1)
      expect(emptyIndex.idAtOrBefore(100)).toBe(null)
    })

    it('should handle single heading', () => {
      const singleIndex = new OutlineIndex([headings[0]])
      expect(singleIndex.idAtOrBefore(0)).toBe('intro')
      expect(singleIndex.idAtOrBefore(50)).toBe('intro')
      expect(singleIndex.idAtOrBefore(-10)).toBe('intro')
    })
  })

  describe('binary search correctness', () => {
    it('should work with pre-sorted headings', () => {
      const sortedHeadings: Heading[] = [
        { id: 'h1', text: 'First', level: 1, offset: 100 },
        { id: 'h2', text: 'Second', level: 1, offset: 200 },
        { id: 'h3', text: 'Third', level: 1, offset: 300 },
      ]
      
      const sortedIndex = new OutlineIndex(sortedHeadings)
      expect(sortedIndex.idAtOrBefore(150)).toBe('h1')  // Between first and second
      expect(sortedIndex.idAtOrBefore(250)).toBe('h2')  // Between second and third
      expect(sortedIndex.idAtOrBefore(350)).toBe('h3')  // After third
    })

    it('should handle large number of headings efficiently', () => {
      const manyHeadings: Heading[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `heading-${i}`,
        text: `Heading ${i}`,
        level: 1,
        offset: i * 100
      }))
      
      const largeIndex = new OutlineIndex(manyHeadings)
      
      // Test performance and correctness
      expect(largeIndex.idAtOrBefore(50000)).toBe('heading-500')
      expect(largeIndex.idAtOrBefore(99950)).toBe('heading-999')
      expect(largeIndex.idAtOrBefore(0)).toBe('heading-0')
    })
  })
})