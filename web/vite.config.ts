/// <reference types="vitest/config" />
import preact from '@preact/preset-vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [preact()],
  base: './',
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
})
