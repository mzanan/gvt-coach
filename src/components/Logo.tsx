'use client'

import Image from 'next/image'

export function Logo({ size = "42" }: { size?: string }) {
  return (
    <Image
      src="/gvtnomad_logo.svg"
      alt="GVTNomad Logo"
      width={parseInt(size)}
      height={parseInt(size)}
    />
  )
}