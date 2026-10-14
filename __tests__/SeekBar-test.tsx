import React from 'react';
import { render } from '@testing-library/react-native';
import { SeekBar } from '../components/SeekBar';

jest.mock('@/hooks/use-theme-color', () => ({
  useThemeColor: () => '#000000',
}));

describe('SeekBar', () => {
  it('formats and renders position and duration times', () => {
    const onSeek = jest.fn();
    // 65000 ms = 1:05, 185000 ms = 3:05
    const { getByText } = render(
      <SeekBar position={65000} duration={185000} onSeek={onSeek} />
    );

    expect(getByText('1:05')).toBeTruthy();
    expect(getByText('3:05')).toBeTruthy();
  });

  it('handles zero or missing durations gracefully', () => {
    const onSeek = jest.fn();
    const { getAllByText } = render(
      <SeekBar position={0} duration={0} onSeek={onSeek} />
    );

    expect(getAllByText('0:00').length).toBe(2);
  });
});
