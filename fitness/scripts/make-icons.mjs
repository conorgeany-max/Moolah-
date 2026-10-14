// Renders the PNG app icons from SVG using a headless Chromium.
// Usage: npm run icons   (needs the `playwright` package available to Node)
// The generated PNGs are committed, so this only needs re-running if the icon design changes.
import { writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const BG = '#0B0C0E'
const FG = '#D4FF3A'

// `scale` shrinks the mark inside the square: maskable icons need a ~20% safe zone.
const mark = (size, { rounded, scale = 1 }) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" ${rounded ? 'rx="112"' : ''} fill="${BG}"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <path d="M186 372 V148 H326 M186 262 H296" fill="none" stroke="${FG}" stroke-width="52" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`

const targets = [
  { file: 'public/icons/apple-touch-icon.png', size: 180, rounded: false }, // iOS applies its own mask
  { file: 'public/icons/icon-192.png', size: 192, rounded: true },
  { file: 'public/icons/icon-512.png', size: 512, rounded: true },
  { file: 'public/icons/icon-maskable-512.png', size: 512, rounded: false, scale: 0.78 },
]

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const page = await browser.newPage()
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size })
  await page.setContent(`<html><body style="margin:0;background:transparent">${mark(t.size, t)}</body></html>`)
  const png = await page.locator('svg').screenshot({ omitBackground: true })
  await writeFile(t.file, png)
  console.log('wrote', t.file)
}
await browser.close()
