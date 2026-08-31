type BrandLogoProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
};

const widths = { sm: 132, md: 180, lg: 280 };

export function BrandLogo({ className, size = "md" }: BrandLogoProps) {
  const src = `${import.meta.env.BASE_URL}rustiq-logo.png`;
  return (
    <img
      className={className}
      src={src}
      alt="Rustiq"
      width={widths[size]}
      height={Math.round(widths[size] * 0.31)}
      decoding="async"
    />
  );
}
