# KhoPheu-v1
Kho SR Đà Nẵng

## Lưu dữ liệu khi triển khai trên Vercel

Vercel Functions không cho ghi bền vững vào các file trong thư mục `data`. Để lưu số đếm và cấu hình Quản trị:

1. Mở project trên Vercel, chọn **Storage** rồi **Create Database**.
2. Chọn **Upstash** → **Redis** và chọn gói **Free**.
3. Kết nối database với project đang chạy ứng dụng.
4. Kiểm tra Vercel đã tạo `UPSTASH_REDIS_REST_URL` và `UPSTASH_REDIS_REST_TOKEN` cho Production.
5. Redeploy project. Dữ liệu JSON hiện có sẽ được dùng để khởi tạo Redis trong lần đọc đầu tiên.

Khi chạy local mà không có hai biến Redis, ứng dụng vẫn đọc và ghi `data/config.json` cùng `data/counts.json` như trước.
