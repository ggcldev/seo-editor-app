import { describe, it, expect } from 'vitest'
import { parseOutline } from './outlineParser'

describe('outlineParser', () => {
  describe('ATX headings (# syntax)', () => {
    it('should parse basic ATX headings', () => {
      const markdown = `# Level 1
## Level 2
### Level 3`
      
      const result = parseOutline(markdown)
      
      expect(result).toHaveLength(3)
      expect(result[0]).toMatchObject({
        text: 'Level 1',
        level: 1,
        offset: 0
      })
      expect(result[1]).toMatchObject({
        text: 'Level 2',
        level: 2,
        offset: 10
      })
      expect(result[2]).toMatchObject({
        text: 'Level 3',
        level: 3,
        offset: 21
      })
    })

    it('should handle headings with trailing hashes', () => {
      const markdown = `# Heading 1 #
## Heading 2 ##`
      
      const result = parseOutline(markdown)
      
      expect(result).toHaveLength(2)
      expect(result[0].text).toBe('Heading 1')
      expect(result[1].text).toBe('Heading 2')
    })

    it('should handle headings with extra whitespace', () => {
      const markdown = `#    Spaced Heading    
##   Another One   `
      
      const result = parseOutline(markdown)
      
      expect(result).toHaveLength(2)
      expect(result[0].text).toBe('Spaced Heading')
      expect(result[1].text).toBe('Another One')
    })

    it('should generate stable IDs for headings', () => {
      const markdown = `# Hello World!
# Special @#$% Characters
# Duplicate Title
# Duplicate Title`
      
      const result = parseOutline(markdown)
      
      expect(result).toHaveLength(4)
      expect(result[0].id).toBe('hello-world')
      expect(result[1].id).toBe('special-characters')
      expect(result[2].id).toBe('duplicate-title')
      expect(result[3].id).toBe('duplicate-title-2')
    })
  })

  describe('Setext headings (underline syntax)', () => {
    it('should parse Setext level 1 headings', () => {
      const markdown = `Level 1 Heading
===============`
      
      const result = parseOutline(markdown)
      
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        text: 'Level 1 Heading',
        level: 1,
        offset: 0
      })
    })

    it('should parse Setext level 2 headings', () => {
      const markdown = `Level 2 Heading
---------------`
      
      const result = parseOutline(markdown)
      
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        text: 'Level 2 Heading',
        level: 2,
        offset: 0
      })
    })

    it('should handle mixed ATX and Setext headings', () => {
      const markdown = `# ATX Level 1

Setext Level 1
==============

## ATX Level 2

Setext Level 2
--------------

### ATX Level 3`
      
      const result = parseOutline(markdown)
      
      expect(result).toHaveLength(5)
      expect(result[0].text).toBe('ATX Level 1')
      expect(result[0].level).toBe(1)
      expect(result[1].text).toBe('Setext Level 1')
      expect(result[1].level).toBe(1)
      expect(result[2].text).toBe('ATX Level 2')
      expect(result[2].level).toBe(2)
      expect(result[3].text).toBe('Setext Level 2')
      expect(result[3].level).toBe(2)
      expect(result[4].text).toBe('ATX Level 3')
      expect(result[4].level).toBe(3)
    })
  })

  describe('edge cases', () => {
    it('should handle empty markdown', () => {
      expect(parseOutline('')).toEqual([])
      expect(parseOutline('   \n\n  ')).toEqual([])
    })

    it('should ignore headings in code blocks', () => {
      const markdown = `# Real Heading

\`\`\`
# Fake Heading in Code
\`\`\`

## Another Real Heading`
      
      const result = parseOutline(markdown)
      
      expect(result).toHaveLength(2)
      expect(result[0].text).toBe('Real Heading')
      expect(result[1].text).toBe('Another Real Heading')
    })

    it('should handle inline code in headings', () => {
      const markdown = `# Heading with \`code\`
## \`const\` variable = value`
      
      const result = parseOutline(markdown)
      
      expect(result).toHaveLength(2)
      expect(result[0].text).toBe('Heading with `code`')
      expect(result[1].text).toBe('`const` variable = value')
    })

    it('should handle very long headings', () => {
      const longText = 'A'.repeat(200)
      const markdown = `# ${longText}`
      
      const result = parseOutline(markdown)
      
      expect(result).toHaveLength(1)
      expect(result[0].text).toBe(longText)
    })

    it('should maintain correct offset positions', () => {
      const markdown = `Some content before

# First Heading
More content here

## Second Heading

Final content`
      
      const result = parseOutline(markdown)
      
      expect(result).toHaveLength(2)
      
      // Verify the headings appear at the correct character positions
      const firstHeadingPos = markdown.indexOf('# First Heading')
      const secondHeadingPos = markdown.indexOf('## Second Heading')
      
      expect(result[0].offset).toBe(firstHeadingPos)
      expect(result[1].offset).toBe(secondHeadingPos)
    })
  })

  describe('Unicode and international characters', () => {
    it('should handle Unicode characters in headings', () => {
      const markdown = `# 中文标题
## Título en Español
### Заголовок на русском
#### العنوان العربي`
      
      const result = parseOutline(markdown)
      
      expect(result).toHaveLength(4)
      expect(result[0].text).toBe('中文标题')
      expect(result[1].text).toBe('Título en Español')
      expect(result[2].text).toBe('Заголовок на русском')
      expect(result[3].text).toBe('العنوان العربي')
    })

    it('should generate appropriate IDs for Unicode text', () => {
      const markdown = `# 中文标题
# Emoji 🚀 Title`
      
      const result = parseOutline(markdown)
      
      expect(result).toHaveLength(2)
      // IDs are generated but may contain Unicode for international content
      expect(result[0].id).toBeDefined()
      expect(result[1].id).toBeDefined()
    })

    test('handles indented closing code fences', () => {
      const markdown = `# Before Code

\`\`\`javascript
# This should not be a heading
function test() {
    return true;
}
  \`\`\` 

# After Code`
      
      const result = parseOutline(markdown)
      
      expect(result).toHaveLength(2)
      expect(result[0].text).toBe('Before Code')
      expect(result[1].text).toBe('After Code')
    })
  })
})