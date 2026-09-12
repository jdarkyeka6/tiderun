# Tiderun 🌊

The game from the ads, except the gameplay is actually the game.

## Prototype goal

The first playable loop is intentionally tiny:

`drag squad → auto-fire → shoot number gates → grow army → smash enemy wave → boss`

## Project identity

- App name: **Tiderun**
- Bundle ID: `com.tidegames.tiderun`
- Engine: Unity
- Platform first: iOS
- Orientation: Portrait
- Target: 60 FPS

## Current prototype

The repo now contains a code-first Unity prototype. A bootstrapper creates the first level at runtime, so we do not need to hand-build prefabs before testing the mechanic.

Implemented:

- forward-running squad
- mouse/touch drag steering
- dynamic soldier formation
- automatic shooting
- shoot-to-charge `+` gates
- army growth/loss
- enemy waves
- boss with 666 HP
- victory/game-over state
- follow camera
- debug HUD

## Running it

1. Clone this repo.
2. Open it in Unity.
3. Create/open any empty 3D scene.
4. Press Play.

`TiderunBootstrap` uses `RuntimeInitializeOnLoadMethod`, so the prototype level builds itself automatically.

## Rule zero

Anything shown in a Tiderun gameplay ad must actually be playable in Tiderun.
