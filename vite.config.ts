import { defineConfig, type Plugin } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const META_PIXEL_ID = '3483583581809046'

function metaPixelPlugin(): Plugin {
  return {
    name: 'catchhole-meta-pixel',
    transformIndexHtml() {
      if (process.env.VERCEL_ENV !== 'production') return []

      return [
        {
          tag: 'script',
          children: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.addEventListener('load',function(){window.dispatchEvent(new Event('meta-pixel-ready'))});t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL_ID}');`,
          injectTo: 'head',
        },
        {
          tag: 'noscript',
          children: `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${META_PIXEL_ID}&amp;ev=PageView&amp;noscript=1" alt="" />`,
          injectTo: 'body-prepend',
        },
      ]
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    metaPixelPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
  server: {
    port: 3000,
  },
})
