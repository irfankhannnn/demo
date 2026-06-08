import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getIdToken } from '../utils/authStorage';

const API_URL = import.meta.env.VITE_API_URL as string;
const NPS_LAST_ASKED_KEY = 'nps_last_asked';
const NPS_DISMISSED_KEY = 'nps_dismissed_at';
const NPS_THROTTLE_DAYS = 90;
const NPS_MIN_AGE_DAYS = 14;

type Step = 'score' | 'feedback' | 'done';

export default function NpsModal() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<Step>('score');
  const [score, setScore] = useState<number | null>(null);
  const [freeText, setFreeText] = useState('');
  const [shareTestimonial, setShareTestimonial] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const checkEligibility = () => {
      try {
        const idToken = getIdToken();
        if (!idToken) return;

        // Check throttle
        const lastAsked = localStorage.getItem(NPS_LAST_ASKED_KEY);
        if (lastAsked) {
          const daysSince = (Date.now() - Number(lastAsked)) / 86400000;
          if (daysSince < NPS_THROTTLE_DAYS) return;
        }

        // Check dismissed recently (same session cooldown)
        const dismissed = localStorage.getItem(NPS_DISMISSED_KEY);
        if (dismissed) {
          const hoursSince = (Date.now() - Number(dismissed)) / 3600000;
          if (hoursSince < 24) return;
        }

        // Check user age — we use a conservative delay to avoid showing to brand new users
        // In production, this would check user.createdAt from profile
        const profileStr = localStorage.getItem('userProfile');
        if (profileStr) {
          try {
            const profile = JSON.parse(profileStr);
            if (profile.createdAt) {
              const ageMs = Date.now() - new Date(profile.createdAt).getTime();
              if (ageMs < NPS_MIN_AGE_DAYS * 86400000) return;
            }
          } catch {
            // If profile parse fails, still show NPS (graceful degradation)
          }
        }

        // Show with a 3-second delay to not interrupt the user immediately
        setTimeout(() => setVisible(true), 3000);
      } catch {
        // silently fail
      }
    };

    checkEligibility();
  }, []);

  const handleScoreSelect = (s: number) => {
    setScore(s);
    setStep('feedback');
  };

  const handleSubmit = async () => {
    if (score === null) return;
    if (score <= 6 && freeText.trim().length < 20) {
      setError('Please provide at least 20 characters of feedback.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const idToken = getIdToken();
      await fetch(`${API_URL}/api/feedback/nps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ score, freeText: freeText.trim() || undefined, shareTestimonial }),
      });

      localStorage.setItem(NPS_LAST_ASKED_KEY, String(Date.now()));
      setStep('done');
    } catch {
      setError('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(NPS_DISMISSED_KEY, String(Date.now()));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[90] w-[380px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b">
        <span className="text-sm font-semibold text-gray-700">Quick feedback</span>
        <button onClick={handleDismiss} className="p-1 text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-5">
        {step === 'score' && (
          <>
            <p className="text-sm font-medium text-gray-900 mb-4">
              How likely are you to recommend RealEstateFlow to a fellow Mumbai broker?
            </p>
            <div className="grid grid-cols-11 gap-1 mb-2">
              {Array.from({ length: 11 }, (_, i) => (
                <button
                  key={i}
                  onClick={() => handleScoreSelect(i)}
                  className={`h-10 w-full rounded-lg text-xs font-medium transition-all border ${
                    score === i
                      ? 'bg-green-500 text-white border-green-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 px-1">
              <span>Not likely</span>
              <span>Definitely would</span>
            </div>
          </>
        )}

        {step === 'feedback' && score !== null && (
          <>
            <p className="text-sm font-medium text-gray-900 mb-1">
              You selected <span className="text-blue-600">{score}/10</span>
            </p>
            <p className="text-xs text-gray-500 mb-3">
              {score <= 6
                ? 'What would have made this a 9 or 10?'
                : score <= 8
                ? 'What could we improve?'
                : 'What do you love most?'}
            </p>
            <textarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="Your feedback..."
              rows={3}
              className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
            {score <= 6 && (
              <p className="text-[10px] text-gray-400 mt-1">Required — min 20 characters ({freeText.length}/20)</p>
            )}
            {score >= 9 && (
              <label className="flex items-center gap-2 mt-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shareTestimonial}
                  onChange={(e) => setShareTestimonial(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                <span className="text-xs text-gray-600">May we share your testimonial?</span>
              </label>
            )}
            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="mt-4 w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Submitting...' : 'Submit feedback'}
            </button>
          </>
        )}

        {step === 'done' && (
          <div className="text-center py-4">
            <p className="text-lg font-semibold text-gray-900 mb-2">Thank you!</p>
            <p className="text-sm text-gray-600">Your feedback shapes our Month 2 roadmap.</p>
            {score !== null && score >= 9 && (
              <p className="text-xs text-gray-400 mt-2">We may reach out to feature your success story.</p>
            )}
            <button
              onClick={() => setVisible(false)}
              className="mt-4 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
