import type { SVGProps } from 'react';

type AppLogoMarkProps = SVGProps<SVGSVGElement> & {
  title?: string;
};

export function AppLogoMark({ className = 'h-10 w-10', title = 'Life Ledger', ...props }: AppLogoMarkProps) {
  return (
    <svg
      aria-label={title}
      className={className}
      fill="none"
      role="img"
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <title>{title}</title>
      <rect width="64" height="64" rx="18" fill="#4F46E5" />
      <path d="M64 18v28.5C58.6 54.6 49.4 60 38.9 60H18C28.6 48.6 43.1 29.7 49.6 8.5A18 18 0 0 1 64 18Z" fill="#6366F1" opacity="0.58" />
      <path d="M18.5 19.5c0-2.2 1.8-4 4-4h20.1c2.2 0 4 1.8 4 4v25c0 2.2-1.8 4-4 4H22.5c-2.2 0-4-1.8-4-4v-25Z" fill="white" opacity="0.14" />
      <path d="M24 21v24h10.5M38.5 21v18.5H47" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5.2" />
      <path d="M25 31.5h7.5M39 31.5h5.5" stroke="#C7D2FE" strokeLinecap="round" strokeWidth="2.4" />
      <path d="M47 13l1.45 4.05L52.5 18.5l-4.05 1.45L47 24l-1.45-4.05-4.05-1.45 4.05-1.45L47 13Z" fill="white" />
      <circle cx="24" cy="45" r="2" fill="#C7D2FE" />
      <circle cx="39" cy="39.5" r="2" fill="#C7D2FE" />
    </svg>
  );
}
