import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { CommandProvider, useCommandPalette, Command } from '../command-palette';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('CommandProvider', () => {
  let mockRouter: { push: jest.Mock };

  beforeEach(() => {
    mockRouter = { push: jest.fn() };
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <CommandProvider>{children}</CommandProvider>
  );

  describe('Basic functionality', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useCommandPalette());
      }).toThrow('useCommandPalette must be used within CommandProvider');

      spy.mockRestore();
    });

    it('should initialize with closed state', () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper });

      expect(result.current.open).toBe(false);
      expect(result.current.query).toBe('');
      expect(result.current.results).toEqual([]);
    });

    it('should open and close palette', () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper });

      act(() => {
        result.current.openPalette();
      });
      expect(result.current.open).toBe(true);

      act(() => {
        result.current.closePalette();
      });
      expect(result.current.open).toBe(false);
    });

    it('should update query state', () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper });

      act(() => {
        result.current.setQuery('test');
      });

      expect(result.current.query).toBe('test');
    });
  });

  describe('Command sources', () => {
    it('should register and merge commands from multiple sources', async () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper });

      const commands1: Command[] = [
        { id: 'cmd1', label: 'Command 1', group: 'Group A' },
        { id: 'cmd2', label: 'Command 2', group: 'Group A' },
      ];

      const commands2: Command[] = [
        { id: 'cmd3', label: 'Command 3', group: 'Group B' },
      ];

      await act(async () => {
        result.current.registerSource({
          id: 'source1',
          getCommands: () => commands1,
        });
      });

      await waitFor(() => {
        expect(result.current.results.length).toBe(2);
      });

      await act(async () => {
        result.current.registerSource({
          id: 'source2',
          getCommands: () => commands2,
        });
      });

      await waitFor(() => {
        expect(result.current.results.length).toBe(3);
      });
    });

    it('should handle async command sources', async () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper });

      const asyncCommands: Command[] = [
        { id: 'async1', label: 'Async Command' },
      ];

      await act(async () => {
        result.current.registerSource({
          id: 'async-source',
          getCommands: async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
            return asyncCommands;
          },
        });
      });

      await waitFor(() => {
        expect(result.current.results).toContainEqual(
          expect.objectContaining({ id: 'async1' })
        );
      });
    });

    it('should handle source errors gracefully', async () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper });

      await act(async () => {
        result.current.registerSource({
          id: 'error-source',
          getCommands: () => {
            throw new Error('Test error');
          },
        });
      });

      // Should not crash, results should be empty
      await waitFor(() => {
        expect(result.current.results).toEqual([]);
      });
    });

    it('should unregister source on cleanup', async () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper });

      const commands: Command[] = [
        { id: 'temp', label: 'Temporary' },
      ];

      let unregister: (() => void) | undefined;

      await act(async () => {
        unregister = result.current.registerSource({
          id: 'temp-source',
          getCommands: () => commands,
        });
      });

      await waitFor(() => {
        expect(result.current.results.length).toBe(1);
      });

      await act(async () => {
        unregister!();
      });

      await waitFor(() => {
        expect(result.current.results.length).toBe(0);
      });
    });

    it('should override commands with same id from different sources', async () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper });

      await act(async () => {
        result.current.registerSource({
          id: 'source1',
          getCommands: () => [{ id: 'dup', label: 'Original' }],
        });
      });

      await waitFor(() => {
        expect(result.current.results[0]?.label).toBe('Original');
      });

      await act(async () => {
        result.current.registerSource({
          id: 'source2',
          getCommands: () => [{ id: 'dup', label: 'Updated' }],
        });
      });

      await waitFor(() => {
        const dupCmd = result.current.results.find(c => c.id === 'dup');
        expect(dupCmd?.label).toBe('Updated');
      });
    });
  });

  describe('Search and filtering', () => {
    it('should filter commands by label', async () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper });

      const commands: Command[] = [
        { id: '1', label: 'Create Document' },
        { id: '2', label: 'Delete Document' },
        { id: '3', label: 'Upload File' },
      ];

      await act(async () => {
        result.current.registerSource({
          id: 'test',
          getCommands: () => commands,
        });
      });

      await waitFor(() => {
        expect(result.current.results.length).toBe(3);
      });

      act(() => {
        result.current.setQuery('document');
      });

      expect(result.current.results.length).toBe(2);
      expect(result.current.results.every(c => c.label.toLowerCase().includes('document'))).toBe(true);
    });

    it('should filter commands by description', async () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper });

      const commands: Command[] = [
        { id: '1', label: 'Action 1', description: 'Create new document' },
        { id: '2', label: 'Action 2', description: 'Delete old files' },
      ];

      await act(async () => {
        result.current.registerSource({
          id: 'test',
          getCommands: () => commands,
        });
      });

      await waitFor(() => {
        expect(result.current.results.length).toBe(2);
      });

      act(() => {
        result.current.setQuery('document');
      });

      expect(result.current.results.length).toBe(1);
      expect(result.current.results[0].id).toBe('1');
    });

    it('should be case-insensitive', async () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper });

      const commands: Command[] = [
        { id: '1', label: 'UPPERCASE' },
        { id: '2', label: 'lowercase' },
      ];

      await act(async () => {
        result.current.registerSource({
          id: 'test',
          getCommands: () => commands,
        });
      });

      await waitFor(() => {
        expect(result.current.results.length).toBe(2);
      });

      act(() => {
        result.current.setQuery('CASE');
      });

      expect(result.current.results.length).toBe(2);
    });

    it('should return all commands when query is empty', async () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper });

      const commands: Command[] = [
        { id: '1', label: 'Command 1' },
        { id: '2', label: 'Command 2' },
      ];

      await act(async () => {
        result.current.registerSource({
          id: 'test',
          getCommands: () => commands,
        });
      });

      await waitFor(() => {
        expect(result.current.results.length).toBe(2);
      });

      act(() => {
        result.current.setQuery('  '); // whitespace only
      });

      expect(result.current.results.length).toBe(2);
    });
  });

  describe('Command execution', () => {
    it('should execute action command and close palette', async () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper });

      const actionSpy = jest.fn();
      const command: Command = {
        id: 'action-cmd',
        label: 'Action Command',
        action: actionSpy,
      };

      act(() => {
        result.current.openPalette();
      });
      expect(result.current.open).toBe(true);

      await act(async () => {
        await result.current.execute(command);
      });

      expect(actionSpy).toHaveBeenCalledTimes(1);
      expect(result.current.open).toBe(false);
    });

    it('should navigate for href command and close palette', async () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper });

      const command: Command = {
        id: 'nav-cmd',
        label: 'Navigation Command',
        href: '/dashboard',
      };

      act(() => {
        result.current.openPalette();
      });

      await act(async () => {
        await result.current.execute(command);
      });

      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard');
      expect(result.current.open).toBe(false);
    });

    it('should handle async actions', async () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper });

      const asyncAction = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      const command: Command = {
        id: 'async-cmd',
        label: 'Async Command',
        action: asyncAction,
      };

      await act(async () => {
        await result.current.execute(command);
      });

      expect(asyncAction).toHaveBeenCalled();
    });

    it('should prefer action over href when both present', async () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper });

      const actionSpy = jest.fn();
      const command: Command = {
        id: 'both-cmd',
        label: 'Both Command',
        action: actionSpy,
        href: '/should-not-navigate',
      };

      await act(async () => {
        await result.current.execute(command);
      });

      expect(actionSpy).toHaveBeenCalled();
      expect(mockRouter.push).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard shortcuts', () => {
    it('should toggle palette with Cmd+K', () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper });

      expect(result.current.open).toBe(false);

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'k',
          metaKey: true,
        });
        window.dispatchEvent(event);
      });

      expect(result.current.open).toBe(true);

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'k',
          metaKey: true,
        });
        window.dispatchEvent(event);
      });

      expect(result.current.open).toBe(false);
    });

    it('should toggle palette with Ctrl+K', () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper });

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'k',
          ctrlKey: true,
        });
        window.dispatchEvent(event);
      });

      expect(result.current.open).toBe(true);
    });

    it('should close palette with Escape', () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper });

      act(() => {
        result.current.openPalette();
      });
      expect(result.current.open).toBe(true);

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'Escape' });
        window.dispatchEvent(event);
      });

      expect(result.current.open).toBe(false);
    });

    it('should be case-insensitive for K key', () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper });

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'K', // uppercase
          metaKey: true,
        });
        window.dispatchEvent(event);
      });

      expect(result.current.open).toBe(true);
    });
  });
});
