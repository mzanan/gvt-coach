'use client'

export function Logo({ size = "42" }) {
  return (
    <div className="flex items-center cursor-pointer">
      <img
        alt="GVTNomad Logo"
        width={size}
        height={size}
        className="h-full"
        src="/gvtnomad_logo.svg"
      />
      <div className="flex flex-col items-end justify-center pl-1">
        <h1 className="text-[18px] sm:text-[22px] font-thin text-foreground mt-[2px] sm:mt-2 tracking-wider">
          GVT<span className="font-black">NOMAD</span>
        </h1>
        <h2 className="text-[8px] font-thin text-foreground uppercase -mt-2 tracking-wide">
          Crypto Trading
        </h2>
      </div>
    </div>
  )
} 