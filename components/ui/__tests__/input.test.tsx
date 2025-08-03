import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '../input'

describe('Input', () => {
  describe('Rendering', () => {
    it('renders input element', () => {
      render(<Input />)
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('forwards ref to input element', () => {
      const ref = React.createRef<HTMLInputElement>()
      render(<Input ref={ref} />)
      expect(ref.current).toBeInstanceOf(HTMLInputElement)
    })

    it('renders with custom type', () => {
      render(<Input type="email" />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('type', 'email')
    })

    it('renders password input', () => {
      render(<Input type="password" placeholder="Enter password" />)
      const input = screen.getByPlaceholderText('Enter password')
      expect(input).toHaveAttribute('type', 'password')
    })

    it('renders number input', () => {
      render(<Input type="number" />)
      const input = screen.getByRole('spinbutton')
      expect(input).toHaveAttribute('type', 'number')
    })

    it('renders search input', () => {
      render(<Input type="search" />)
      const input = screen.getByRole('searchbox')
      expect(input).toHaveAttribute('type', 'search')
    })
  })

  describe('Props', () => {
    it('applies custom className', () => {
      render(<Input className="custom-input" />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('custom-input')
      // Also check it maintains base classes
      expect(input).toHaveClass('rounded-md', 'border', 'border-input')
    })

    it('forwards HTML input attributes', () => {
      render(
        <Input
          placeholder="Enter text"
          name="username"
          id="username-input"
          required
          disabled
          readOnly
          autoComplete="username"
          aria-label="Username"
          data-testid="test-input"
        />
      )
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('placeholder', 'Enter text')
      expect(input).toHaveAttribute('name', 'username')
      expect(input).toHaveAttribute('id', 'username-input')
      expect(input).toBeRequired()
      expect(input).toBeDisabled()
      expect(input).toHaveAttribute('readOnly')
      expect(input).toHaveAttribute('autoComplete', 'username')
      expect(input).toHaveAttribute('aria-label', 'Username')
      expect(input).toHaveAttribute('data-testid', 'test-input')
    })

    it('handles value prop', () => {
      render(<Input value="test value" onChange={() => {}} />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveValue('test value')
    })

    it('handles defaultValue prop', () => {
      render(<Input defaultValue="default text" />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveValue('default text')
    })

    it('handles min and max for number input', () => {
      render(<Input type="number" min={0} max={100} />)
      const input = screen.getByRole('spinbutton')
      expect(input).toHaveAttribute('min', '0')
      expect(input).toHaveAttribute('max', '100')
    })

    it('handles maxLength prop', () => {
      render(<Input maxLength={10} />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('maxLength', '10')
    })

    it('handles pattern prop', () => {
      render(<Input pattern="[A-Za-z]{3}" />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('pattern', '[A-Za-z]{3}')
    })
  })

  describe('Interactions', () => {
    it('handles onChange events', async () => {
      const handleChange = jest.fn()
      const user = userEvent.setup()
      
      render(<Input onChange={handleChange} />)
      const input = screen.getByRole('textbox')
      
      await user.type(input, 'hello')
      expect(handleChange).toHaveBeenCalledTimes(5) // Once for each character
      expect(input).toHaveValue('hello')
    })

    it('handles onFocus and onBlur events', async () => {
      const handleFocus = jest.fn()
      const handleBlur = jest.fn()
      const user = userEvent.setup()
      
      render(<Input onFocus={handleFocus} onBlur={handleBlur} />)
      const input = screen.getByRole('textbox')
      
      await user.click(input)
      expect(handleFocus).toHaveBeenCalledTimes(1)
      
      await user.tab()
      expect(handleBlur).toHaveBeenCalledTimes(1)
    })

    it('handles onKeyDown events', async () => {
      const handleKeyDown = jest.fn()
      const user = userEvent.setup()
      
      render(<Input onKeyDown={handleKeyDown} />)
      const input = screen.getByRole('textbox')
      
      input.focus()
      await user.keyboard('{Enter}')
      expect(handleKeyDown).toHaveBeenCalledTimes(1)
      expect(handleKeyDown).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'Enter'
        })
      )
    })

    it('prevents input when disabled', async () => {
      const handleChange = jest.fn()
      const user = userEvent.setup()
      
      render(<Input onChange={handleChange} disabled />)
      const input = screen.getByRole('textbox')
      
      await user.type(input, 'test')
      expect(handleChange).not.toHaveBeenCalled()
      expect(input).toHaveValue('')
    })

    it('prevents editing when readOnly', async () => {
      const handleChange = jest.fn()
      const user = userEvent.setup()
      
      render(<Input value="readonly text" onChange={handleChange} readOnly />)
      const input = screen.getByRole('textbox')
      
      await user.type(input, 'new text')
      expect(handleChange).not.toHaveBeenCalled()
      expect(input).toHaveValue('readonly text')
    })

    it('supports copy and paste', async () => {
      const user = userEvent.setup()
      
      render(<Input />)
      const input = screen.getByRole('textbox')
      
      await user.click(input)
      await user.paste('pasted text')
      expect(input).toHaveValue('pasted text')
    })

    it('supports selection', async () => {
      const user = userEvent.setup()
      
      render(<Input defaultValue="select this text" />)
      const input = screen.getByRole('textbox') as HTMLInputElement
      
      await user.click(input)
      await user.keyboard('{Control>}a{/Control}')
      
      // Check if text is selected (this is a simplified check)
      expect(input.selectionStart).toBe(0)
      expect(input.selectionEnd).toBe(16)
    })
  })

  describe('File input', () => {
    it('renders file input', () => {
      const { container } = render(<Input type="file" />)
      const input = container.querySelector('input[type="file"]')
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('type', 'file')
    })

    it('handles accept attribute for file input', () => {
      const { container } = render(<Input type="file" accept="image/*" />)
      const input = container.querySelector('input[type="file"]')
      expect(input).toHaveAttribute('accept', 'image/*')
    })

    it('handles multiple attribute for file input', () => {
      const { container } = render(<Input type="file" multiple />)
      const input = container.querySelector('input[type="file"]')
      expect(input).toHaveAttribute('multiple')
    })
  })

  describe('Styling', () => {
    it('applies focus styles', async () => {
      const user = userEvent.setup()
      
      render(<Input />)
      const input = screen.getByRole('textbox')
      
      await user.click(input)
      // Check that focus classes are present in the className string
      expect(input.className).toContain('focus-visible:outline-none')
      expect(input.className).toContain('focus-visible:ring-2')
    })

    it('applies disabled styles', () => {
      render(<Input disabled />)
      const input = screen.getByRole('textbox')
      expect(input.className).toContain('disabled:cursor-not-allowed')
      expect(input.className).toContain('disabled:opacity-50')
    })

    it('applies file input specific styles', () => {
      const { container } = render(<Input type="file" />)
      const input = container.querySelector('input[type="file"]')
      expect(input?.className).toContain('file:border-0')
      expect(input?.className).toContain('file:bg-transparent')
    })
  })
})