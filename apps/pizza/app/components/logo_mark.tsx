const logoPath =
  "M10.8 25V8.2h4.1v1.5c.9-1.2 2.2-1.8 3.9-1.8 4 0 6.7 3 6.7 7.1s-2.8 7.1-6.8 7.1c-1.6 0-2.9-.5-3.8-1.6V25h-4.1Zm7.3-6.4c1.9 0 3.1-1.4 3.1-3.6s-1.2-3.6-3.1-3.6c-1.9 0-3.2 1.4-3.2 3.6s1.3 3.6 3.2 3.6Z";

export function LogoMark({
  className,
}: {
  readonly className: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="3"
        y="3"
        width="26"
        height="26"
        rx="3.5"
        className="fill-[#F1C34B] stroke-foreground"
        strokeWidth="2.5"
      />
      <path d={logoPath} fill="currentColor" />
    </svg>
  );
}
