import { cn } from "@/lib/utils";

export function NccLogo({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "h-7 w-7",
    md: "h-9 w-9",
    lg: "h-12 w-12",
  };

  return (
    <img
      src="/ncc-bridge-logo.png"
      alt="Newport Clearing Corporation"
      className={cn("shrink-0 object-contain", sizes[size], className)}
    />
  );
}

export function NccWordmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <NccLogo size="md" />
      <div className="leading-tight">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#4b5563]">
          Newport Clearing Corporation
        </div>
        <div className="text-[15px] font-semibold tracking-tight text-[#111827]">NCC</div>
      </div>
    </div>
  );
}
