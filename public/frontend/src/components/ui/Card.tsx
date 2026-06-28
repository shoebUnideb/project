import type { ReactNode, CSSProperties } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
  hoverable?: boolean;
  style?: CSSProperties;
}

const PAD = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6' };

export default function Card({
  children,
  className = '',
  padding = 'md',
  onClick,
  hoverable = false,
  style,
}: Props) {
  return (
    <div
      onClick={onClick}
      style={style}
      className={[
        'bg-white rounded-lg border border-[#e0e0e0]',
        PAD[padding],
        hoverable ? 'cursor-pointer transition-colors hover:border-gray-300' : '',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}
