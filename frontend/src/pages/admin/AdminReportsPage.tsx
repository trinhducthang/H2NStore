import { useState, type FormEvent } from 'react';
import { adminApi } from '../../api/admin';
import { downloadBlob, errorMessage } from '../../api/client';
import type { OrderStatus } from '../../api/types';
import { OrderStatusBadge } from '../../components/Badge';
import { ErrorBox, Loading } from '../../components/Feedback';
import { RevenueChart } from '../../components/RevenueChart';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { addDays, firstDayOfMonthVN, formatDate, formatVnd, ORDER_STATUS_LABEL, todayVN } from '../../utils/format';

interface Range {
  from: string;
  to: string;
}

function presets(): { key: string; label: string; range: Range }[] {
  const today = todayVN();
  const firstThisMonth = firstDayOfMonthVN();
  const lastPrevMonth = addDays(firstThisMonth, -1);
  return [
    { key: '7d', label: '7 ngày', range: { from: addDays(today, -6), to: today } },
    { key: '30d', label: '30 ngày', range: { from: addDays(today, -29), to: today } },
    { key: 'month', label: 'Tháng này', range: { from: firstThisMonth, to: today } },
    { key: 'prev', label: 'Tháng trước', range: { from: `${lastPrevMonth.slice(0, 8)}01`, to: lastPrevMonth } },
  ];
}

function StatTile({ label, value, hint, hero = false }: { label: string; value: string; hint?: string; hero?: boolean }) {
  return (
    <div className={`stat-tile ${hero ? 'hero' : ''}`}>
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      {hint && <p className="muted small">{hint}</p>}
    </div>
  );
}

export function AdminReportsPage() {
  const toast = useToast();
  const options = presets();
  const [range, setRange] = useState<Range>(options[1].range);
  const [custom, setCustom] = useState<Range>(options[1].range);
  const [showTable, setShowTable] = useState(false);
  const [exporting, setExporting] = useState(false);
  const report = useAsync(() => adminApi.reportSummary(range.from, range.to), [range.from, range.to]);

  const applyCustom = (e: FormEvent) => {
    e.preventDefault();
    if (!custom.from || !custom.to || custom.from > custom.to) {
      toast.error('Khoảng ngày không hợp lệ');
      return;
    }
    setRange(custom);
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const { blob, filename } = await adminApi.exportReport(range.from, range.to);
      downloadBlob(blob, filename ?? `bao-cao_${range.from}_${range.to}.xlsx`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const data = report.data;
  const statusEntries = data
    ? (Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]).map((s) => [s, data.byStatus[s] ?? 0] as const)
    : [];

  return (
    <>
      <div className="admin-head">
        <h1>Báo cáo</h1>
        <button type="button" className="btn btn-outline" disabled={exporting} onClick={exportExcel}>
          {exporting ? 'Đang xuất...' : '⬇ Xuất Excel'}
        </button>
      </div>

      {/* Bộ lọc thời gian: một hàng phía trên, áp dụng cho mọi số liệu bên dưới */}
      <div className="filter-bar">
        <div className="chip-row">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              className={`chip ${range.from === o.range.from && range.to === o.range.to ? 'chip-active' : ''}`}
              onClick={() => {
                setRange(o.range);
                setCustom(o.range);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
        <form className="date-range" onSubmit={applyCustom}>
          <input
            type="date"
            value={custom.from}
            max={custom.to}
            aria-label="Từ ngày"
            onChange={(e) => setCustom({ ...custom, from: e.target.value })}
          />
          <span>→</span>
          <input
            type="date"
            value={custom.to}
            min={custom.from}
            aria-label="Đến ngày"
            onChange={(e) => setCustom({ ...custom, to: e.target.value })}
          />
          <button type="submit" className="btn btn-primary btn-sm">
            Xem
          </button>
        </form>
      </div>

      {report.loading && !data && <Loading />}
      {report.error && <ErrorBox message={report.error} onRetry={report.reload} />}

      {data && (
        <div className={`report ${report.loading ? 'is-refreshing' : ''}`}>
          <p className="muted small">
            Từ {formatDate(data.from)} đến {formatDate(data.to)} · theo ngày đặt hàng
          </p>
          <div className="stat-grid">
            <StatTile hero label="Doanh thu" value={formatVnd(data.revenue)} hint="Tổng tiền các đơn chưa hủy" />
            <StatTile label="Đã thu" value={formatVnd(data.paidRevenue)} hint="Đơn đã thanh toán" />
            <StatTile label="Số đơn" value={data.orderCount.toLocaleString('vi-VN')} />
            <StatTile label="Đã giao" value={data.deliveredCount.toLocaleString('vi-VN')} />
            <StatTile label="Đã hủy" value={data.cancelledCount.toLocaleString('vi-VN')} />
            <StatTile label="Giá trị trung bình/đơn" value={formatVnd(data.averageOrderValue)} />
          </div>

          <section className="card">
            <div className="card-title-row">
              <h2 className="card-title">Doanh thu theo ngày</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowTable((v) => !v)}>
                {showTable ? 'Xem biểu đồ' : 'Xem dạng bảng'}
              </button>
            </div>
            {data.byDay.length === 0 ? (
              <p className="muted">Không có dữ liệu trong khoảng này.</p>
            ) : showTable ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Ngày</th>
                      <th className="num">Số đơn</th>
                      <th className="num">Doanh thu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byDay.map((d) => (
                      <tr key={d.date}>
                        <td>{formatDate(d.date)}</td>
                        <td className="num">{d.orders}</td>
                        <td className="num">{formatVnd(d.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <RevenueChart data={data.byDay} />
            )}
          </section>

          <div className="two-col">
            <section className="card">
              <h2 className="card-title">Sản phẩm bán chạy</h2>
              {data.topProducts.length === 0 ? (
                <p className="muted">Chưa có sản phẩm nào được bán.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Sản phẩm</th>
                        <th className="num">SL</th>
                        <th className="num">Doanh thu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topProducts.map((p, i) => (
                        <tr key={p.productId}>
                          <td>{i + 1}</td>
                          <td>{p.productName}</td>
                          <td className="num">{p.quantity}</td>
                          <td className="num">{formatVnd(p.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="card">
              <h2 className="card-title">Đơn theo trạng thái</h2>
              <ul className="status-list">
                {statusEntries.map(([status, count]) => (
                  <li key={status}>
                    <OrderStatusBadge status={status} />
                    <strong>{count.toLocaleString('vi-VN')}</strong>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}
    </>
  );
}
