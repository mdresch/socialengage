"""Minimal container entrypoint for the agent image.

This keeps the container process alive and exposes a simple health endpoint.
"""

from http.server import BaseHTTPRequestHandler, HTTPServer
import os
import uuid


class HealthHandler(BaseHTTPRequestHandler):
    def _get_trace_id(self):
        incoming = self.headers.get("X-Trace-Id") or self.headers.get("traceparent")
        if incoming:
            if incoming.startswith("00-") and "-" in incoming:
                return incoming.split("-")[1]
            return incoming
        return str(uuid.uuid4())

    def _write_json(self, status_code, payload, trace_id):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("X-Trace-Id", trace_id)
        self.end_headers()
        self.wfile.write(payload.encode("utf-8"))

    def do_GET(self):
        trace_id = self._get_trace_id()
        print(f"request path={self.path} trace_id={trace_id}", flush=True)

        if self.path in ("/", "/health", "/healthz", "/ready"):
            self._write_json(200, '{"status":"ok"}', trace_id)
            return

        self._write_json(404, '{"error":"not_found"}', trace_id)

    # Silence default request logs to reduce noisy container output.
    def log_message(self, format, *args):
        return


def main():
    port = int(os.getenv("PORT", "8088"))
    server = HTTPServer(("0.0.0.0", port), HealthHandler)
    print(f"Listening on 0.0.0.0:{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()