import { render, screen } from '@testing-library/react'
import Home from './page'

// Smoke test: home page component renders visible content.
// This covers Phase 0 acceptance: `npm run test` succeeds from a clean clone.

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />
  },
}))

describe('Home page', () => {
  it('renders a heading with visible content', () => {
    render(<Home />)
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toBeInTheDocument()
    expect(heading.textContent).toBeTruthy()
  })

  it('renders at least one link', () => {
    render(<Home />)
    const links = screen.getAllByRole('link')
    expect(links.length).toBeGreaterThan(0)
  })
})
