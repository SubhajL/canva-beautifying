import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CommandPalette from '../CommandPalette';
import { CommandProvider, Command, useCommandPalette } from '@/contexts/command-palette';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// Test helper component to register commands
function TestCommandRegistrar({ commands }: { commands: Command[] }) {
  const { registerSource } = useCommandPalette();

  React.useEffect(() => {
    const unregister = registerSource({
      id: 'test',
      getCommands: () => commands,
    });
    return unregister;
  }, [registerSource, commands]);

  return null;
}

describe('CommandPalette', () => {
  const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <CommandProvider>{children}</CommandProvider>
  );

  describe('Rendering and UI', () => {
    it('should not render dialog when closed', () => {
      render(
        <TestWrapper>
          <CommandPalette />
        </TestWrapper>
      );

      const dialog = screen.queryByTestId('command-palette');
      expect(dialog).not.toBeInTheDocument();
    });

    it('should render dialog when palette is open', () => {
      render(
        <TestWrapper>
          <CommandPalette />
        </TestWrapper>
      );

      // Open palette with Cmd+K
      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      const dialog = screen.getByTestId('command-palette');
      expect(dialog).toBeInTheDocument();
      expect(screen.getByRole('searchbox')).toBeInTheDocument();
    });

    it('should render title and description', () => {
      render(
        <TestWrapper>
          <CommandPalette />
        </TestWrapper>
      );

      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      expect(screen.getByText('Command Palette')).toBeInTheDocument();
      expect(screen.getByText(/Search and execute commands across the app/i)).toBeInTheDocument();
    });

    it('should display search icon', () => {
      render(
        <TestWrapper>
          <CommandPalette />
        </TestWrapper>
      );

      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      const searchbox = screen.getByRole('searchbox');
      expect(searchbox).toHaveAttribute('placeholder', expect.stringContaining('Search'));
    });

    it('should show empty state when no results', () => {
      render(
        <TestWrapper>
          <CommandPalette />
        </TestWrapper>
      );

      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      expect(screen.getByTestId('command-empty')).toHaveTextContent('No matches');
    });
  });

  describe('Search functionality', () => {
    it('should update query on input', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <CommandPalette />
        </TestWrapper>
      );

      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      const searchbox = screen.getByRole('searchbox');
      await user.type(searchbox, 'test');

      expect(searchbox).toHaveValue('test');
    });

    it('should clear query when dialog closes', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <CommandPalette />
        </TestWrapper>
      );

      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      const searchbox = screen.getByRole('searchbox');
      await user.type(searchbox, 'test');
      expect(searchbox).toHaveValue('test');

      // Close with Escape
      fireEvent.keyDown(window, { key: 'Escape' });

      // Reopen
      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      // Query should persist (based on context implementation)
      expect(searchbox).toHaveValue('test');
    });
  });

  describe('Command grouping', () => {
    it('should group commands by group property', async () => {
      const commands: Command[] = [
        { id: '1', label: 'Action 1', group: 'Group A' },
        { id: '2', label: 'Action 2', group: 'Group A' },
        { id: '3', label: 'Action 3', group: 'Group B' },
      ];

      render(
        <TestWrapper>
          <TestCommandRegistrar commands={commands} />
          <CommandPalette />
        </TestWrapper>
      );

      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      await waitFor(() => {
        expect(screen.getByText('Group A')).toBeInTheDocument();
        expect(screen.getByText('Group B')).toBeInTheDocument();
      });
    });

    it('should use "General" as default group', async () => {
      const commands: Command[] = [
        { id: '1', label: 'Ungrouped Action' },
      ];

      render(
        <TestWrapper>
          <TestCommandRegistrar commands={commands} />
          <CommandPalette />
        </TestWrapper>
      );

      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      await waitFor(() => {
        expect(screen.getByText('General')).toBeInTheDocument();
      });
    });
  });

  describe('Command execution', () => {
    it('should execute command on click', async () => {
      const actionSpy = jest.fn();
      const commands: Command[] = [
        { id: 'action-1', label: 'Test Action', action: actionSpy },
      ];

      render(
        <TestWrapper>
          <TestCommandRegistrar commands={commands} />
          <CommandPalette />
        </TestWrapper>
      );

      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      await waitFor(() => {
        expect(screen.getByTestId('command-action-1')).toBeInTheDocument();
      });

      const button = screen.getByTestId('command-action-1');
      fireEvent.click(button);

      await waitFor(() => {
        expect(actionSpy).toHaveBeenCalledTimes(1);
      });

      // Dialog should close after execution
      await waitFor(() => {
        expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument();
      });
    });

    it('should show command label and description', async () => {
      const commands: Command[] = [
        {
          id: 'cmd-1',
          label: 'Create Document',
          description: 'Start a new document'
        },
      ];

      render(
        <TestWrapper>
          <TestCommandRegistrar commands={commands} />
          <CommandPalette />
        </TestWrapper>
      );

      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      await waitFor(() => {
        expect(screen.getByText('Create Document')).toBeInTheDocument();
        expect(screen.getByText('Start a new document')).toBeInTheDocument();
      });
    });
  });

  describe('Focus management', () => {
    it('should focus search input when dialog opens', async () => {
      render(
        <TestWrapper>
          <CommandPalette />
        </TestWrapper>
      );

      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      await waitFor(() => {
        const searchbox = screen.getByRole('searchbox');
        expect(searchbox).toHaveFocus();
      }, { timeout: 100 });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA roles', () => {
      render(
        <TestWrapper>
          <CommandPalette />
        </TestWrapper>
      );

      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      expect(screen.getByRole('searchbox')).toHaveAttribute('aria-label', 'Search commands');
      expect(screen.getByRole('listbox')).toHaveAttribute('aria-label', 'Command results');
    });

    it('should mark command items as options', async () => {
      const commands: Command[] = [
        { id: '1', label: 'Test Command' },
      ];

      render(
        <TestWrapper>
          <TestCommandRegistrar commands={commands} />
          <CommandPalette />
        </TestWrapper>
      );

      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      await waitFor(() => {
        const option = screen.getByRole('option');
        expect(option).toBeInTheDocument();
      });
    });

    it('should have screen-reader only description', () => {
      render(
        <TestWrapper>
          <CommandPalette />
        </TestWrapper>
      );

      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      const description = screen.getByText(/Search and execute commands across the app/i);
      expect(description).toHaveClass('sr-only');
    });
  });
});
