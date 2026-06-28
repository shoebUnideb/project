import { useState } from 'react';
import { X, Star } from 'lucide-react';
import { ratingsApi } from '../../api/ratings';

interface Props {
  mentorId: number;
  mentorName: string;
  existingRating?: number;
  existingReview?: string;
  onClose: () => void;
  onRated: () => void;
}

export default function RateMentorModal({ mentorId, mentorName, existingRating, existingReview, onClose, onRated }: Props) {
  const [rating, setRating] = useState(existingRating ?? 0);
  const [hover, setHover] = useState(0);
  const [review, setReview] = useState(existingReview ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (rating < 1) { setError('Please select a star rating.'); return; }
    setLoading(true);
    setError('');
    try {
      await ratingsApi.rate(mentorId, rating, review);
      onRated();
    } catch {
      setError('Failed to submit rating. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];
  const active = hover || rating;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-bold text-gray-900">Rate your mentor</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <p className="text-[13px] text-gray-500 mb-5">How would you rate your experience with <span className="font-semibold text-gray-700">{mentorName}</span>?</p>

        {/* Star selector */}
        <div className="flex items-center gap-1 mb-1 justify-center">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              className="transition-transform hover:scale-110"
            >
              <Star
                size={32}
                className={n <= active ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}
              />
            </button>
          ))}
        </div>
        <p className="text-center text-[12px] text-amber-600 font-semibold mb-5 h-4">
          {active ? LABELS[active] : ''}
        </p>

        <textarea
          rows={3}
          value={review}
          onChange={e => setReview(e.target.value)}
          placeholder="Leave a review (optional)…"
          className="w-full px-3.5 py-2.5 text-[13px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none mb-4"
        />

        {error && <p className="text-[12px] text-red-600 mb-3">{error}</p>}

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-[13px] text-gray-500 hover:text-gray-700">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || rating < 1}
            className="px-5 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-[13px] font-semibold rounded-lg transition-colors"
          >
            {loading ? 'Submitting…' : existingRating ? 'Update rating' : 'Submit rating'}
          </button>
        </div>
      </div>
    </div>
  );
}
