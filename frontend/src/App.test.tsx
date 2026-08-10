import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HomePage } from './App'

describe('HomePage', () => {
  it('renders a safe landing page for the temporary start route', () => {
    render(<HomePage />)
    expect(screen.getByText('PosWeb')).toBeInTheDocument()
  })
})
