import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { hasNativeRuntime } from '../lib/platform';

type SpeechRecognitionType = typeof window extends any
  ? any
  : any;

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

export default function SpeechToTextButton({
  onText,
  disabled,
  className,
  lang = 'en-IN',
}: {
  onText: (text: string) => void;
  disabled?: boolean;
  className?: string;
  lang?: string;
}) {
  const RecognitionCtor = useMemo(() => {
    if (typeof window === 'undefined') return null;
    // The Web Speech API is not implemented in either WKWebView or the Android
    // System WebView. The constructor is sometimes present but never produces
    // results, so the button would sit there looking functional and do nothing.
    // Hiding it is honest; a real implementation needs a native speech plugin.
    if (hasNativeRuntime()) return null;
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }, []);

  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    if (!RecognitionCtor) return;

    const recognition = new RecognitionCtor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res && res.isFinal && res[0]?.transcript) {
          finalText += res[0].transcript;
        }
      }
      if (finalText.trim()) {
        onText(finalText);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {
      }
      recognitionRef.current = null;
    };
  }, [RecognitionCtor, lang, onText]);

  const canUse = !!RecognitionCtor;
  const effectiveDisabled = !!disabled || !canUse;

  const toggle = () => {
    if (effectiveDisabled) return;

    const rec = recognitionRef.current;
    if (!rec) return;

    if (isListening) {
      try {
        rec.stop();
      } catch {
      }
      setIsListening(false);
      return;
    }

    try {
      rec.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={effectiveDisabled}
      className={
        className ||
        `p-2 rounded-lg border ${
          isListening ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-gray-300 text-gray-700'
        } hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed self-end`
      }
      aria-pressed={isListening}
      title={canUse ? (isListening ? 'Stop recording' : 'Start recording') : 'Speech to text not supported'}
    >
      {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
    </button>
  );
}
