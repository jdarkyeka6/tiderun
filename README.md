# Tiderun 🌊

The game from the ads, except the gameplay is actually the game.

## Prototype goal

`drag squad → auto-fire → shoot number gates → grow army → smash enemy wave → 666 HP boss`

## Project identity

- App name: **Tiderun**
- Bundle ID: `com.tidegames.tiderun`
- Runtime: **Three.js + TypeScript + Vite**
- Platform first: **iPhone / iOS**
- Orientation: **Portrait**
- Target: **60 FPS**

## Why browser-first?

The development machine available right now cannot install Unity/Unreal without admin access. The game therefore runs as a lightweight WebGL build that can be deployed and tested directly on an iPhone. The same web build is intended to be wrapped for iOS later.

## Current playable prototype

Implemented:

- portrait mobile layout with safe-area support
- touch/mouse drag steering
- constantly advancing blue squad
- instanced soldier rendering for large crowds
- automatic shooting
- shoot-to-charge `+` gates
- `×2` gates
- dynamic army formation up to 400 soldiers
- four red enemy waves
- enemy contact losses
- 666 HP boss + boss health bar
- victory / game-over screen
- mobile camera follow
- run progress + army HUD

## Run locally

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

The Vite base path is relative so the production build can later live inside an iOS webview/Capacitor shell without rewriting asset paths.

## Rule zero

Anything shown in a Tiderun gameplay ad must actually be playable in Tiderun.

## Old Unity prototype

The early Unity files are still in the repository temporarily so nothing is destroyed before the browser build is tested. Once the WebGL version is confirmed working, they can be removed.
