import * as React from "react";

import { cn } from "@/lib/utils";

function mergeRefs<T>(...refs: (React.Ref<T> | undefined)[]) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    }
  };
}

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea"> & { autoResize?: boolean }
>(({ className, autoResize = true, onInput, onChange, rows, ...props }, ref) => {
  const innerRef = React.useRef<HTMLTextAreaElement>(null);

  const resize = React.useCallback(() => {
    const el = innerRef.current;
    if (!el || !autoResize) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [autoResize]);

  React.useLayoutEffect(() => {
    resize();
  }, [resize, props.value, props.defaultValue]);

  React.useEffect(() => {
    if (!autoResize) return;
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [autoResize, resize]);

  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full resize-none rounded-md border border-border bg-surface-1 px-3.5 py-2.5 text-base transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:border-gold/60 focus-visible:ring-1 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        autoResize && "overflow-hidden",
        className,
      )}
      ref={mergeRefs(ref, innerRef)}
      rows={autoResize ? 1 : rows}
      onInput={(e) => {
        if (autoResize) resize();
        onInput?.(e);
      }}
      onChange={(e) => {
        onChange?.(e);
        if (autoResize) resize();
      }}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
