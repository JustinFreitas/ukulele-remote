import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AudioPlayer } from '../components/AudioPlayer';

// Mock Expo icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

// Mock hooks
jest.mock('@/hooks/use-theme-color', () => ({
  useThemeColor: () => '#000000',
}));

describe('AudioPlayer UI Interactions', () => {
  const mockProps = {
    isPlaying: false,
    onPlayPause: jest.fn(),
    onNext: jest.fn(),
    onPrev: jest.fn(),
    volume: 0.5,
    onVolumeChange: jest.fn(),
    currentTrack: 'Test Track',
    minVolume: 0,
    maxVolume: 100,
    position: 0,
    duration: 300,
    onSeek: jest.fn(),
    onFadeIn: jest.fn(),
    onFadeOut: jest.fn(),
    onStop: jest.fn(),
    onShuffle: jest.fn(),
    onToggleRepeat: jest.fn(),
    onToggleLoop: jest.fn(),
    repeat: false,
    loop: false,
    autoFadeIn: false,
  };

  it('renders correctly with track name', () => {
    const { getByText } = render(<AudioPlayer {...mockProps} />);
    expect(getByText('Test Track')).toBeTruthy();
  });

  it('calls onPlayPause when the play button is pressed', () => {
    const { getByTestId } = render(<AudioPlayer {...mockProps} />);
    
    const playButton = getByTestId('play-pause-button');
    fireEvent.press(playButton);
    expect(mockProps.onPlayPause).toHaveBeenCalled();
  });

  it('calls onVolumeChange with +5% when the +5 button is pressed', () => {
    const { getByText } = render(<AudioPlayer {...mockProps} />);
    // Config default VOL_STEP_MEDIUM is 5
    const plusFiveButton = getByText('+5');
    fireEvent.press(plusFiveButton);
    
    // 0.5 + 0.05 = 0.55
    expect(mockProps.onVolumeChange).toHaveBeenCalledWith(0.55);
  });

  it('preserves default small/medium/large steps (1/5/10) when range >= 100 (optimal <= 1)', () => {
    const onVolumeChange = jest.fn();
    const { getByText, queryByText } = render(
      <AudioPlayer {...mockProps} minVolume={0} maxVolume={800} onVolumeChange={onVolumeChange} />
    );

    expect(getByText('-10')).toBeTruthy();
    expect(getByText('-5')).toBeTruthy();
    expect(getByText('-1')).toBeTruthy();
    expect(getByText('+1')).toBeTruthy();
    expect(getByText('+5')).toBeTruthy();
    expect(getByText('+10')).toBeTruthy();
    // Ensure medium step was NOT overwritten to 3
    expect(queryByText('+3')).toBeNull();

    fireEvent.press(getByText('+10'));
    expect(onVolumeChange).toHaveBeenCalledWith(0.6);
  });

  it('scales volume steps dynamically when min/max range is narrow', () => {
    const onVolumeChange = jest.fn();
    // range = 30 -> optimal = ceil(100/30) = 4 -> medium = max(5, 12) = 12, large = max(10, 20) = 20
    const { getByText } = render(
      <AudioPlayer {...mockProps} minVolume={0} maxVolume={30} onVolumeChange={onVolumeChange} />
    );

    expect(getByText('+4')).toBeTruthy();
    expect(getByText('+12')).toBeTruthy();
    expect(getByText('+20')).toBeTruthy();
  });
});
