import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { GLOSSARY } from '../../services/glossary'
import { Term } from './Term'

describe('Term', () => {
  it('describes the term for screen readers and shows it on hover', async () => {
    render(<Term id="p_value">p-value</Term>)
    const button = screen.getByRole('button', { name: 'p-value' })
    expect(button).toHaveAccessibleDescription(new RegExp(GLOSSARY.p_value.text.slice(0, 30)))
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    await userEvent.hover(button)
    expect(screen.getByRole('tooltip')).toBeVisible()
    await userEvent.unhover(button)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('opens on tap and closes with Escape', async () => {
    render(<Term id="sen_slope" />)
    const button = screen.getByRole('button', { name: "Sen's slope" })
    await userEvent.click(button)
    await userEvent.unhover(button)
    expect(screen.getByRole('tooltip')).toBeVisible()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('never contains a number other than fixed method values', () => {
    for (const { text } of Object.values(GLOSSARY)) {
      const numbers = text.match(/\d+(?:\.\d+)?/g) ?? []
      for (const n of numbers) expect(['95', '0.05', '3', '33', '2014']).toContain(n)
    }
  })
})
