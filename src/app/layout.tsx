import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata = { title:'ShellForge · 造物之海', description:'本地可玩的造物与传承原型' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="zh-CN"><body>{children}</body></html>; }
