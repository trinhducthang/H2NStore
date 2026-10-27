import { useEffect, useId, useMemo, useState } from 'react';
import { foldVietnamese } from '../utils/vnAddress';

const MAX_SUGGESTIONS = 50;

/**
 * Ô nhập có danh sách gợi ý (VD phường/xã): gõ không dấu vẫn tìm được, chọn bằng chuột hoặc phím lên/xuống + Enter.
 * Vẫn cho nhập tự do nếu giá trị không có trong danh sách.
 */
export function SuggestInput({
  value,
  options,
  onChange,
  placeholder,
  maxLength,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const folded = useMemo(() => options.map((o) => [o, foldVietnamese(o)] as const), [options]);
  const matches = useMemo(() => {
    const q = foldVietnamese(value.trim());
    const found = q ? folded.filter(([, f]) => f.includes(q)).map(([o]) => o) : options;
    return found.slice(0, MAX_SUGGESTIONS);
  }, [folded, options, value]);
  // Đã chọn đúng một mục thì không cần xổ danh sách nữa
  const showList = open && matches.length > 0 && !(matches.length === 1 && matches[0] === value);

  useEffect(() => {
    if (showList) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, showList, listId]);

  const pick = (option: string) => {
    onChange(option);
    setOpen(false);
  };

  return (
    <div className="suggest">
      <input
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!showList) {
              setOpen(true);
              return;
            }
            const step = e.key === 'ArrowDown' ? 1 : -1;
            setActive((i) => (i + step + matches.length) % matches.length);
          } else if (e.key === 'Enter' && showList) {
            // Enter chọn gợi ý thay vì gửi form
            e.preventDefault();
            pick(matches[Math.min(active, matches.length - 1)]);
          } else if (e.key === 'Escape' && showList) {
            // Chỉ đóng danh sách, không đóng hộp thoại
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
            setOpen(false);
          }
        }}
      />
      {showList && (
        <ul id={listId} role="listbox" className="suggest-list">
          {matches.map((option, i) => (
            <li
              key={option}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              // mousedown + preventDefault: chọn trước khi ô nhập mất focus và đóng danh sách
              onMouseDown={(e) => {
                e.preventDefault();
                pick(option);
              }}
              onMouseEnter={() => setActive(i)}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
