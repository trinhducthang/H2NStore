import { useState } from 'react';

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // thử cách cũ bên dưới
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

export function CopyButton({ text, label = 'Sao chép' }: { text: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  return (
    <button
      type="button"
      className={`btn btn-sm ${state === 'copied' ? 'btn-success' : 'btn-outline'}`}
      onClick={async () => {
        const ok = await copyText(text);
        setState(ok ? 'copied' : 'failed');
        window.setTimeout(() => setState('idle'), 1800);
      }}
    >
      {state === 'copied' ? 'Đã chép ✓' : state === 'failed' ? 'Không chép được' : label}
    </button>
  );
}
