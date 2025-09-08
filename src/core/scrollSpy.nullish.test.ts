import { describe, it, expect } from 'vitest';
import { isNullish } from '../cmScrollSpy';

describe('scrollSpy nullish guard', () => {
  it('treats 0 as valid and null/undefined as invalid', () => {
    expect(isNullish(0 as unknown as number)).toBe(false);
    expect(isNullish(null as unknown as number | null)).toBe(true);
    expect(isNullish(undefined as unknown as number | undefined)).toBe(true);
  });
});