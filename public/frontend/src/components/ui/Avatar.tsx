interface Props {
  src?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  className?: string;
}

const SIZE_MAP = {
  xs:  'w-5  h-5',
  sm:  'w-7  h-7',
  md:  'w-9  h-9',
  lg:  'w-12 h-12',
  xl:  'w-16 h-16',
  '2xl': 'w-48 h-48',
  '3xl': 'w-64 h-64',
};

// SVG placeholder: grey bg + white user silhouette
function PlaceholderIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect width="100" height="100" fill="#b0b3b8" />
      <circle cx="50" cy="38" r="20" fill="white" />
      <ellipse cx="50" cy="85" rx="30" ry="22" fill="white" />
    </svg>
  );
}

export default function Avatar({ src, name = '', size = 'md', className = '' }: Props) {
  const sizeClass = SIZE_MAP[size];

  return (
    <div className={`${sizeClass} rounded-lg overflow-hidden shrink-0 ${className}`}>
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        <PlaceholderIcon className="w-full h-full" />
      )}
    </div>
  );
}
