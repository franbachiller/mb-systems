export default function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-mark ${compact ? "brand-mark--compact" : ""}`}>
      <span className="brand-mark__initials">MB</span>
      <span className="brand-mark__word">Systems</span>
    </span>
  );
}
