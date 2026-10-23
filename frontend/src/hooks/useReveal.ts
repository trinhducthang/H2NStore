import { useCallback } from 'react';

let observer: IntersectionObserver | undefined;

/** Một observer dùng chung: phần tử vào khung nhìn thì thêm .is-visible (chỉ một lần) */
function revealObserver() {
  observer ??= new IntersectionObserver(
    (entries, io) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    },
    // Hiện khi phần tử đã lên khỏi mép dưới màn hình một đoạn, không phải vừa chạm mép
    { rootMargin: '0px 0px -8% 0px' },
  );
  return observer;
}

/**
 * Ref cho phần tử có class "reveal": trượt lên và hiện dần khi cuộn tới (CSS .reveal.is-visible).
 * Dùng callback ref nên phần tử render sau (VD hết loading) vẫn được theo dõi.
 */
export function useReveal<T extends HTMLElement>() {
  return useCallback((el: T | null) => {
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-visible');
      return;
    }
    const io = revealObserver();
    io.observe(el);
    return () => io.unobserve(el);
  }, []);
}
