import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent } from 'react';
import { adminApi } from '../../api/admin';
import { ApiError, errorMessage } from '../../api/client';
import type { Banner, BannerDisplayStatus, BannerRequest } from '../../api/types';
import { Badge } from '../../components/Badge';
import { EmptyState, ErrorBox, FieldError, Loading } from '../../components/Feedback';
import { Modal } from '../../components/Modal';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { formatDateTime, fromDateTimeLocalVN, toDateTimeLocalVN, type Tone } from '../../utils/format';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** Khớp backend: đường dẫn nội bộ "/..." hoặc URL http(s) */
const LINK_REGEX = /^(\/(?!\/)\S*|https?:\/\/\S+)$/;

const STATUS_LABEL: Record<BannerDisplayStatus, string> = {
  SHOWING: 'Đang hiển thị',
  SCHEDULED: 'Chờ đến giờ',
  EXPIRED: 'Đã hết hạn',
  INACTIVE: 'Đã tắt',
  NO_IMAGE: 'Chưa có ảnh',
};

const STATUS_TONE: Record<BannerDisplayStatus, Tone> = {
  SHOWING: 'success',
  SCHEDULED: 'info',
  EXPIRED: 'neutral',
  INACTIVE: 'neutral',
  NO_IMAGE: 'warning',
};

/** Phần ảnh hiển thị khi khung cắt bớt ảnh (object-position %) */
interface ImagePosition {
  x: number;
  y: number;
}

const CENTER: ImagePosition = { x: 50, y: 50 };
/** Phím mũi tên đẩy ảnh như khi kéo: mũi tên xuống = ảnh đi xuống = thấy phần trên của ảnh */
const NUDGE: Record<string, [number, number]> = {
  ArrowLeft: [5, 0],
  ArrowRight: [-5, 0],
  ArrowUp: [0, 5],
  ArrowDown: [0, -5],
};

const clampPercent = (v: number) => Math.min(100, Math.max(0, Math.round(v)));

/**
 * Ảnh banner kéo được để chọn phần hiển thị khi khung cắt bớt ảnh (object-fit: cover + object-position).
 * Dùng cho cả khung máy tính (3:1) và điện thoại (2:1), hai khung chung một vị trí.
 */
function BannerPositioner({
  src,
  position,
  onChange,
  className,
  label,
}: {
  src: string;
  position: ImagePosition;
  onChange: (p: ImagePosition) => void;
  className: string;
  label: string;
}) {
  const drag = useRef<{ startX: number; startY: number; from: ImagePosition; spanX: number; spanY: number } | null>(
    null,
  );
  const [dragging, setDragging] = useState(false);

  const startDrag = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget;
    const img = box.querySelector('img');
    if (!e.isPrimary || !img?.naturalWidth) return;
    // Phần ảnh thừa ra ngoài khung (px) theo từng chiều; bằng 0 thì chiều đó không có gì để kéo
    const scale = Math.max(box.clientWidth / img.naturalWidth, box.clientHeight / img.naturalHeight);
    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      from: position,
      spanX: img.naturalWidth * scale - box.clientWidth,
      spanY: img.naturalHeight * scale - box.clientHeight,
    };
    box.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const moveDrag = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    onChange({
      x: d.spanX >= 1 ? clampPercent(d.from.x - ((e.clientX - d.startX) / d.spanX) * 100) : d.from.x,
      y: d.spanY >= 1 ? clampPercent(d.from.y - ((e.clientY - d.startY) / d.spanY) * 100) : d.from.y,
    });
  };

  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  const nudge = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = NUDGE[e.key];
    if (!step) return;
    e.preventDefault();
    onChange({ x: clampPercent(position.x + step[0]), y: clampPercent(position.y + step[1]) });
  };

  return (
    <div
      className={`${className} banner-positioner ${dragging ? 'is-dragging' : ''}`}
      role="group"
      tabIndex={0}
      aria-label={`${label}: ngang ${position.x}%, dọc ${position.y}%. Kéo ảnh hoặc dùng phím mũi tên để chỉnh`}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={nudge}
    >
      <img src={src} alt="" draggable={false} style={{ objectPosition: `${position.x}% ${position.y}%` }} />
    </div>
  );
}

function toRequest(b: Banner, patch: Partial<BannerRequest> = {}): BannerRequest {
  return {
    title: b.title ?? null,
    subtitle: b.subtitle ?? null,
    buttonText: b.buttonText ?? null,
    linkUrl: b.linkUrl ?? null,
    imagePositionX: b.imagePositionX,
    imagePositionY: b.imagePositionY,
    sortOrder: b.sortOrder,
    active: b.active,
    startsAt: b.startsAt ?? null,
    endsAt: b.endsAt ?? null,
    ...patch,
  };
}

function BannerForm({
  initial,
  nextSortOrder,
  onClose,
  onSaved,
}: {
  initial: Banner | null;
  nextSortOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    title: initial?.title ?? '',
    subtitle: initial?.subtitle ?? '',
    buttonText: initial?.buttonText ?? '',
    linkUrl: initial?.linkUrl ?? '',
    sortOrder: String(initial?.sortOrder ?? nextSortOrder),
    active: initial?.active ?? true,
    startsAt: toDateTimeLocalVN(initial?.startsAt),
    endsAt: toDateTimeLocalVN(initial?.endsAt),
  });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(initial?.imageUrl ?? null);
  const [position, setPosition] = useState<ImagePosition>(
    initial ? { x: initial.imagePositionX, y: initial.imagePositionY } : CENTER,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Thu hồi object URL của ảnh xem trước khi đổi ảnh / đóng form
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const pickFile = (picked: File | undefined) => {
    if (!picked) return;
    if (!ACCEPTED_TYPES.includes(picked.type) || picked.size > MAX_IMAGE_BYTES) {
      setErrors((e) => ({ ...e, image: 'Chỉ nhận ảnh jpg/png/webp, tối đa 5MB' }));
      return;
    }
    setErrors((prev) => {
      const next = { ...prev };
      delete next.image;
      return next;
    });
    setFile(picked);
    setPosition(CENTER);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!initial && !file) errs.image = 'Vui lòng chọn ảnh banner';
    const link = form.linkUrl.trim();
    if (link && !LINK_REGEX.test(link)) errs.linkUrl = 'Liên kết phải bắt đầu bằng / (trang trong shop) hoặc http(s)://';
    if (form.buttonText.trim() && !link) errs.linkUrl = 'Có chữ trên nút thì cần liên kết khi bấm';
    const sortOrder = Number(form.sortOrder);
    if (!Number.isInteger(sortOrder) || sortOrder < 0) errs.sortOrder = 'Thứ tự là số nguyên từ 0';
    if (form.startsAt && form.endsAt && form.endsAt <= form.startsAt) errs.endsAt = 'Kết thúc phải sau thời gian bắt đầu';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const body: BannerRequest = {
      title: form.title.trim() || null,
      subtitle: form.subtitle.trim() || null,
      buttonText: form.buttonText.trim() || null,
      linkUrl: link || null,
      imagePositionX: position.x,
      imagePositionY: position.y,
      sortOrder,
      active: form.active,
      startsAt: fromDateTimeLocalVN(form.startsAt),
      endsAt: fromDateTimeLocalVN(form.endsAt),
    };
    setBusy(true);
    try {
      const saved = initial ? await adminApi.updateBanner(initial.id, body) : await adminApi.createBanner(body);
      if (file) await adminApi.uploadBannerImage(saved.id, file);
      toast.success('Đã lưu banner');
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors());
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={initial ? 'Sửa banner' : 'Thêm banner'} onClose={onClose} wide>
      <form className="form" onSubmit={submit} noValidate>
        <div className="field">
          <span className="field-label">Ảnh banner</span>
          {preview ? (
            <>
              <BannerPositioner
                src={preview}
                position={position}
                onChange={setPosition}
                className="banner-preview"
                label="Vị trí ảnh trên máy tính"
              />
              <div className="banner-position-bar">
                <BannerPositioner
                  src={preview}
                  position={position}
                  onChange={setPosition}
                  className="banner-preview-mobile"
                  label="Vị trí ảnh trên điện thoại"
                />
                <div className="banner-position-help">
                  <p className="muted small">
                    Kéo ảnh để chọn phần hiển thị (hoặc bấm vào ảnh rồi dùng phím mũi tên). Khung nhỏ là banner trên
                    điện thoại (tỉ lệ 2:1), hai bên ảnh bị cắt nhiều hơn.
                  </p>
                  {(position.x !== CENTER.x || position.y !== CENTER.y) && (
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => setPosition(CENTER)}>
                      Căn giữa
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="banner-preview">
              <span className="muted small">Chưa có ảnh</span>
            </div>
          )}
          <input type="file" accept={ACCEPTED_TYPES.join(',')} onChange={(e) => pickFile(e.target.files?.[0])} />
          <p className="muted small">Khuyến nghị 1920×640 px (tỉ lệ 3:1), jpg/png/webp tối đa 5MB.</p>
          <FieldError message={errors.image} />
        </div>

        <div className="form-grid">
          <label className="field">
            <span className="field-label">Tiêu đề (để trống nếu chữ đã có trên ảnh)</span>
            <input value={form.title} maxLength={150} onChange={(e) => set('title', e.target.value)} />
            <FieldError message={errors.title} />
          </label>
          <label className="field">
            <span className="field-label">Dòng phụ</span>
            <input value={form.subtitle} maxLength={300} onChange={(e) => set('subtitle', e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Chữ trên nút (VD: Mua ngay)</span>
            <input value={form.buttonText} maxLength={50} onChange={(e) => set('buttonText', e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Liên kết khi bấm</span>
            <input
              value={form.linkUrl}
              maxLength={500}
              placeholder="/products?categorySlug=hoa-sinh-nhat"
              onChange={(e) => set('linkUrl', e.target.value)}
            />
            <FieldError message={errors.linkUrl} />
          </label>
          <label className="field">
            <span className="field-label">Bắt đầu hiển thị (để trống = ngay)</span>
            <input type="datetime-local" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Kết thúc (để trống = không giới hạn)</span>
            <input type="datetime-local" value={form.endsAt} onChange={(e) => set('endsAt', e.target.value)} />
            <FieldError message={errors.endsAt} />
          </label>
          <label className="field">
            <span className="field-label">Thứ tự (nhỏ hiện trước)</span>
            <input type="number" min={0} step={1} value={form.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} />
            <FieldError message={errors.sortOrder} />
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
          <span>Hiển thị trên trang chủ</span>
        </label>
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function AdminBannersPage() {
  const toast = useToast();
  const banners = useAsync(() => adminApi.banners(), []);
  const [editing, setEditing] = useState<Banner | 'new' | null>(null);
  const list = banners.data ?? [];
  const nextSortOrder = list.length ? Math.max(...list.map((b) => b.sortOrder)) + 1 : 0;

  const toggleActive = async (b: Banner) => {
    try {
      await adminApi.updateBanner(b.id, toRequest(b, { active: !b.active }));
      toast.success(b.active ? 'Đã ẩn banner' : 'Đã bật banner');
      banners.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const remove = async (b: Banner) => {
    if (!window.confirm(`Xóa banner “${b.title || `#${b.id}`}”? Ảnh banner cũng bị xóa.`)) return;
    try {
      await adminApi.deleteBanner(b.id);
      toast.success('Đã xóa banner');
      banners.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <div className="admin-head">
        <h1>Banner trang chủ</h1>
        <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
          + Thêm banner
        </button>
      </div>
      <p className="muted">
        Banner đang hiển thị chạy thành slider ở đầu trang chủ theo thứ tự; chưa có banner nào thì trang chủ dùng phần
        giới thiệu mặc định.
      </p>
      {banners.loading && !banners.data && <Loading />}
      {banners.error && <ErrorBox message={banners.error} onRetry={banners.reload} />}
      {banners.data && list.length === 0 && <EmptyState icon="🖼️" title="Chưa có banner nào" />}
      {list.length > 0 && (
        <div className="table-wrap card">
          <table className="table">
            <thead>
              <tr>
                <th>Ảnh</th>
                <th>Nội dung</th>
                <th className="num">Thứ tự</th>
                <th>Lịch hiển thị</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((b) => (
                <tr key={b.id} className={b.displayStatus === 'SHOWING' ? '' : 'row-muted'}>
                  <td>
                    <div className="banner-thumb">{b.imageUrl ? (
                        <img
                          src={b.imageUrl}
                          alt=""
                          loading="lazy"
                          style={{ objectPosition: `${b.imagePositionX}% ${b.imagePositionY}%` }}
                        />
                      ) : (
                        '—'
                      )}</div>
                  </td>
                  <td>
                    <strong>{b.title || <span className="muted">(không có tiêu đề)</span>}</strong>
                    {b.subtitle && <div className="muted small">{b.subtitle}</div>}
                    {b.linkUrl && <div className="small">→ {b.linkUrl}</div>}
                  </td>
                  <td className="num">{b.sortOrder}</td>
                  <td className="small">
                    {b.startsAt || b.endsAt ? (
                      <>
                        {b.startsAt && <div>Từ {formatDateTime(b.startsAt)}</div>}
                        {b.endsAt && <div>Đến {formatDateTime(b.endsAt)}</div>}
                      </>
                    ) : (
                      <span className="muted">Luôn hiển thị</span>
                    )}
                  </td>
                  <td>
                    <Badge tone={STATUS_TONE[b.displayStatus]}>{STATUS_LABEL[b.displayStatus]}</Badge>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="btn btn-sm btn-outline" onClick={() => setEditing(b)}>
                        Sửa
                      </button>
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => toggleActive(b)}>
                        {b.active ? 'Ẩn' : 'Hiện'}
                      </button>
                      <button type="button" className="btn btn-sm btn-danger-outline" onClick={() => remove(b)}>
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <BannerForm
          initial={editing === 'new' ? null : editing}
          nextSortOrder={nextSortOrder}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            banners.reload();
          }}
        />
      )}
    </>
  );
}
