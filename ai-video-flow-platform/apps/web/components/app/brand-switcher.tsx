'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

type Brand = { id: string; name: string; blogId: string }

interface Props {
  brands: Brand[]
}

export function BrandSwitcher({ brands }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const activeBrand = searchParams.get('brand')
  const current = brands.find(b => b.id === activeBrand) ?? null
  const label = current ? current.name : 'All Brands'

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (brands.length === 0) return null

  function select(id: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (id) params.set('brand', id)
    else params.delete('brand')
    router.push(`${pathname}?${params.toString()}`)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-[6px] rounded-full px-3 py-[6px] text-[12px] font-semibold"
        style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="w-[7px] h-[7px] rounded-full" style={{ background: '#9D6BF5' }} />
        {label}
        <span style={{ color: '#52525B' }}>⌄</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 rounded-[12px] py-1 z-50 min-w-[160px]"
          style={{ background: '#1A1A1F', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <button
            onClick={() => select(null)}
            className="flex items-center w-full px-3 py-[7px] text-[12px] font-medium text-left hover:bg-white/5"
            style={{ color: !current ? '#9D6BF5' : '#E4E4E7' }}
          >
            All Brands
          </button>
          {brands.map(b => (
            <button
              key={b.id}
              onClick={() => select(b.id)}
              className="flex items-center w-full px-3 py-[7px] text-[12px] font-medium text-left hover:bg-white/5 truncate"
              style={{ color: current?.id === b.id ? '#9D6BF5' : '#E4E4E7' }}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
