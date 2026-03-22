import { readFileSync } from 'fs'
import { resolve } from 'path'
import { homedir } from 'os'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function readApiKey(relativePath: string): string {
  try {
    return readFileSync(resolve(homedir(), relativePath), 'utf-8').trim()
  } catch {
    console.warn(`API key not found: ~/${relativePath}`)
    return ''
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(
      readApiKey('.gemini/apikeys/aigle-movie-image')
    ),
    'import.meta.env.VITE_OPENAI_API_KEY': JSON.stringify(
      readApiKey('.openai/apikeys/aigle')
    ),
  },
})
