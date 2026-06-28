import { Link } from 'react-router-dom';
import Avatar from './Avatar';

interface Props {
  completeness: number;
  profilePath: string;
}

export default function ProfileCompletionBanner({ completeness, profilePath }: Props) {
  if (completeness >= 80) return null;

  const isLow      = completeness < 40;
  const textColor  = isLow ? 'text-red-600'    : 'text-amber-600';
  const borderColor = isLow ? 'border-red-100' : 'border-amber-100';
  const btnBorder  = isLow ? 'border-red-300 text-red-600 hover:bg-red-50' : 'border-amber-300 text-amber-600 hover:bg-amber-50';

  return (
    <div className={`flex items-center gap-4 px-5 py-4 bg-white rounded-lg border ${borderColor} mb-6`}>
      <Avatar size="md" />
      <div className="flex-1 min-w-0">
        <p className={`text-[13.5px] font-bold ${textColor}`}>
          Your profile is {completeness}% complete
        </p>
        <p className="text-[12px] text-gray-500 mt-0.5">
          Complete your profile to unlock all platform features.
        </p>
      </div>
      <Link
        to={profilePath}
        className={`shrink-0 text-[12.5px] font-semibold px-4 py-2 rounded-lg border transition-colors ${btnBorder}`}
      >
        Complete profile
      </Link>
    </div>
  );
}
