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

export function XIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        d="m7.5 7.5 9 9m0-9-9 9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </BaseIcon>
  );
}

export function WarningCircleIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="8.75" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 8.1v4.65"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="12" cy="15.95" r="1.05" fill="currentColor" />
    </BaseIcon>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        d="M8 7.25h8m-6.2 0V5.9c0-.72.58-1.3 1.3-1.3h1.8c.72 0 1.3.58 1.3 1.3v1.35m-7.3 0 .65 9.15c.06.86.77 1.53 1.63 1.53h4.04c.86 0 1.57-.67 1.63-1.53l.65-9.15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10.35 10.2v4.45m3.3-4.45v4.45" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </BaseIcon>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M9 7.8v8.4L16.1 12 9 7.8Z" fill="currentColor" />
    </BaseIcon>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="8" y="7.25" width="2.85" height="9.5" rx="1.2" fill="currentColor" />
      <rect x="13.15" y="7.25" width="2.85" height="9.5" rx="1.2" fill="currentColor" />
    </BaseIcon>
  );
}

export function RewindIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M10.55 8.2 5.6 12l4.95 3.8V8.2Zm7.35 0L12.95 12l4.95 3.8V8.2Z" fill="currentColor" />
    </BaseIcon>
  );
}

export function ForwardIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m13.45 8.2 4.95 3.8-4.95 3.8V8.2ZM6.1 8.2 11.05 12 6.1 15.8V8.2Z" fill="currentColor" />
    </BaseIcon>
  );
}

export function FullscreenIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        d="M8.3 4.8H5.8v2.5m0 9.4v2.5h2.5m10.1-14.4h-2.5v2.5m0 9.4v2.5h2.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </BaseIcon>
  );
}

export function VolumeIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        d="M5.5 10.1h2.9l3.55-2.9v9.6L8.4 13.9H5.5v-3.8Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M15.2 9.25a3.65 3.65 0 0 1 0 5.5m1.95-7.55a6.35 6.35 0 0 1 0 9.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </BaseIcon>
  );
}

export function KeyboardIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="4.5" y="7" width="15" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M7.35 10.2h.01m2.2 0h.01m2.18 0h.01m2.2 0h.01M7.35 13.1h5.35m3.15 0h1.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </BaseIcon>
  );
}
