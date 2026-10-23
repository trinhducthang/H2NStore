package com.flowershop.order.entity;

/**
 * COD: thu tiền khi giao.
 * SEPAY: chuyển khoản VietQR, SePay bắn webhook khi tiền về và hệ thống tự đánh dấu đã thanh toán.
 * (sau này thêm VNPAY, MOMO)
 */
public enum PaymentMethod {
    COD, SEPAY
}
