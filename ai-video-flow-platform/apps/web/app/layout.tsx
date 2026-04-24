import { Inter } from "next/font/google"

import "@workspace/ui/globals.css"

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata = {
  title: 'AI Video Flow',
  description: 'Automated short-form video generation for your brand',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`} style={{ background: '#0A0A0A', color: '#fff' }}>
        {children}
      </body>
    </html>
  )
}
