import { describe, it, expect } from 'vitest'
import { normalizeEOL } from './eol'

describe('normalizeEOL', () => {
  it('should normalize Windows line endings (CRLF) to Unix (LF)', () => {
    const input = 'line1\r\nline2\r\nline3'
    const expected = 'line1\nline2\nline3'
    
    expect(normalizeEOL(input)).toBe(expected)
  })

  it('should normalize old Mac line endings (CR) to Unix (LF)', () => {
    const input = 'line1\rline2\rline3'
    const expected = 'line1\nline2\nline3'
    
    expect(normalizeEOL(input)).toBe(expected)
  })

  it('should leave Unix line endings (LF) unchanged', () => {
    const input = 'line1\nline2\nline3'
    const expected = 'line1\nline2\nline3'
    
    expect(normalizeEOL(input)).toBe(expected)
  })

  it('should handle mixed line endings', () => {
    const input = 'line1\r\nline2\nline3\rline4'
    const expected = 'line1\nline2\nline3\nline4'
    
    expect(normalizeEOL(input)).toBe(expected)
  })

  it('should handle empty string', () => {
    expect(normalizeEOL('')).toBe('')
  })

  it('should handle string with no line endings', () => {
    const input = 'single line with no breaks'
    expect(normalizeEOL(input)).toBe(input)
  })

  it('should handle string with only line endings', () => {
    expect(normalizeEOL('\r\n\r\n')).toBe('\n\n')
    expect(normalizeEOL('\r\r')).toBe('\n\n')
    expect(normalizeEOL('\n\n')).toBe('\n\n')
  })

  it('should handle complex mixed content', () => {
    const input = `# Title\r\n\r\nSome content\nMore content\r\n\rFinal line`
    const expected = `# Title\n\nSome content\nMore content\n\nFinal line`
    
    expect(normalizeEOL(input)).toBe(expected)
  })

  it('should preserve content while normalizing line endings', () => {
    const input = 'Hello\r\nWorld\rHow\nAre\r\nYou?'
    const result = normalizeEOL(input)
    
    // Should contain all original content
    expect(result).toContain('Hello')
    expect(result).toContain('World')
    expect(result).toContain('How')
    expect(result).toContain('Are')
    expect(result).toContain('You?')
    
    // Should only have Unix line endings
    expect(result).not.toContain('\r')
    expect(result.split('\n')).toHaveLength(5)
  })
})