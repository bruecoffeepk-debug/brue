'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const BUCKET = 'drink-photos';

export default function ImageUpload({
  name,
  defaultUrl,
}: {
  name: string;
  defaultUrl?: string | null;
}) {
  const [url, setUrl] = useState<string>(defaultUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);

    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const safe = file.name
        .replace(/\.[^/.]+$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const path = `${Date.now()}-${safe || 'drink'}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      setUrl(data.publicUrl);
    } catch (e: any) {
      setError(e?.message ?? 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setUrl('');
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div>
      {/* hidden input that the form submits */}
      <input type="hidden" name={name} value={url} />

      <div
        className="relative grid place-items-center overflow-hidden"
        style={{
          width: '100%',
          aspectRatio: '4 / 5',
          maxWidth: 280,
          borderRadius: 14,
          background: 'var(--cream)',
          border: '1px dashed var(--line-strong)',
        }}
      >
        {url ? (
          <>
            <Image src={url} alt="Drink photo" fill sizes="280px" className="object-cover" />
            <button
              type="button"
              onClick={clear}
              aria-label="Remove image"
              className="absolute top-2 right-2 z-10 inline-flex items-center justify-center rounded-full"
              style={{
                width: 28,
                height: 28,
                background: 'var(--ink)',
                color: 'var(--bone)',
              }}
            >
              <X size={14} />
            </button>
          </>
        ) : busy ? (
          <span className="inline-flex items-center gap-2" style={{ color: 'var(--ink-muted)' }}>
            <Loader2 size={14} className="animate-spin" /> Uploading…
          </span>
        ) : (
          <span
            className="flex flex-col items-center gap-2 text-center px-6"
            style={{ color: 'var(--ink-muted)' }}
          >
            <ImagePlus size={22} />
            <span style={{ fontSize: 12 }}>Drag a JPG/PNG, or click below.</span>
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="btn btn-outline btn-sm"
        >
          {busy ? 'Uploading…' : url ? 'Replace' : 'Upload photo'}
        </button>
        {url && (
          <span className="truncate" style={{ fontSize: 11, color: 'var(--ink-muted)', maxWidth: 200 }}>
            {url.split('/').pop()}
          </span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onPick}
        hidden
      />

      {error && (
        <p className="mt-2" style={{ color: 'var(--terra)', fontSize: 12 }}>
          {error}
        </p>
      )}
      <p className="mt-2" style={{ color: 'var(--ink-muted)', fontSize: 11 }}>
        Or paste a URL into the &quot;Photo URL&quot; field below — handy for quick edits.
      </p>
    </div>
  );
}
