import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { QueueList } from '../components/QueueList';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('@/hooks/use-theme-color', () => ({
  useThemeColor: () => '#000000',
}));

describe('QueueList', () => {
  const mockProps = {
    queue: [],
    onRemove: jest.fn(),
    onPlay: jest.fn(),
    onLoadDefault: jest.fn(),
    onAddTrack: jest.fn().mockResolvedValue(undefined),
  };

  it('renders empty queue message and calls onLoadDefault when clicked', () => {
    const { getByText } = render(<QueueList {...mockProps} />);

    expect(getByText('Queue is empty')).toBeTruthy();
    const loadDefaultBtn = getByText('Load Default');
    fireEvent.press(loadDefaultBtn);
    expect(mockProps.onLoadDefault).toHaveBeenCalled();
  });

  it('renders tracks and track artists when queue is populated', () => {
    const queue = [
      { id: '1', title: 'First Song', artist: 'First Artist' },
      { id: '2', title: 'Second Song' },
      { id: '3', title: 'Third Song', artist: '' },
    ];
    const { getByText } = render(<QueueList {...mockProps} queue={queue} />);

    expect(getByText('First Song')).toBeTruthy();
    expect(getByText('First Artist')).toBeTruthy();
    expect(getByText('Second Song')).toBeTruthy();
    expect(getByText('Third Song')).toBeTruthy();
  });

  it('calls onAddTrack when submitting new track URL', async () => {
    const { getByPlaceholderText } = render(<QueueList {...mockProps} />);

    const input = getByPlaceholderText('Paste URL, file, or folder path...');
    fireEvent.changeText(input, 'https://youtube.com/watch?v=123');
    await act(async () => {
      fireEvent(input, 'submitEditing');
    });

    expect(mockProps.onAddTrack).toHaveBeenCalledWith('https://youtube.com/watch?v=123');
  });

  it('renders per-track RAM/DISK cache badges and header RAM summary with Clear LRU action', async () => {
    const onClearCache = jest.fn().mockResolvedValue(undefined);
    const queue = [
      { id: 'Z:/Music/1.flac#0', title: 'Tavern Loop', artist: 'Bard', cacheState: 'MEMORY' as const },
      { id: 'Z:/Music/2.flac#0', title: 'Boss Battle', artist: 'Orchestra', cacheState: 'DISK' as const },
    ];
    const cacheStats = {
      enabled: true,
      pinnedBytes: 52428800,
      lruBytes: 26214400,
      totalBytes: 78643200,
      maxBytes: 8589934592,
      pinnedCount: 1,
      lruCount: 1,
      queuedLocalCount: 2,
      queuedInMemoryCount: 1,
      prefetchingCount: 0,
    };

    const { getByText, getByTestId } = render(
      <QueueList
        {...mockProps}
        queue={queue}
        cacheStats={cacheStats}
        onClearCache={onClearCache}
      />
    );

    expect(getByText('RAM')).toBeTruthy();
    expect(getByText('DISK')).toBeTruthy();
    expect(getByTestId('queue-cache-pill')).toBeTruthy();
    expect(getByText(/RAM 1\/2/)).toBeTruthy();

    const clearBtn = getByTestId('clear-lru-button');
    await act(async () => {
      fireEvent.press(clearBtn);
    });
    expect(onClearCache).toHaveBeenCalled();
  });
});
