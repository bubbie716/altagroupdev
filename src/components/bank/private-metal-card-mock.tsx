export function PrivateMetalCardMock() {
  return (
    <div
      className="relative aspect-[1.586/1] w-full max-w-[340px] overflow-hidden rounded-xl shadow-card ring-1 ring-white/[0.08]"
      style={{ background: "linear-gradient(145deg, #0c1018 0%, #060810 55%, #0a0e17 100%)" }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(255,255,255,0.06),transparent_50%)]" />
      <div className="relative flex h-full flex-col justify-between p-7">
        <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-white/45">Alta Private</div>
        <div>
          <div className="font-mono text-[13px] uppercase tracking-[0.28em] text-white/90">Alta Private</div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.24em] text-white/50">Metal Card</div>
        </div>
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/35">Cardholder</div>
          <div className="mt-1 text-[14px] font-medium tracking-wide text-white/85">Whitford Family Office</div>
        </div>
      </div>
    </div>
  );
}
