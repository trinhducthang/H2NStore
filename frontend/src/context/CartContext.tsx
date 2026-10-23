import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { cartApi } from '../api/cart';
import { ApiError } from '../api/client';
import type { CartResponse } from '../api/types';
import { MAX_CART_LINES, MAX_QUANTITY } from '../config';
import { useAuth } from './AuthContext';

/** Một dòng giỏ hàng, dùng chung cho giỏ localStorage (khách vãng lai) và giỏ server (đã đăng nhập). */
export interface CartLine {
  variantId: number;
  /** id dòng trong giỏ server; không có với giỏ local */
  itemId?: number;
  productId: number;
  productName: string;
  productSlug: string;
  variantName: string;
  thumbnailUrl?: string | null;
  unitPrice: number;
  originalPrice?: number | null;
  quantity: number;
  lineTotal: number;
  stock?: number;
  /** false: sản phẩm ngừng bán / không đủ hàng (chỉ biết được với giỏ server) */
  available: boolean;
}

/** Ảnh chụp thông tin sản phẩm lúc thêm vào giỏ local, để hiển thị khi chưa đăng nhập. */
export interface CartSnapshot {
  variantId: number;
  productId: number;
  productName: string;
  productSlug: string;
  variantName: string;
  thumbnailUrl?: string | null;
  unitPrice: number;
  originalPrice?: number | null;
  stock?: number;
}

type LocalItem = CartSnapshot & { quantity: number };

interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  loading: boolean;
  isServerCart: boolean;
  add: (snapshot: CartSnapshot, quantity: number) => Promise<void>;
  setQuantity: (variantId: number, quantity: number) => Promise<void>;
  remove: (variantId: number) => Promise<void>;
  /** Gọi sau khi đặt hàng thành công */
  clearOrdered: () => Promise<void>;
  reload: () => Promise<void>;
}

const STORAGE_KEY = 'flowershop.cart.v1';

function loadLocal(): LocalItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(
      (i): i is LocalItem =>
        typeof i === 'object' &&
        i !== null &&
        typeof (i as LocalItem).variantId === 'number' &&
        typeof (i as LocalItem).quantity === 'number' &&
        (i as LocalItem).quantity > 0,
    );
  } catch {
    return [];
  }
}

function saveLocal(items: LocalItem[]) {
  try {
    if (items.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage bị chặn (chế độ riêng tư): giỏ chỉ sống trong phiên
  }
}

// Dùng chung giữa 2 lần chạy effect của React StrictMode để không gộp giỏ 2 lần
let syncInFlight: Promise<CartResponse> | null = null;

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const userId = user?.id ?? null;
  const [local, setLocal] = useState<LocalItem[]>(loadLocal);
  const [server, setServer] = useState<CartResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Đăng nhập: gộp giỏ local vào giỏ server rồi xóa local. Đăng xuất: quay về giỏ local.
  useEffect(() => {
    if (!ready) return;
    if (userId === null) {
      setServer(null);
      setLocal(loadLocal());
      return;
    }
    let cancelled = false;
    setLoading(true);
    if (!syncInFlight) {
      const pending = loadLocal();
      if (pending.length) {
        saveLocal([]);
        syncInFlight = cartApi
          .merge(pending.map((i) => ({ variantId: i.variantId, quantity: i.quantity })))
          .catch((err: unknown) => {
            saveLocal(pending);
            throw err;
          });
      } else {
        syncInFlight = cartApi.get();
      }
      syncInFlight
        .finally(() => {
          syncInFlight = null;
        })
        .catch(() => undefined);
    }
    syncInFlight
      .then((cart) => {
        if (!cancelled) {
          setServer(cart);
          setLocal([]);
        }
      })
      .catch(async () => {
        // Gộp lỗi (giỏ local đã được trả lại localStorage): vẫn hiển thị giỏ server hiện có
        try {
          const cart = await cartApi.get();
          if (!cancelled) setServer(cart);
        } catch {
          if (!cancelled) setServer({ items: [], subtotal: 0, totalQuantity: 0 });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, ready]);

  const isServerCart = userId !== null;

  const lines = useMemo<CartLine[]>(() => {
    if (isServerCart) {
      return (server?.items ?? []).map((i) => ({
        variantId: i.variantId,
        itemId: i.id,
        productId: i.productId,
        productName: i.productName,
        productSlug: i.productSlug,
        variantName: i.variantName,
        thumbnailUrl: i.thumbnailUrl,
        unitPrice: i.unitPrice,
        originalPrice: i.originalPrice,
        quantity: i.quantity,
        lineTotal: i.lineTotal,
        stock: i.stock,
        available: i.available,
      }));
    }
    return local.map((i) => ({ ...i, lineTotal: i.unitPrice * i.quantity, available: true }));
  }, [isServerCart, server, local]);

  const count = lines.reduce((sum, l) => sum + l.quantity, 0);
  const subtotal = lines.filter((l) => l.available).reduce((sum, l) => sum + l.lineTotal, 0);

  const findItemId = useCallback(
    (variantId: number) => {
      const line = server?.items.find((i) => i.variantId === variantId);
      if (!line) throw new ApiError(404, null, 'Sản phẩm không còn trong giỏ');
      return line.id;
    },
    [server],
  );

  const add = useCallback(
    async (snapshot: CartSnapshot, quantity: number) => {
      if (isServerCart) {
        setServer(await cartApi.add({ variantId: snapshot.variantId, quantity }));
        return;
      }
      const current = loadLocal();
      const existing = current.find((i) => i.variantId === snapshot.variantId);
      if (!existing && current.length >= MAX_CART_LINES) {
        throw new ApiError(400, null, `Giỏ hàng tối đa ${MAX_CART_LINES} sản phẩm`);
      }
      const next = existing
        ? current.map((i) =>
            i.variantId === snapshot.variantId
              ? { ...i, ...snapshot, quantity: Math.min(MAX_QUANTITY, i.quantity + quantity) }
              : i,
          )
        : [...current, { ...snapshot, quantity: Math.min(MAX_QUANTITY, quantity) }];
      saveLocal(next);
      setLocal(next);
    },
    [isServerCart],
  );

  const setQuantity = useCallback(
    async (variantId: number, quantity: number) => {
      const qty = Math.max(1, Math.min(MAX_QUANTITY, quantity));
      if (isServerCart) {
        setServer(await cartApi.update(findItemId(variantId), qty));
        return;
      }
      const next = loadLocal().map((i) => (i.variantId === variantId ? { ...i, quantity: qty } : i));
      saveLocal(next);
      setLocal(next);
    },
    [isServerCart, findItemId],
  );

  const remove = useCallback(
    async (variantId: number) => {
      if (isServerCart) {
        setServer(await cartApi.remove(findItemId(variantId)));
        return;
      }
      const next = loadLocal().filter((i) => i.variantId !== variantId);
      saveLocal(next);
      setLocal(next);
    },
    [isServerCart, findItemId],
  );

  const reload = useCallback(async () => {
    if (isServerCart) {
      setServer(await cartApi.get());
    } else {
      setLocal(loadLocal());
    }
  }, [isServerCart]);

  const clearOrdered = useCallback(async () => {
    if (isServerCart) {
      // Backend đã tự xóa các dòng vừa đặt khỏi giỏ server
      try {
        setServer(await cartApi.get());
      } catch {
        setServer({ items: [], subtotal: 0, totalQuantity: 0 });
      }
      return;
    }
    saveLocal([]);
    setLocal([]);
  }, [isServerCart]);

  const value = useMemo<CartContextValue>(
    () => ({ lines, count, subtotal, loading, isServerCart, add, setQuantity, remove, clearOrdered, reload }),
    [lines, count, subtotal, loading, isServerCart, add, setQuantity, remove, clearOrdered, reload],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart phải nằm trong CartProvider');
  return ctx;
}
