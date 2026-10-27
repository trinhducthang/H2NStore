import { useEffect, useRef, useState } from 'react';
import { authApi } from '../api/auth';

export type GoogleButtonText = 'signin_with' | 'signup_with' | 'continue_with';

/** Phần đang dùng của Google Identity Services: https://developers.google.com/identity/gsi/web/reference/js-reference */
interface GoogleIdApi {
  initialize(config: {
    client_id: string;
    callback: (response: { credential: string }) => void;
    ux_mode?: 'popup' | 'redirect';
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'large' | 'medium' | 'small';
      text?: GoogleButtonText;
      shape?: 'rectangular' | 'pill' | 'circle' | 'square';
      logo_alignment?: 'left' | 'center';
      width?: number;
      locale?: string;
    },
  ): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
  }
}

const GSI_SRC = 'https://accounts.google.com/gsi/client';

let prepared: Promise<string | null> | null = null;
let initializedFor: string | null = null;
/** initialize() chỉ gọi 1 lần cho cả trang, callback của nó chuyển ID token tới nút đang hiện */
let activeHandler: ((credential: string) => void) | null = null;

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      reject(new Error('Không tải được thư viện đăng nhập của Google'));
    };
    document.head.appendChild(script);
  });
}

/** Client ID nếu shop bật đăng nhập Google và tải được thư viện của Google (trình chặn quảng cáo có thể chặn) */
function prepareGoogle(): Promise<string | null> {
  if (!prepared) {
    prepared = (async () => {
      const { googleClientId } = await authApi.config();
      if (!googleClientId) return null;
      if (!window.google?.accounts?.id) await loadScript();
      return googleClientId;
    })().catch(() => {
      prepared = null; // lần sau mở trang đăng nhập thì thử lại
      return null;
    });
  }
  return prepared;
}

interface Props {
  text: GoogleButtonText;
  /** Nhận ID token để gửi backend; trang gọi tự hiện lỗi */
  onCredential: (credential: string) => Promise<void>;
}

/** Nút Google (Google tự vẽ trong iframe) kèm dòng "hoặc"; không hiện gì nếu shop chưa bật hoặc không tải được. */
export function GoogleSignInButton({ text, onCredential }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    prepareGoogle().then((id) => {
      if (!cancelled) setClientId(id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    activeHandler = async (credential) => {
      setBusy(true);
      try {
        await onCredential(credential);
      } finally {
        setBusy(false);
      }
    };
    return () => {
      activeHandler = null;
    };
  }, [onCredential]);

  useEffect(() => {
    const el = ref.current;
    const gsi = window.google?.accounts.id;
    if (!clientId || !el || !gsi) return;
    if (initializedFor !== clientId) {
      gsi.initialize({ client_id: clientId, callback: (res) => activeHandler?.(res.credential), ux_mode: 'popup' });
      initializedFor = clientId;
    }
    gsi.renderButton(el, {
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text,
      logo_alignment: 'center',
      locale: 'vi',
      // Google chỉ nhận độ rộng 200-400px
      width: Math.max(200, Math.min(400, el.clientWidth)),
    });
    return () => el.replaceChildren();
  }, [clientId, text]);

  if (!clientId) return null;
  return (
    <div className="google-signin">
      <div className="auth-divider" role="separator">
        hoặc
      </div>
      <div ref={ref} className="google-signin-button" />
      {busy && <p className="muted small center">Đang đăng nhập bằng Google...</p>}
    </div>
  );
}
