import { defineConfig, type Plugin } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const META_PIXEL_ID = '1089308590752584'

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

const GA_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]{4,20}$/

// 측정 ID는 Vercel Production 환경변수 GA_MEASUREMENT_ID로 받는다. 없거나 형식이 틀리면
// 주입하지 않아 로컬·Preview와 ID 미설정 배포에서는 GA4가 동작하지 않는다.
// page_view는 라우터가 정제한 주소로 직접 보내므로 자동 전송을 끄고,
// 방침에 없는 Google 신호·광고 개인화 신호도 끈다(src/app/lib/ga4.ts).
function ga4Plugin(): Plugin {
  return {
    name: 'catchhole-ga4',
    transformIndexHtml() {
      if (process.env.VERCEL_ENV !== 'production') return []

      const measurementId = process.env.GA_MEASUREMENT_ID?.trim() ?? ''
      if (!GA_MEASUREMENT_ID_PATTERN.test(measurementId)) {
        console.warn('[catchhole-ga4] 운영 빌드지만 GA_MEASUREMENT_ID가 없거나 형식이 올바르지 않아 GA4를 설치하지 않습니다.')
        return []
      }

      return [
        {
          tag: 'script',
          attrs: { async: true, src: `https://www.googletagmanager.com/gtag/js?id=${measurementId}` },
          injectTo: 'head',
        },
        {
          tag: 'script',
          children: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${measurementId}',{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false});`,
          injectTo: 'head',
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
    ga4Plugin(),
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
