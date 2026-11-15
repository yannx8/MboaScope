import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { InvestigationProvider, LAST_YEAR } from '../../hooks/useInvestigation'
import { InvestigationControls, PRESETS } from './InvestigationControls'

vi.mock('../../services/api', async (orig) => ({
  ...(await orig<typeof import('../../services/api')>()),
  api: { regions: vi.fn().mockResolvedValue({ regions: [] }), clearCache: vi.fn() },
}))

describe('period presets', () => {
  it('splits the record at the 2014 satellite change, each part long enough to test', () => {
    expect(PRESETS.map((p) => [p.start, p.end])).toEqual([
      [2001, LAST_YEAR],
      [2001, 2013],
      [2014, LAST_YEAR],
    ])
  })

  it('sets the period in one click and marks it as pressed', async () => {
    render(
      <MemoryRouter initialEntries={['/?region=douala']}>
        <InvestigationProvider>
          <InvestigationControls />
        </InvestigationProvider>
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: /full record/i })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: /gpm era/i }))
    expect(screen.getByRole('button', { name: /gpm era/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('From')).toHaveValue('2014')
  })
})
