import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import methodology from '../../../docs/methodology.md?raw'
import { blocks, Markdown, sections } from './markdown'

describe('markdown', () => {
  it('finds the sections the Method page shows in docs/methodology.md', () => {
    const numbers = sections(methodology).map((s) => s.number)
    expect(numbers).toEqual(expect.arrayContaining(['6', '8', '9']))
    expect(sections(methodology).find((s) => s.number === '8')?.title).toBe('Plain-language method')
  })

  it('joins indented continuation lines into the list item', () => {
    const b = blocks('1. **First** item\n   goes on.\n2. Second')
    expect(b).toEqual([{ kind: 'ol', items: ['**First** item goes on.', 'Second'] }])
  })

  it('renders bold, code and https links, never raw HTML', () => {
    render(<Markdown body={'A **bold** `code` [DOI](https://doi.org/x) <script>x</script>'} />)
    expect(screen.getByText('bold').tagName).toBe('STRONG')
    expect(screen.getByText('code').tagName).toBe('CODE')
    expect(screen.getByRole('link', { name: 'DOI' })).toHaveAttribute('href', 'https://doi.org/x')
    expect(document.querySelector('script')).toBeNull()
  })
})
