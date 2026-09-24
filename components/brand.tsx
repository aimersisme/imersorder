import Image from "next/image";

export function Brand({
  compact = false,
  showTagline = false,
}: {
  compact?: boolean;
  showTagline?: boolean;
}) {
  return (
    <div className={`brand ${showTagline ? "brandWithTagline" : ""}`}>
      <Image
        className="brandLogo"
        src="/pesanlunas-logo.png"
        width={44}
        height={44}
        alt="Logo iMersOrder"
        priority
      />
      {!compact ? (
        <span className="brandCopy">
          <span className="brandName">iMersOrder</span>
          {showTagline ? <span className="brandTagline">Katalog online, pesanan lebih teratur.</span> : null}
        </span>
      ) : null}
    </div>
  );
}
