import React from 'react'
import { render, screen } from '@testing-library/react'
import { Alert, AlertTitle, AlertDescription } from '../alert'

describe('Alert', () => {
  describe('Rendering', () => {
    it('renders alert with role="alert"', () => {
      render(<Alert>Alert content</Alert>)
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('Alert content')).toBeInTheDocument()
    })

    it('forwards ref to alert element', () => {
      const ref = React.createRef<HTMLDivElement>()
      render(<Alert ref={ref}>Alert</Alert>)
      expect(ref.current).toBeInstanceOf(HTMLDivElement)
      expect(ref.current).toHaveAttribute('role', 'alert')
    })

    it('renders with children components', () => {
      render(
        <Alert>
          <AlertTitle>Alert Title</AlertTitle>
          <AlertDescription>Alert description text</AlertDescription>
        </Alert>
      )
      
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('Alert Title')).toBeInTheDocument()
      expect(screen.getByText('Alert description text')).toBeInTheDocument()
    })

    it('renders with icon', () => {
      const Icon = () => <svg data-testid="alert-icon" />
      
      render(
        <Alert>
          <Icon />
          <AlertTitle>Alert with Icon</AlertTitle>
          <AlertDescription>This alert has an icon</AlertDescription>
        </Alert>
      )
      
      expect(screen.getByTestId('alert-icon')).toBeInTheDocument()
      expect(screen.getByText('Alert with Icon')).toBeInTheDocument()
    })
  })

  describe('Variants', () => {
    it('applies default variant styles', () => {
      render(<Alert>Default alert</Alert>)
      const alert = screen.getByRole('alert')
      expect(alert).toHaveClass('bg-background', 'text-foreground')
    })

    it('applies destructive variant styles', () => {
      render(<Alert variant="destructive">Destructive alert</Alert>)
      const alert = screen.getByRole('alert')
      expect(alert).toHaveClass('border-destructive/50', 'text-destructive')
    })

    it('uses default variant when not specified', () => {
      render(<Alert>Alert without variant</Alert>)
      const alert = screen.getByRole('alert')
      expect(alert).toHaveClass('bg-background', 'text-foreground')
    })
  })

  describe('Props', () => {
    it('applies custom className to Alert', () => {
      render(<Alert className="custom-alert">Alert</Alert>)
      const alert = screen.getByRole('alert')
      expect(alert).toHaveClass('custom-alert')
      // Also check base classes are maintained
      expect(alert).toHaveClass('relative', 'rounded-lg', 'border')
    })

    it('forwards HTML div attributes', () => {
      render(
        <Alert
          id="test-alert"
          data-testid="alert"
          aria-label="Important alert"
        >
          Alert content
        </Alert>
      )
      const alert = screen.getByRole('alert')
      expect(alert).toHaveAttribute('id', 'test-alert')
      expect(alert).toHaveAttribute('data-testid', 'alert')
      expect(alert).toHaveAttribute('aria-label', 'Important alert')
    })
  })

  describe('AlertTitle', () => {
    it('renders as h5 element', () => {
      render(<AlertTitle>Title Text</AlertTitle>)
      const title = screen.getByText('Title Text')
      expect(title.tagName).toBe('H5')
    })

    it('forwards ref to AlertTitle', () => {
      const ref = React.createRef<HTMLParagraphElement>()
      render(<AlertTitle ref={ref}>Title</AlertTitle>)
      expect(ref.current).toBeInstanceOf(HTMLHeadingElement)
    })

    it('applies custom className to AlertTitle', () => {
      render(<AlertTitle className="custom-title">Title</AlertTitle>)
      const title = screen.getByText('Title')
      expect(title).toHaveClass('custom-title')
      expect(title).toHaveClass('mb-1', 'font-medium', 'leading-none')
    })

    it('forwards HTML heading attributes', () => {
      render(
        <AlertTitle id="alert-title" data-testid="title">
          Title
        </AlertTitle>
      )
      const title = screen.getByText('Title')
      expect(title).toHaveAttribute('id', 'alert-title')
      expect(title).toHaveAttribute('data-testid', 'title')
    })
  })

  describe('AlertDescription', () => {
    it('renders as div element', () => {
      render(<AlertDescription>Description Text</AlertDescription>)
      const description = screen.getByText('Description Text')
      expect(description.tagName).toBe('DIV')
    })

    it('forwards ref to AlertDescription', () => {
      const ref = React.createRef<HTMLParagraphElement>()
      render(<AlertDescription ref={ref}>Description</AlertDescription>)
      expect(ref.current).toBeInstanceOf(HTMLDivElement)
    })

    it('applies custom className to AlertDescription', () => {
      render(<AlertDescription className="custom-desc">Description</AlertDescription>)
      const description = screen.getByText('Description')
      expect(description).toHaveClass('custom-desc')
      expect(description).toHaveClass('text-sm')
    })

    it('forwards HTML div attributes', () => {
      render(
        <AlertDescription id="alert-desc" data-testid="desc">
          Description
        </AlertDescription>
      )
      const description = screen.getByText('Description')
      expect(description).toHaveAttribute('id', 'alert-desc')
      expect(description).toHaveAttribute('data-testid', 'desc')
    })

    it('renders with paragraph inside', () => {
      render(
        <AlertDescription>
          <p>Paragraph inside description</p>
        </AlertDescription>
      )
      const paragraph = screen.getByText('Paragraph inside description')
      expect(paragraph.tagName).toBe('P')
      expect(paragraph.parentElement).toHaveClass('text-sm')
    })
  })

  describe('Complex compositions', () => {
    it('renders complete alert with all components', () => {
      const Icon = () => (
        <svg width="24" height="24" data-testid="warning-icon">
          <circle cx="12" cy="12" r="10" />
        </svg>
      )
      
      render(
        <Alert variant="destructive">
          <Icon />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Something went wrong. Please try again later.
          </AlertDescription>
        </Alert>
      )
      
      const alert = screen.getByRole('alert')
      expect(alert).toHaveClass('text-destructive')
      expect(screen.getByTestId('warning-icon')).toBeInTheDocument()
      expect(screen.getByText('Error')).toBeInTheDocument()
      expect(screen.getByText('Something went wrong. Please try again later.')).toBeInTheDocument()
    })

    it('renders alert with multiple paragraphs in description', () => {
      render(
        <Alert>
          <AlertTitle>Notice</AlertTitle>
          <AlertDescription>
            <p>First paragraph of the notice.</p>
            <p>Second paragraph with more details.</p>
          </AlertDescription>
        </Alert>
      )
      
      expect(screen.getByText('First paragraph of the notice.')).toBeInTheDocument()
      expect(screen.getByText('Second paragraph with more details.')).toBeInTheDocument()
    })

    it('renders alert without title', () => {
      render(
        <Alert>
          <AlertDescription>
            This is an alert without a title, just a description.
          </AlertDescription>
        </Alert>
      )
      
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('This is an alert without a title, just a description.')).toBeInTheDocument()
    })

    it('renders alert with custom content', () => {
      render(
        <Alert>
          <div className="custom-content">
            <strong>Bold text</strong> and <em>italic text</em>
          </div>
        </Alert>
      )
      
      const alert = screen.getByRole('alert')
      expect(alert.querySelector('.custom-content')).toBeInTheDocument()
      expect(screen.getByText('Bold text')).toBeInTheDocument()
      expect(screen.getByText('italic text')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA role', () => {
      render(<Alert>Accessible alert</Alert>)
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('can have additional ARIA attributes', () => {
      render(
        <Alert aria-live="polite" aria-atomic="true">
          Polite alert
        </Alert>
      )
      const alert = screen.getByRole('alert')
      expect(alert).toHaveAttribute('aria-live', 'polite')
      expect(alert).toHaveAttribute('aria-atomic', 'true')
    })

    it('maintains heading hierarchy', () => {
      render(
        <div>
          <h1>Page Title</h1>
          <Alert>
            <AlertTitle>Alert Heading</AlertTitle>
            <AlertDescription>Alert content</AlertDescription>
          </Alert>
        </div>
      )
      
      const heading = screen.getByText('Alert Heading')
      expect(heading.tagName).toBe('H5')
    })
  })
})