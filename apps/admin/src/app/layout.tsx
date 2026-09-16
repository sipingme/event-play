import Providers from '@/components/layout/providers';
import ThemeProvider from '@/components/themes/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import type { Metadata } from 'next';
import '../styles/globals.css';
import '../styles/eventplay.css';
export const metadata: Metadata = {
  title: 'EventPlay · 活动工作台',
  description: '一句话，生成你的专属现场互动。',
  robots: { index: false, follow: false }
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='zh-CN' suppressHydrationWarning data-theme='vercel'>
      <body className='bg-background font-sans text-sm antialiased'>
        <ThemeProvider
          attribute='class'
          defaultTheme='light'
          enableSystem
          disableTransitionOnChange
        >
          <Providers activeThemeValue='vercel'>
            <Toaster />
            {children}
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
