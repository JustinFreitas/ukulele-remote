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
});
