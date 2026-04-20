import type { SVGProps } from 'react';
import { cn } from './cn';

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

function BaseIcon({
  size = 20,
  className,
  children,
  viewBox = '0 0 24 24',
  ...props
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      aria-hidden="true"
      className={cn('shrink-0', className)}
      {...props}
    >
      {children}
    </svg>
  );
}

export function BrandMarkIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.5" opacity="0.9" />
      <circle cx="12" cy="12" r="5.5" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
      <path d="M10 8.8v6.4l5.2-3.2L10 8.8Z" fill="currentColor" />
    </BaseIcon>
  );
}

export function ChatBubbleIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        d="M6.5 8.25A3.75 3.75 0 0 1 10.25 4.5h3.5A3.75 3.75 0 0 1 17.5 8.25v4.1a3.75 3.75 0 0 1-3.75 3.75h-1.7L8.2 19.1v-3A3.75 3.75 0 0 1 6.5 12.35v-4.1Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9.75 9.75h4.5M9.75 12.5h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </BaseIcon>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        d="M8.25 11.75a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5ZM15.75 10.75a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M4.75 18c.55-2.1 2.21-3.5 4.5-3.5s3.95 1.4 4.5 3.5M13.85 18c.39-1.45 1.49-2.4 3.15-2.4 1.02 0 1.86.36 2.5 1.04"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </BaseIcon>
  );
}

export function VideoIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="4.25" y="6.25" width="11.5" height="11.5" rx="2.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M15.75 10.25 19.5 8.5v7l-3.75-1.75v-3.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9.5 10v4l3.25-2L9.5 10Z" fill="currentColor" />
    </BaseIcon>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        d="M18.25 8.75A6.5 6.5 0 0 0 6.9 6.9M5.75 8.5V5.25H9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.75 15.25A6.5 6.5 0 0 0 17.1 17.1m1.15-1.4v3.05H15"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </BaseIcon>
  );
}

export function ArrowUpRightIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M8 16 16 8M10 8h6v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </BaseIcon>
  );
}

export function LayoutPanelIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="4.5" y="5.5" width="15" height="13" rx="2.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 5.5v13" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13.5 9h3M13.5 12h3M13.5 15h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </BaseIcon>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="8" y="7" width="9.5" height="11" rx="1.8" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M6.5 15.5H6A1.75 1.75 0 0 1 4.25 13.75V6.75C4.25 5.78 5.03 5 6 5h6.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </BaseIcon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        d="m6.75 12.35 3.25 3.15 7.25-7.25"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </BaseIcon>
  );
}
