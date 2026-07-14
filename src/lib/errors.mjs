export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(message, details) {
  return new AppError(400, "BAD_REQUEST", message, details);
}

export function unauthorized(message = "Bạn cần đăng nhập quản trị.") {
  return new AppError(401, "UNAUTHORIZED", message);
}

export function notFound(message = "Không tìm thấy tài nguyên.") {
  return new AppError(404, "NOT_FOUND", message);
}

export function methodNotAllowed(message = "Phương thức không được hỗ trợ.") {
  return new AppError(405, "METHOD_NOT_ALLOWED", message);
}
