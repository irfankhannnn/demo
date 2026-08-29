import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL as string;

export default function NpsEmailLanding() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>('loading');
  const [score, setScore] = useState<number>(0);
  const [freeText, setFreeText] = useState('');
  const [shareTestimonial, setShareTestimonial] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const urlScore = searchParams.get('score');
  const token = searchParams.get('token');
  const userId = searchParams.get('userId');

  useEffect(() => {
    if (!urlScore || !token || !userId) {
      setStatus('invalid');
      return;
    }

    fetch(`${API_URL}/feedback?score=${urlScore}&token=${token}&userId=${userId}`)
      .then((res) => {
        if (res.ok) {
          setScore(Number(urlScore));
          setStatus('valid');
        } else {
          setStatus('invalid');
        }
      })
      .catch(() => setStatus('invalid'));
  }, [urlScore, token, userId]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/feedback/nps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score,
          freeText: freeText.trim() || undefined,
          shareTestimonial,
          source: 'email-link',
          userId,
        }),
      });
      if (!res.ok) {
        setError('Failed to submit feedback. Please try again.');
        return;
      }
      setSubmitted(true);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Validating your link...</p>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow p-8 max-w-md text-center">
          <p className="text-lg font-semibold text-gray-900 mb-2">This link has expired</p>
          <p className="text-gray-600 text-sm">
            Please open the app to submit your feedback.
          </p>
          <a
            href="https://app.realestateflow.in"
            className="mt-4 inline-block bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Open RealEstateFlow
          </a>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow p-8 max-w-md text-center">
          <p className="text-lg font-semibold text-gray-900 mb-2">Thank you!</p>
          <p className="text-gray-600 text-sm">Your feedback shapes our Month 2 roadmap.</p>
          {score >= 9 && (
            <p className="text-xs text-gray-400 mt-2">We may reach out to feature your success story.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow p-8 max-w-md w-full">
        <h1 className="text-lg font-bold text-gray-900 mb-1">Your score: {score}/10</h1>
        <p className="text-sm text-gray-600 mb-4">
          {score <= 6
            ? 'What would have made this a 9 or 10?'
            : score <= 8
            ? 'What could we improve?'
            : 'What do you love most about RealEstateFlow?'}
        </p>
        <textarea
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder="Your feedback..."
          rows={4}
          className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none focus:border-blue-500 outline-none"
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
        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}
        <button
          onClick={handleSubmit}
          disabled={submitting || (score <= 6 && freeText.trim().length < 20)}
          className="mt-4 w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit feedback'}
        </button>
      </div>
    </div>
  );
}
