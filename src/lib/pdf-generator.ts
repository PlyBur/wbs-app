import path from "path"

// Common Chrome paths on Windows, Mac, Linux
const CHROME_PATHS = [
  // Windows
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  // Windows - per-user install
  ...(process.env.LOCALAPPDATA ? [path.join(process.env.LOCALAPPDATA, "Google\\Chrome\\Application\\chrome.exe")] : []),
  // Mac
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  // Linux
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
]

async function findChrome(): Promise<string | null> {
  const fs = await import("fs")
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p
  }
  return null
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const chromePath = await findChrome()
  if (!chromePath) {
    throw new Error(
      "Chrome not found. Install Google Chrome, or set CHROME_PATH in your .env.local"
    )
  }

  // Dynamic import to avoid issues during build
  const puppeteer = await import("puppeteer-core")
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH ?? chromePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: "load" })
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
