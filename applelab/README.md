# AppleLab

AppleLab is a free music studio (DAW) that runs in any modern browser and as a Windows desktop app.
It was written from scratch and doesn't use code or assets from any other product.

## Features

- **Multitrack arrangement**: instrument, drum machine and voice/audio tracks; drag, resize, trim, split, copy, paste and duplicate clips; Alt-drag copies a clip; snap grid; zoom.
- **Recording**
  - Microphone/line-in recording to audio tracks (with latency compensation)
  - Live keyboard/MIDI recording into instrument tracks (piano-roll notes) and drum tracks (quantized steps)
- **9 synth instruments**: Studio Keys, Electric Piano, Saw Lead, Sub Bass, Warm Pad, Pluck, Tone Organ, String Section, Glass Bell. All are synthesized, so no sample downloads are needed.
- **Drum machine**: 8-pad step sequencer (16–64 steps), 4 kits (Classic, Deep Boom, Tight, Lo-Fi), velocity accents, paint-drag, presets and a randomize button.
- **Piano roll**: draw, move, resize and delete notes; box-select; velocity; quantize; transpose; arrow-key nudging.
- **Audio editor**: clip gain, normalize, reverse, fade in/out, export a clip to WAV.
- **Mixer**: volume, pan, mute and solo per track, 3-band EQ, compressor, drive, reverb send, tempo-synced delay send, level meters, and a master limiter.
- **Transport**: play, stop, record, loop (drag on the ruler), metronome, BPM, bar/beat and time display.
- **Playing**: on-screen keyboard and drum pads, computer "musical typing" (A–L / W E T Y U O P, Z/X octave), and Web MIDI keyboards.
- **Projects**
  - Autosave to the browser (IndexedDB, including recorded audio); open, delete, undo/redo
  - Save and open portable `.applelab` files, which bundle all the audio
  - Import audio (WAV, MP3, OGG, FLAC, M4A); export the mixdown to WAV

## Run it

### In a browser

```bash
cd applelab
python3 -m http.server 8080      # or: npm run web
# open http://localhost:8080
```

Microphone and MIDI need `http://localhost` or HTTPS. The web edition works offline once it has been visited (service worker), and can be installed as an app (PWA).

### Desktop app (Electron)

```bash
cd applelab
npm install
npm start
```

## Build the Windows installer

On Windows:

```bash
cd applelab
npm install
npm run dist:win
```

This creates `dist/AppleLab-Setup-1.0.0.exe` (installer) and `dist/AppleLab-Portable-1.0.0.exe` (no install needed).

Without a Windows PC, run the **Build AppleLab for Windows** GitHub Action (Actions tab → Run workflow) and download the `AppleLab-Windows` artifact.

Building Windows `.exe` files on Linux or macOS requires Wine.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| Space | Play / pause |
| R | Record |
| Enter / Home | Go to start |
| Ctrl+Z / Ctrl+Y | Undo / redo |
| Ctrl+S | Save |
| Ctrl+C / Ctrl+V | Copy / paste clip |
| Ctrl+D | Duplicate clip |
| Ctrl+E | Split clip at playhead |
| Del | Delete clip or selected notes |
| Ctrl+L / Ctrl+M | Loop / metronome |
| Ctrl + / Ctrl − | Zoom |
