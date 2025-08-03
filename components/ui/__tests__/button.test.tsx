import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button, buttonVariants } from '../button'

describe('Button', () => {
  describe('Rendering', () => {
    it('renders button with children', () => {
      render(<Button>Click me</Button>)
      expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
    })

    it('forwards ref to button element', () => {
      const ref = React.createRef<HTMLButtonElement>()
      render(<Button ref={ref}>Button</Button>)
      expect(ref.current).toBeInstanceOf(HTMLButtonElement)
    })

    it('renders as child component when asChild is true', () => {
      render(
        <Button asChild>
          <a href="/test">Link Button</a>
        </Button>
      )
      const link = screen.getByRole('link', { name: 'Link Button' })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', '/test')
    })
  })

  describe('Variants', () => {
    const variantTests = [
      { variant: 'default' as const, expectedClasses: ['bg-primary', 'text-primary-foreground'] },
      { variant: 'destructive' as const, expectedClasses: ['bg-destructive', 'text-destructive-foreground'] },
      { variant: 'outline' as const, expectedClasses: ['border', 'border-input', 'bg-background'] },
      { variant: 'secondary' as const, expectedClasses: ['bg-secondary', 'text-secondary-foreground'] },
      { variant: 'ghost' as const, expectedClasses: ['hover:bg-accent'] },
      { variant: 'link' as const, expectedClasses: ['text-primary', 'underline-offset-4'] },
      { variant: 'gradient' as const, expectedClasses: ['bg-gradient-to-r', 'from-primary', 'to-secondary'] },
      { variant: 'glow' as const, expectedClasses: ['shadow-[0_0_20px_rgba(99,102,241,0.5)]'] },
      { variant: 'success' as const, expectedClasses: ['bg-success', 'text-success-foreground'] },
      { variant: 'warning' as const, expectedClasses: ['bg-warning', 'text-warning-foreground'] },
      { variant: 'info' as const, expectedClasses: ['bg-info', 'text-info-foreground'] }
    ]

    variantTests.forEach(({ variant, expectedClasses }) => {
      it(`applies ${variant} variant styles`, () => {
        render(<Button variant={variant}>Button</Button>)
        const button = screen.getByRole('button')
        expectedClasses.forEach(className => {
          expect(button.className).toContain(className)
        })
      })
    })
  })

  describe('Sizes', () => {
    const sizeTests = [
      { size: 'default' as const, expectedClasses: ['h-10', 'px-6', 'py-2'] },
      { size: 'sm' as const, expectedClasses: ['h-9', 'px-4', 'text-xs'] },
      { size: 'lg' as const, expectedClasses: ['h-12', 'px-10', 'text-base'] },
      { size: 'xl' as const, expectedClasses: ['h-14', 'px-12', 'text-lg'] },
      { size: 'icon' as const, expectedClasses: ['h-10', 'w-10'] },
      { size: 'icon-sm' as const, expectedClasses: ['h-8', 'w-8'] },
      { size: 'icon-lg' as const, expectedClasses: ['h-12', 'w-12'] }
    ]

    sizeTests.forEach(({ size, expectedClasses }) => {
      it(`applies ${size} size styles`, () => {
        render(<Button size={size}>Button</Button>)
        const button = screen.getByRole('button')
        expectedClasses.forEach(className => {
          expect(button.className).toContain(className)
        })
      })
    })
  })

  describe('Rounded', () => {
    const roundedTests = [
      { rounded: 'default' as const, expectedClasses: ['rounded-md'] },
      { rounded: 'sm' as const, expectedClasses: ['rounded-sm'] },
      { rounded: 'lg' as const, expectedClasses: ['rounded-lg'] },
      { rounded: 'xl' as const, expectedClasses: ['rounded-xl'] },
      { rounded: 'full' as const, expectedClasses: ['rounded-full'] }
    ]

    roundedTests.forEach(({ rounded, expectedClasses }) => {
      it(`applies ${rounded} rounded styles`, () => {
        render(<Button rounded={rounded}>Button</Button>)
        const button = screen.getByRole('button')
        expectedClasses.forEach(className => {
          expect(button.className).toContain(className)
        })
      })
    })
  })

  describe('Props', () => {
    it('applies custom className', () => {
      render(<Button className="custom-class">Button</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('custom-class')
    })

    it('forwards HTML button attributes', () => {
      render(
        <Button
          type="submit"
          disabled
          aria-label="Submit form"
          data-testid="submit-btn"
        >
          Submit
        </Button>
      )
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('type', 'submit')
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('aria-label', 'Submit form')
      expect(button).toHaveAttribute('data-testid', 'submit-btn')
    })
  })

  describe('Interactions', () => {
    it('handles click events', async () => {
      const handleClick = jest.fn()
      const user = userEvent.setup()
      
      render(<Button onClick={handleClick}>Click me</Button>)
      const button = screen.getByRole('button')
      
      await user.click(button)
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('does not trigger click when disabled', async () => {
      const handleClick = jest.fn()
      const user = userEvent.setup()
      
      render(<Button onClick={handleClick} disabled>Click me</Button>)
      const button = screen.getByRole('button')
      
      await user.click(button)
      expect(handleClick).not.toHaveBeenCalled()
    })

    it('supports keyboard navigation', async () => {
      const handleClick = jest.fn()
      const user = userEvent.setup()
      
      render(<Button onClick={handleClick}>Click me</Button>)
      const button = screen.getByRole('button')
      
      button.focus()
      await user.keyboard('{Enter}')
      expect(handleClick).toHaveBeenCalledTimes(1)
      
      await user.keyboard(' ')
      expect(handleClick).toHaveBeenCalledTimes(2)
    })
  })

  describe('Default variants', () => {
    it('applies default variant when no variant specified', () => {
      render(<Button>Button</Button>)
      const button = screen.getByRole('button')
      expect(button.className).toContain('bg-primary')
      expect(button.className).toContain('text-primary-foreground')
    })

    it('applies default size when no size specified', () => {
      render(<Button>Button</Button>)
      const button = screen.getByRole('button')
      expect(button.className).toContain('h-10')
      expect(button.className).toContain('px-6')
      expect(button.className).toContain('py-2')
    })

    it('applies default rounded when no rounded specified', () => {
      render(<Button>Button</Button>)
      const button = screen.getByRole('button')
      expect(button.className).toContain('rounded-md')
    })
  })

  describe('Compound variants', () => {
    it('combines multiple variants correctly', () => {
      render(
        <Button variant="gradient" size="lg" rounded="full">
          Large Gradient Pill Button
        </Button>
      )
      const button = screen.getByRole('button')
      // Check gradient variant classes
      expect(button.className).toContain('bg-gradient-to-r')
      expect(button.className).toContain('from-primary')
      expect(button.className).toContain('to-secondary')
      // Check lg size classes
      expect(button.className).toContain('h-12')
      expect(button.className).toContain('px-10')
      expect(button.className).toContain('text-base')
      // Check full rounded classes
      expect(button.className).toContain('rounded-full')
    })
  })
})