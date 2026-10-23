import { MESSENGER_URL, ZALO_URL } from '../config';

function ZaloIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="24" fill="#0068ff" />
      <path
        d="M11.5 16a5.5 5.5 0 0 1 5.5-5.5h14a5.5 5.5 0 0 1 5.5 5.5v11a5.5 5.5 0 0 1-5.5 5.5H21l-6 4.5v-4.8a5.5 5.5 0 0 1-3.5-5.2z"
        fill="#fff"
      />
      <text
        x="24"
        y="25.2"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="9.6"
        fontWeight="700"
        fill="#0068ff"
      >
        Zalo
      </text>
    </svg>
  );
}

function MessengerIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="messenger-gradient" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#0099ff" />
          <stop offset="0.6" stopColor="#a033ff" />
          <stop offset="0.9" stopColor="#ff5280" />
          <stop offset="1" stopColor="#ff7061" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="24" fill="url(#messenger-gradient)" />
      <path
        d="M24 11c-7.3 0-13 5.4-13 12.6 0 3.8 1.6 7 4.2 9.3v4.4l4.1-2.3c1.4.4 3 .6 4.7.6 7.3 0 13-5.4 13-12.6S31.3 11 24 11z"
        fill="#fff"
      />
      <path d="m15.6 27.6 4.3-6.8 4.2 3.2 4.4-3.2-4.3 6.8-4.2-3.2z" fill="url(#messenger-gradient)" />
    </svg>
  );
}

/** Nút chat nổi góc phải dưới: mở Zalo / Messenger của shop (cấu hình VITE_ZALO, VITE_MESSENGER) */
export function ChatButtons() {
  if (!ZALO_URL && !MESSENGER_URL) return null;
  return (
    <div className="chat-buttons">
      {ZALO_URL && (
        <a href={ZALO_URL} target="_blank" rel="noopener noreferrer" className="chat-btn zalo" aria-label="Chat Zalo với shop">
          <span className="chat-pulse" aria-hidden="true" />
          <ZaloIcon />
          <span className="chat-tip">Chat Zalo</span>
        </a>
      )}
      {MESSENGER_URL && (
        <a
          href={MESSENGER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="chat-btn messenger"
          aria-label="Nhắn Messenger cho shop"
        >
          <span className="chat-pulse" aria-hidden="true" />
          <MessengerIcon />
          <span className="chat-tip">Nhắn Messenger</span>
        </a>
      )}
    </div>
  );
}
