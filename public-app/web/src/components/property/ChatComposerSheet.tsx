/**
 * First message to an agency about a listing. POST /me/threads returns the
 * (new or existing) thread; we navigate straight into it.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { errorMessage } from '@/services/api';
import { marketplace, qk } from '@/services/marketplace';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Input';
import { Chip } from '../ui/Chip';

const STARTERS = ['Is this still available?', 'Can I visit this weekend?', 'What is the final price?', 'Is the society pet-friendly?'];

export function ChatComposerSheet({ open, onClose, slug, propertyId, agencyName, title }: { open: boolean; onClose: () => void; slug: string; propertyId: string; agencyName: string; title: string }) {
  const [text, setText] = useState('');
  const toast = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const send = useMutation({
    mutationFn: () => marketplace.startThread({ slug, propertyId, text: text.trim() }),
    onSuccess: ({ thread }) => {
      void qc.invalidateQueries({ queryKey: qk.threads });
      onClose();
      setText('');
      navigate(`/me/enquiries/${encodeURIComponent(thread.threadId)}`);
    },
    onError: (e) => toast.error('Message not sent', errorMessage(e)),
  });

  const ready = text.trim().length >= 2;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Chat with ${agencyName}`}
      description={title}
      footer={
        <Button full size="lg" disabled={!ready} loading={send.isPending} onClick={() => send.mutate()} leftIcon={<Send size={16} aria-hidden />}>
          Send message
        </Button>
      }
    >
      <div className="no-scrollbar -mx-5 mb-3 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0">
        {STARTERS.map((s) => (
          <Chip key={s} size="sm" className="shrink-0" onClick={() => setText(s)}>
            {s}
          </Chip>
        ))}
      </div>
      <Textarea
        label="Your message"
        placeholder="Hi, I liked this flat. Kab dekh sakte hain?"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && ready) send.mutate();
        }}
        maxLength={1000}
        rows={4}
        autoFocus
        hint="Your name and number go to the agency with this message so they can reply."
      />
    </Sheet>
  );
}
