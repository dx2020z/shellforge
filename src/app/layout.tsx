import type { Metadata, Viewport } from 'next';
import '@/ui/tokens.css';

export const metadata: Metadata = {
  title: 'ShellForge 造物之海',
  description: '写下一句话，它就成为你的造物。带着它潜入深海，挑战遗迹守卫。',
  applicationName: 'ShellForge',
};

export const viewport: Viewport = {
  themeColor: '#07130F',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // 浏览器插件（比如翻译、侧边栏）常会往 html/body 上加属性，这里忽略这类不影响游戏的差异。
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <link rel="preload" href="/fonts/noto-serif-sc.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/noto-sans-sc.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
