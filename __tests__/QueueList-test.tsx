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

  it('renders tracks when queue is populated', () => {
    const queue = [
      { id: '1', title: 'First Song' },
      { id: '2', title: 'Second Song' },
    ];
    const { getByText } = render(<QueueList {...mockProps} queue={queue} />);

    expect(getByText('First Song')).toBeTruthy();
    expect(getByText('Second Song')).toBeTruthy();
  });

  it('calls onAddTrack when submitting new track URL', async () => {
    const { getByPlaceholderText } = render(<QueueList {...mockProps} />);

    const input = getByPlaceholderText('Search or Paste URL...');
    fireEvent.changeText(input, 'https://youtube.com/watch?v=123');
    await act(async () => {
      fireEvent(input, 'submitEditing');
    });

    expect(mockProps.onAddTrack).toHaveBeenCalledWith('https://youtube.com/watch?v=123');
  });
});
