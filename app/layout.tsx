import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '月森守卫 · 口袋塔防',
  description:
    '在萤火之森建造防御塔、组合寒冰与火焰，守护八波月光冒险。为手机触控设计的塔防小游戏。',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
