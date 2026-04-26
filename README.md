# VisionSync AI — Desktop App
### College Course Visualizer • Powered by Google Gemini

---

## What it does

Upload an `.srt` or `.vtt` subtitle file from any lecture and VisionSync will:
- Analyse every segment with **Gemini 2.0 Flash** (text)
- Detect chemical reactions, biological processes, physics concepts, diagrams, and more
- Extract chemical equations (e.g. `2H₂ + O₂ → 2H₂O`) and write specialized image prompts
- Generate photorealistic educational images with **Gemini 2.0 Flash Image**
- Export a ZIP with all images + an Adobe Premiere Pro XML timeline

---

## API Key

Only one key needed: **Google Gemini** — get it free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

- Keys always start with `AIzaSy` and are 39 characters long
- The app validates format before even calling Google
- Then does a live test call to verify the key works
- Stored in browser localStorage, only on your device, never transmitted anywhere

---

## Build the .exe (GitHub Actions — no local setup needed)

1. Push this folder to a new GitHub repository
2. Go to **Actions** → **Build VisionSync AI Desktop App** → **Run workflow**
3. Wait ~5 minutes
4. Download `VisionSync-AI-Windows-exe` from the Artifacts section
5. Extract and double-click the `.exe` — installs like any normal Windows app

> Pushing a tag (`git tag v2.0.0 && git push --tags`) also creates a GitHub Release
> with download links for Windows, macOS, and Linux.

---

## Build locally (Windows only)

```bash
npm install
npm run electron:build
# Output → release/VisionSync-AI-Setup-2.0.0.exe
```

## Dev mode

```bash
npm install
npm run electron:dev   # Vite + Electron together, hot reload
```

---

## Project Structure

```
├── electron/
│   ├── main.js          # Window creation, native menus, file open dialog
│   ├── preload.js       # Secure IPC bridge (renderer ↔ main)
│   └── icon.ico / .png  # App icons
├── src/
│   ├── App.tsx                    # Main UI shell
│   ├── components/
│   │   ├── ApiKeyModal.tsx        # Gemini key entry with live validation
│   │   └── ui/                    # shadcn/ui components
│   └── lib/
│       ├── apiKey.ts              # localStorage key management + format check
│       ├── geminiService.ts       # Gemini text + image API calls
│       ├── subtitleParser.ts      # SRT / VTT parser
│       └── xmlGenerator.ts        # Premiere Pro XMEML exporter
└── .github/workflows/build.yml    # CI: builds .exe, .dmg, .AppImage
```

---

## Gemini models used

| Feature | Model |
|---|---|
| Script analysis & scene detection | `gemini-2.0-flash` |
| Image generation | `gemini-2.0-flash-preview-image-generation` |

Both use the **same single API key**. No other services, no backend, no database.
