// src/core/outlineIndex.test.ts
import { OutlineIndex } from './outlineCore';
import type { Heading } from './outlineParser';

describe('OutlineIndex', () => {
  const headings: Heading[] = [
    { id: 'intro', text: 'Introduction', level: 1, offset: 0 },
    { id: 'section-1', text: 'Section 1', level: 2, offset: 100 },
    { id: 'section-2', text: 'Section 2', level: 2, offset: 200 },
    { id: 'conclusion', text: 'Conclusion', level: 1, offset: 300 }
  ];
  
  const index = new OutlineIndex(headings);

  describe('nearestByOffset', () => {
    it('should return correct heading when caret == heading.offset', () => {
      expect(index.nearestByOffset(0)).toBe(0);    // exactly at intro
      expect(index.nearestByOffset(100)).toBe(1);  // exactly at section-1
      expect(index.nearestByOffset(200)).toBe(2);  // exactly at section-2
      expect(index.nearestByOffset(300)).toBe(3);  // exactly at conclusion
    });

    it('should return correct heading when caret between headings', () => {
      expect(index.nearestByOffset(50)).toBe(1);   // between intro and section-1 → section-1
      expect(index.nearestByOffset(150)).toBe(2);  // between section-1 and section-2 → section-2
      expect(index.nearestByOffset(250)).toBe(3);  // between section-2 and conclusion → conclusion
    });

    it('should handle edge cases', () => {
      expect(index.nearestByOffset(-10)).toBe(0);  // before first heading → index 0
      expect(index.nearestByOffset(1000)).toBe(3); // after last heading → last index
    });

    it('should maintain monotonicity', () => {
      // Increasing caret position should never decrease returned index
      let prevIndex = -1;
      for (let pos = -50; pos <= 400; pos += 10) {
        const currentIndex = index.nearestByOffset(pos);
        expect(currentIndex).toBeGreaterThanOrEqual(prevIndex);
        prevIndex = currentIndex;
      }
    });
  });

  describe('item access by ID', () => {
    it('should return correct IDs for boundary positions', () => {
      expect(index.items[index.nearestByOffset(0)].id).toBe('intro');
      expect(index.items[index.nearestByOffset(100)].id).toBe('section-1');
      expect(index.items[index.nearestByOffset(200)].id).toBe('section-2');
      expect(index.items[index.nearestByOffset(300)].id).toBe('conclusion');
    });

    it('should return correct IDs for intermediate positions', () => {
      expect(index.items[index.nearestByOffset(50)].id).toBe('section-1');
      expect(index.items[index.nearestByOffset(150)].id).toBe('section-2');
      expect(index.items[index.nearestByOffset(250)].id).toBe('conclusion');
      expect(index.items[index.nearestByOffset(350)].id).toBe('conclusion');
    });

    it('should handle empty outline', () => {
      const emptyIndex = new OutlineIndex([]);
      expect(emptyIndex.nearestByOffset(100)).toBe(-1);
    });
  });

  describe('randomized tests', () => {
    it('should maintain monotonicity with random headings', () => {
      // Generate random heading positions
      const randomHeadings: Heading[] = Array.from({ length: 20 }, (_, i) => ({
        id: `heading-${i}`,
        text: `Heading ${i}`,
        level: Math.floor(Math.random() * 6) + 1,
        offset: Math.floor(Math.random() * 1000) + i * 50 // Ensure sorted
      })).sort((a, b) => a.offset - b.offset);

      const randomIndex = new OutlineIndex(randomHeadings);
      
      let prevIdx = -1;
      for (let pos = 0; pos <= 1500; pos += 25) {
        const currentIdx = randomIndex.nearestByOffset(pos);
        expect(currentIdx).toBeGreaterThanOrEqual(prevIdx);
        expect(currentIdx).toBeGreaterThanOrEqual(0);
        expect(currentIdx).toBeLessThan(randomHeadings.length);
        prevIdx = currentIdx;
      }
    });
  });
});