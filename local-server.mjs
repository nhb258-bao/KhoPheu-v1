import { startServer } from "./app.mjs";

try {
  startServer();
} catch (error) {
  console.error("Không thể khởi động máy chủ:", error);
  process.exitCode = 1;
}
