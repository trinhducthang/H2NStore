package com.flowershop.report.service;

import com.flowershop.common.exception.BusinessException;
import com.flowershop.common.exception.ErrorCode;
import com.flowershop.common.util.TimeUtils;
import com.flowershop.report.dto.ReportDtos.DailyRevenue;
import com.flowershop.report.dto.ReportDtos.OrderRow;
import com.flowershop.report.dto.ReportDtos.ReportSummary;
import com.flowershop.report.dto.ReportDtos.TopProduct;
import com.flowershop.report.repository.ReportRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReportService {

    private static final int MAX_RANGE_DAYS = 366;
    private static final int TOP_PRODUCTS = 10;
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final ReportRepository reportRepository;
    private final Clock clock;

    public record Range(LocalDate from, LocalDate to) {
        OffsetDateTime start() {
            return TimeUtils.startOfDay(from);
        }

        /** Mốc kết thúc không bao gồm: đầu ngày sau ngày "to". */
        OffsetDateTime endExclusive() {
            return TimeUtils.startOfDay(to.plusDays(1));
        }
    }

    /** Mặc định 30 ngày gần nhất. */
    public Range resolveRange(LocalDate from, LocalDate to) {
        LocalDate end = to != null ? to : TimeUtils.today(clock);
        LocalDate start = from != null ? from : end.minusDays(29);
        if (start.isAfter(end)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Ngày bắt đầu phải trước ngày kết thúc");
        }
        if (ChronoUnit.DAYS.between(start, end) >= MAX_RANGE_DAYS) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Khoảng thời gian tối đa " + MAX_RANGE_DAYS + " ngày");
        }
        return new Range(start, end);
    }

    @Transactional(readOnly = true)
    public ReportSummary summary(Range range) {
        var totals = reportRepository.totals(range.start(), range.endExclusive());
        long activeOrders = totals.orderCount() - totals.cancelledCount();
        long average = activeOrders > 0 ? totals.revenue() / activeOrders : 0;
        return new ReportSummary(range.from(), range.to(), totals.orderCount(), totals.deliveredCount(),
                totals.cancelledCount(), totals.revenue(), totals.paidRevenue(), average,
                reportRepository.countByStatus(range.start(), range.endExclusive()),
                fillMissingDays(range, reportRepository.revenueByDay(range.start(), range.endExclusive())),
                reportRepository.topProducts(range.start(), range.endExclusive(), TOP_PRODUCTS));
    }

    /** Ngày không có đơn vẫn có điểm 0 để biểu đồ liền mạch. */
    private static List<DailyRevenue> fillMissingDays(Range range, List<DailyRevenue> rows) {
        Map<LocalDate, DailyRevenue> byDate = rows.stream()
                .collect(Collectors.toMap(DailyRevenue::date, Function.identity()));
        List<DailyRevenue> result = new ArrayList<>();
        for (LocalDate d = range.from(); !d.isAfter(range.to()); d = d.plusDays(1)) {
            result.add(byDate.getOrDefault(d, new DailyRevenue(d, 0, 0)));
        }
        return result;
    }

    @Transactional(readOnly = true)
    public byte[] exportExcel(Range range) {
        ReportSummary summary = summary(range);
        List<OrderRow> orders = reportRepository.orders(range.start(), range.endExclusive());
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            CellStyle header = wb.createCellStyle();
            Font bold = wb.createFont();
            bold.setBold(true);
            header.setFont(bold);
            CellStyle money = wb.createCellStyle();
            money.setDataFormat(wb.createDataFormat().getFormat("#,##0"));

            Sheet overview = wb.createSheet("Tổng quan");
            int r = 0;
            r = kv(overview, r, "Từ ngày", range.from().format(DATE), header);
            r = kv(overview, r, "Đến ngày", range.to().format(DATE), header);
            r = kvMoney(overview, r, "Tổng số đơn", summary.orderCount(), header, null);
            r = kvMoney(overview, r, "Đơn đã giao", summary.deliveredCount(), header, null);
            r = kvMoney(overview, r, "Đơn đã hủy", summary.cancelledCount(), header, null);
            r = kvMoney(overview, r, "Doanh thu (đơn chưa hủy)", summary.revenue(), header, money);
            r = kvMoney(overview, r, "Đã thu", summary.paidRevenue(), header, money);
            kvMoney(overview, r, "Giá trị đơn trung bình", summary.averageOrderValue(), header, money);
            // Đặt độ rộng cố định: autoSizeColumn cần font hệ thống, dễ lỗi trên server headless
            overview.setColumnWidth(0, 32 * 256);
            overview.setColumnWidth(1, 18 * 256);

            Sheet days = wb.createSheet("Theo ngày");
            headerRow(days, header, "Ngày", "Số đơn", "Doanh thu");
            int i = 1;
            for (DailyRevenue d : summary.byDay()) {
                Row row = days.createRow(i++);
                row.createCell(0).setCellValue(d.date().format(DATE));
                row.createCell(1).setCellValue(d.orders());
                moneyCell(row, 2, d.revenue(), money);
            }

            Sheet top = wb.createSheet("Top sản phẩm");
            headerRow(top, header, "Sản phẩm", "Số lượng", "Doanh thu");
            i = 1;
            for (TopProduct p : summary.topProducts()) {
                Row row = top.createRow(i++);
                row.createCell(0).setCellValue(p.productName());
                row.createCell(1).setCellValue(p.quantity());
                moneyCell(row, 2, p.revenue(), money);
            }
            top.setColumnWidth(0, 40 * 256);

            Sheet list = wb.createSheet("Đơn hàng");
            headerRow(list, header, "Mã đơn", "Ngày đặt", "Trạng thái", "Thanh toán", "TT thanh toán",
                    "Người đặt", "SĐT người đặt", "Người nhận", "Ngày giao", "Khung giờ", "Tạm tính", "Phí ship",
                    "Giảm giá", "Tổng");
            i = 1;
            for (OrderRow o : orders) {
                Row row = list.createRow(i++);
                int c = 0;
                row.createCell(c++).setCellValue(o.code());
                row.createCell(c++).setCellValue(o.createdAt().atZoneSameInstant(TimeUtils.ZONE).format(DATE_TIME));
                row.createCell(c++).setCellValue(o.status());
                row.createCell(c++).setCellValue(o.paymentMethod());
                row.createCell(c++).setCellValue(o.paymentStatus());
                row.createCell(c++).setCellValue(o.senderName());
                row.createCell(c++).setCellValue(o.senderPhone());
                row.createCell(c++).setCellValue(o.receiverName());
                row.createCell(c++).setCellValue(o.deliveryDate().format(DATE));
                row.createCell(c++).setCellValue(o.deliverySlot());
                moneyCell(row, c++, o.subtotal(), money);
                moneyCell(row, c++, o.shippingFee(), money);
                moneyCell(row, c++, o.discount(), money);
                moneyCell(row, c, o.total(), money);
            }
            for (int col = 0; col < 14; col++) {
                list.setColumnWidth(col, (col == 5 || col == 7 ? 24 : 14) * 256);
            }

            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR);
        }
    }

    private static int kv(Sheet sheet, int r, String key, String value, CellStyle header) {
        Row row = sheet.createRow(r);
        Cell k = row.createCell(0);
        k.setCellValue(key);
        k.setCellStyle(header);
        row.createCell(1).setCellValue(value);
        return r + 1;
    }

    private static int kvMoney(Sheet sheet, int r, String key, long value, CellStyle header, CellStyle money) {
        Row row = sheet.createRow(r);
        Cell k = row.createCell(0);
        k.setCellValue(key);
        k.setCellStyle(header);
        moneyCell(row, 1, value, money);
        return r + 1;
    }

    private static void moneyCell(Row row, int col, long value, CellStyle style) {
        Cell cell = row.createCell(col);
        cell.setCellValue(value);
        if (style != null) {
            cell.setCellStyle(style);
        }
    }

    private static void headerRow(Sheet sheet, CellStyle style, String... titles) {
        Row row = sheet.createRow(0);
        for (int i = 0; i < titles.length; i++) {
            Cell cell = row.createCell(i);
            cell.setCellValue(titles[i]);
            cell.setCellStyle(style);
        }
    }
}
