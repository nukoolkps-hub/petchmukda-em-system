/* ─── Avatar renderer ──────────────────────────────────────────── */
export default function AvatarCircle({
  av,
  avType,
  img,
  size = 56,
  fontSize = 18,
  border,
  style = {},
}) {
  const base = {
    width: size,
    height: size,
    border: border || undefined,
    fontSize: avType === "emoji" ? size * 0.5 : fontSize,
    ...style,
  };
  if (avType === "image" && img) {
    return (
      <div
        className="rounded-full shrink-0 flex items-center justify-center overflow-hidden border-[2px] border-gold-lt/30"
        style={base}
      >
        <img src={img} alt="avatar" className="w-full h-full object-cover" />
      </div>
    );
  }
  if (avType === "emoji") {
    return (
      <div
        className="rounded-full shrink-0 flex items-center justify-center overflow-hidden bg-gold-pale border-[2px] border-gold-lt/30"
        style={base}
      >
        {av}
      </div>
    );
  }
  // text (initials)
  return (
    <div
      className="rounded-full shrink-0 flex items-center justify-center overflow-hidden bg-linear-135 from-gold to-gold-lt border-[2px] border-gold-lt/30"
      style={base}
    >
      <span
        className="text-white font-bold font-[inherit]"
        style={{ fontSize }}
      >
        {av}
      </span>
    </div>
  );
}
