ICONS NEEDED FOR BUILD:
  icon.ico  — Windows icon (256x256, ICO format)
  icon.icns — macOS icon (512x512, ICNS format)
  icon.png  — Linux icon (512x512, PNG format)

You can generate these from a single PNG using:
  https://www.img2ico.net/      (PNG → ICO)
  https://cloudconvert.com/     (PNG → ICNS)

Or use electron-icon-builder:
  npx electron-icon-builder --input=icon-source.png --output=electron/

Suggested icon: dark blue background, white "VS" monogram or film reel symbol.
