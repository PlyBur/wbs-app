import { cn, getInitials, avatarColour } from "@/lib/utils"

interface AvatarProps {
  name: string
  imageUrl?: string | null
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizeMap = { sm: "w-7 h-7 text-xs", md: "w-9 h-9 text-sm", lg: "w-12 h-12 text-base" }

export function Avatar({ name, imageUrl, size = "md", className }: AvatarProps) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={cn("rounded-full object-cover", sizeMap[size], className)}
      />
    )
  }
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-semibold text-white shrink-0",
        avatarColour(name),
        sizeMap[size],
        className
      )}
    >
      {getInitials(name)}
    </div>
  )
}
