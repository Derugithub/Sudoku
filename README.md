# Sudoku Calm

**Sudoku Calm: Classic Puzzles** is a calm, offline Sudoku game for Android, built with Expo (SDK 57) and React Native.

Package `com.deredo.sudokucalm` · slug `sudoku-calm` · scheme `sudokucalm` · Expo project `@deredo/sudoku-calm`
Privacy policy: https://derugithub.github.io/Privacy-policy/sudoku-calm/ · Support: movadmob@gmail.com

## Features

- **Puzzles made on the phone.** A bitmask solver checks that every puzzle has exactly one solution. A logical solver then grades it by the hardest technique it needs:

  | Level   | Needs                                               |
  | ------- | --------------------------------------------------- |
  | Easy    | Hidden singles, 36+ givens                          |
  | Medium  | Naked singles                                       |
  | Hard    | Pointing and box/line reduction                     |
  | Expert  | Naked/hidden pairs and triples                      |
  | Master  | X-Wing, XY-Wing, naked/hidden quads                 |
  | Extreme | Swordfish, XYZ-Wing, jellyfish, or beyond           |

  Generation runs in small time slices so the UI never freezes. A buffer of two puzzles per level is kept ready, and a bundled set of 144 puzzles (relabelled and shuffled each time) covers any hiccup.
- **Daily Challenge.** The same puzzle for everyone, built from the date. Streaks and a month calendar are included, and a missed day from the last 30 can be unlocked with a rewarded ad.
- **Gameplay.** Notes with auto-cleanup, unlimited undo, erase, row/column/box and same-number highlights, and a mistake limit that always applies: every wrong number counts and three mistakes end the game ("Show mistakes" only controls whether wrong numbers are marked in red). Number keys show how many of each digit are left, and a progress bar shows how much of the puzzle is filled correctly. Pause opens a small card over the dimmed board (Resume, Restart, New game), and the game pauses automatically in the background or while Settings is open. Restart resets the same puzzle (hints already used stay used). The top bar has Restart, a Music on/off toggle and Settings. Games autosave and resume. Stats are kept per level. Input is cell-first or number-first, with a tap deadzone.
- **Hints that teach.** A hint highlights the cells, names the technique in plain words and fills one cell. You get 1 free hint per game on Easy/Medium and 2 on Hard and above. After that, a rewarded ad gives +1, up to 3 per game.
- **Ads (test IDs only for now).**
  - Rewarded: hint, another chance after three mistakes (+1 mistake, once per game, not refilled by Restart), unlocking a missed daily, and a 1-hour ad-free pass.
  - Interstitial: only after a finished puzzle, at most every 2nd one, never in the first session, at least 4 minutes apart and at most 8 a day. It never follows a rewarded ad and never shows mid-puzzle.
  - Banner: on home and level select only.
  - Consent: Google UMP consent comes first. If ads fail, the game carries on.
- **No purchases, ever.** There is no Pro version and no billing. The rewarded 1-hour ad-free pass is the only way to turn ads off: up to 6 passes a day, with remaining time stacking to 3 hours. It survives restarts and ignores the clock being set back.
- **Look and feel.** Paper, Midnight and High-contrast themes (design tokens in `src/theme/tokens.ts`), difficulty colours, gentle motion and confetti. Procedural sounds and haptics have separate toggles.
- **Music.** A soft piano piece (about 87 s, seamless loop, F major, about 66 BPM) synthesised by `scripts/generate-music.mjs`, so there is nothing to license. It plays at a low volume, is on by default, and has its own toggle. It pauses in the background and during any ad.
- **In-app review.** Asked from the 3rd session, only after the 3rd win (and later wins), at most every 48 hours. Never asked after a mistake-heavy loss, a second chance or any ad.
- English only for now. Strings live in `src/i18n/` so more languages can be added.

## Development

```sh
npm install
npm start            # dev server (needs a dev client build)
npm run typecheck
npm run lint
npm test             # engine, hints, game, ad caps, daily, save/load, review, tokens
npm run bench        # puzzle generation time per level
npm run sounds       # regenerate assets/sounds
npm run music        # regenerate assets/music/calm-piano.m4a (needs ffmpeg)
npm run fallback     # regenerate the bundled fallback puzzles
```

Builds run from GitHub Actions (`.github/workflows`) and need an `EXPO_TOKEN` repository secret.

## Icons

The app icon, adaptive icon layers, splash and favicon in `assets/images` are the designer's finished pack. Replace the files to change them; there is no generator.

## Before release

- Create the AdMob app and put its Android app ID in `src/lib/ads/android-app-id.js`, in `app.json` (plugin `androidAppId` and root `android_app_id`) and in the `eas.json` production env `ADMOB_ANDROID_APP_ID`. It currently uses Google's sample ID.
- Fill in `src/lib/ads/production-unit-ids.js` with the real ad unit IDs. It is `null` now, so only test ads run.
- Publish the privacy policy page at the URL above.

## License

MIT. See [LICENSE](LICENSE).
