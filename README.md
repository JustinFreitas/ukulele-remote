# Ukulele Remote 🎸

Ukulele Remote is a mobile controller for the Ukulele music bot. It allows you to manage playback, view the queue, and switch voice channels directly from your phone.

## Features

- **Playback Control:** Play, pause, skip, and seek.
- **Queue Management:** View and interact with the current music queue.
- **Voice Channels:** Switch the bot between different voice channels in your server.
- **Real-time Sync:** Uses WebSockets for instant status updates.

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- [Expo Go](https://expo.dev/go) app on your mobile device (or an emulator)
- A running instance of the Ukulele API

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file and fill in your specific API details:

```bash
cp .env.example .env
```

Edit `.env` and set:
- `EXPO_PUBLIC_UKULELE_API_URL`: The URL of your Ukulele API.
- `EXPO_PUBLIC_UKULELE_API_TOKEN`: Your API bearer token.

### 3. Start the app

```bash
npx expo start
```

- **Android:** Press `a` or scan the QR code in Expo Go.
- **iOS:** Press `i` or scan the QR code in the Camera app.
- **Web:** Press `w`.

## Technical Details

- **Framework:** [Expo](https://expo.dev) / [React Native](https://reactnative.dev/)
- **State:** React Hooks & WebSockets (via STOMP)
- **Styling:** Themed components with Light/Dark mode support.

---
Created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).
