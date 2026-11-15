import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InvestigationProvider } from '../hooks/useInvestigation'
import { ApiError } from '../services/api'
import { INTERPRET, REGIONS, SERIES, trends } from '../test/fixtures'
import Assistant from './Assistant'
import Dashboard from './Dashboard'
import Method from './Method'

const mocked = vi.hoisted(() => ({
  regions: vi.fn(),
  trends: vi.fn(),
  rainfallSeries: vi.fn(),
  interpret: vi.fn(),
  ask: vi.fn(),
  history: vi.fn(),
  spatial: vi.fn(),
  clearCache: vi.fn(),
}))
vi.mock('../services/api', async (orig) => ({ ...(await orig<typeof import('../services/api')>()), api: mocked }))

function renderAt(url: string, page: ReactNode) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <InvestigationProvider>{page}</InvestigationProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocked.regions.mockResolvedValue({ regions: REGIONS })
  mocked.trends.mockImplementation(({ region_id }: { region_id: string }) =>
    Promise.resolve(region_id === 'douala' ? trends('douala', 'Douala', 'no_significant_trend') : trends(region_id, 'Garoua')),
  )
  mocked.rainfallSeries.mockResolvedValue(SERIES)
  mocked.interpret.mockResolvedValue(INTERPRET)
})

describe('Dashboard', () => {
  it('shows the verdict and numbers exactly as the API returns them', async () => {
    renderAt('/?region=garoua', <Dashboard />)
    expect(await screen.findByRole('heading', { level: 1, name: /statistically significant decrease/i })).toBeInTheDocument()
    expect(screen.getByText('−5.4')).toBeInTheDocument()
    expect(screen.getByText('0.042')).toBeInTheDocument()
    expect(screen.getByText(/has not yet been checked on a map/i)).toBeInTheDocument()
  })

  it('compares every region with data, in one table', async () => {
    renderAt('/?region=garoua', <Dashboard />)
    const table = await screen.findByRole('table', { name: /every region|each study region/i })
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(3)) // header + 2 regions with data
    expect(within(table).getByRole('button', { name: 'Douala' })).toBeInTheDocument()
    expect(within(table).getByText('No significant trend')).toBeInTheDocument()
    expect(mocked.trends).toHaveBeenCalledWith({ region_id: 'douala', start_year: 2001, end_year: 2025 })
    expect(mocked.trends).not.toHaveBeenCalledWith(expect.objectContaining({ region_id: 'bertoua' }))
  })

  it('gives every chart a data table', async () => {
    renderAt('/?region=garoua', <Dashboard />)
    expect(await screen.findByText('Show the numbers')).toBeInTheDocument()
    expect(screen.getByRole('table', { name: /annual totals/i })).toBeInTheDocument()
  })

  it('explains a period that is too short instead of showing nothing', async () => {
    renderAt('/?region=garoua&from=2020&to=2025', <Dashboard />)
    expect(screen.getByRole('heading', { name: /choose at least 10 years/i })).toBeInTheDocument()
    expect(mocked.trends).not.toHaveBeenCalled()
  })

  it('designs the "no data for this region" state', async () => {
    mocked.trends.mockRejectedValue(new ApiError(409, 'no data'))
    renderAt('/?region=bertoua', <Dashboard />)
    expect(await screen.findByRole('heading', { name: /no rainfall data for bertoua yet/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /show douala instead/i })).toBeInTheDocument()
  })

  it('offers a retry when the server is down', async () => {
    mocked.trends.mockRejectedValue(new ApiError(0, 'down'))
    renderAt('/?region=garoua', <Dashboard />)
    expect(await screen.findByRole('heading', { name: /server cannot be reached/i })).toBeInTheDocument()
    mocked.trends.mockImplementation(() => Promise.resolve(trends('garoua', 'Garoua')))
    await userEvent.click(screen.getAllByRole('button', { name: /try again/i })[0])
    expect(await screen.findByRole('heading', { level: 1, name: /significant decrease/i })).toBeInTheDocument()
  })
})

describe('Assistant', () => {
  it('shows checked answers and refusals from the API', async () => {
    mocked.ask
      .mockResolvedValueOnce({
        ...INTERPRET,
        question: 'Is it getting wetter?',
        answer: { source: 'rules', model: null, answered: true, text: 'The satellite record shows a statistically significant decrease.' },
        notes: [],
      })
      .mockResolvedValueOnce({
        ...INTERPRET,
        question: 'What about temperature?',
        answer: { source: 'refusal', model: null, answered: false, text: 'I can only answer from the computed results.' },
        notes: ['the question is about something the analysis does not contain'],
      })
    renderAt('/assistant?region=garoua', <Assistant />)
    expect(await screen.findByText(INTERPRET.explanation.summary)).toBeInTheDocument()

    const input = screen.getByRole('textbox', { name: /ask about the result/i })
    await userEvent.type(input, 'Is it getting wetter?{Enter}')
    expect(await screen.findByText('The satellite record shows a statistically significant decrease.')).toBeInTheDocument()
    expect(mocked.ask).toHaveBeenCalledWith({ region_id: 'garoua', start_year: 2001, end_year: 2025, question: 'Is it getting wetter?', use_llm: false })

    await userEvent.type(input, 'What about temperature?{Enter}')
    expect(await screen.findByText('I can only answer from the computed results.')).toBeInTheDocument()
    expect(screen.getByText(/refused: outside the computed results/i)).toBeInTheDocument()
  })

  it('hides an explanation that failed its checks', async () => {
    mocked.interpret.mockResolvedValue({ ...INTERPRET, explanation: { ...INTERPRET.explanation, checks_passed: false } })
    renderAt('/assistant?region=garoua', <Assistant />)
    expect(await screen.findByRole('heading', { name: /explanation is hidden/i })).toBeInTheDocument()
    expect(screen.queryByText(INTERPRET.explanation.summary)).not.toBeInTheDocument()
  })
})

describe('Method', () => {
  it('renders the plain-language method from docs/methodology.md', () => {
    renderAt('/method', <Method />)
    expect(screen.getByRole('heading', { level: 2, name: /how the answer is computed/i })).toBeInTheDocument()
    expect(screen.getByText(/mann-kendall test\./i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /what the ai does/i })).toBeInTheDocument()
  })
})
