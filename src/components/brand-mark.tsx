import Image from "next/image";

export default function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-mark ${compact ? "brand-mark--compact" : ""}`}>
      <Image
        src="/brand/mb-logo-dark-v2.png"
        width={974}
        height={502}
        sizes={compact ? "144px" : "(max-width: 640px) 168px, 192px"}
        alt="MB Servicios para Eventos"
        loading="eager"
        unoptimized
        className="brand-mark__image"
      />
    </span>
  );
}
