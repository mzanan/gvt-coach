'use client'

import GVTNomadLogo from '@/app/assets/images/gvtnomad_logo.svg'

export function Logo({ size = 42 }: { size?: number }) {
  return (
    <GVTNomadLogo width={size} height={size} />
  )
}