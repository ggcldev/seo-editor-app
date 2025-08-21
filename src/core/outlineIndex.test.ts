// src/core/outlineIndex.test.ts
import { OutlineIndex } from './outlineIndex';

describe('OutlineIndex', () => {
  const headings = [
    { id: 'intro', pos: 0 },
    { id: 'section-1', pos: 100 },
    { id: 'section-2', pos: 200 },
    { id: 'conclusion', pos: 300 }
  ];
  
  const index = new OutlineIndex(headings);

  describe('atOrBefore', () => {
    it('should return correct heading when caret == heading.pos', () => {
      expect(index.atOrBefore(0)).toBe(0);    // exactly at intro
      expect(index.atOrBefore(100)).toBe(1);  // exactly at section-1
      expect(index.atOrBefore(200)).toBe(2);  // exactly at section-2
      expect(index.atOrBefore(300)).toBe(3);  // exactly at conclusion
    });

    it('should return correct heading when caret between headings', () => {
      expect(index.atOrBefore(50)).toBe(0);   // between intro and section-1 → intro
      expect(index.atOrBefore(150)).toBe(1);  // between section-1 and section-2 → section-1
      expect(index.atOrBefore(250)).toBe(2);  // between section-2 and conclusion → section-2
    });

    it('should handle edge cases', () => {
      expect(index.atOrBefore(-10)).toBe(0);  // before first heading → index 0
      expect(index.atOrBefore(1000)).toBe(3); // after last heading → last index
    });

    it('should maintain monotonicity', () => {
      // Increasing caret position should never decrease returned index
      let prevIndex = -1;
      for (let pos = -50; pos <= 400; pos += 10) {
        const currentIndex = index.atOrBefore(pos);
        expect(currentIndex).toBeGreaterThanOrEqual(prevIndex);
        prevIndex = currentIndex;
      }
    });
  });

  describe('idAtOrBefore', () => {
    it('should return correct IDs for boundary positions', () => {
      expect(index.idAtOrBefore(0)).toBe('intro');
      expect(index.idAtOrBefore(100)).toBe('section-1');
      expect(index.idAtOrBefore(200)).toBe('section-2');
      expect(index.idAtOrBefore(300)).toBe('conclusion');
    });

    it('should return correct IDs for intermediate positions', () => {
      expect(index.idAtOrBefore(50)).toBe('intro');
      expect(index.idAtOrBefore(150)).toBe('section-1');
      expect(index.idAtOrBefore(250)).toBe('section-2');
      expect(index.idAtOrBefore(350)).toBe('conclusion');
    });

    it('should handle empty outline', () => {
      const emptyIndex = new OutlineIndex([]);
      expect(emptyIndex.idAtOrBefore(100)).toBeNull();
    });
  });

  describe('randomized tests', () => {
    it('should maintain monotonicity with random headings', () => {
      // Generate random heading positions
      const randomHeadings = Array.from({ length: 20 }, (_, i) => ({
        id: `heading-${i}`,
        pos: Math.floor(Math.random() * 1000) + i * 50 // Ensure sorted
      })).sort((a, b) => a.pos - b.pos);

      const randomIndex = new OutlineIndex(randomHeadings);
      
      let prevIdx = -1;
      for (let pos = 0; pos <= 1500; pos += 25) {
        const currentIdx = randomIndex.atOrBefore(pos);
        expect(currentIdx).toBeGreaterThanOrEqual(prevIdx);
        expect(currentIdx).toBeGreaterThanOrEqual(0);
        expect(currentIdx).toBeLessThan(randomHeadings.length);
        prevIdx = currentIdx;
      }
    });
  });
});