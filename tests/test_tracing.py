import sys
import threading
import unittest
import urllib.request
from pathlib import Path
from http.server import HTTPServer

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import HealthHandler


class TracingTests(unittest.TestCase):
    def test_health_request_returns_trace_header(self):
        server = HTTPServer(("127.0.0.1", 0), HealthHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()

        try:
            port = server.server_address[1]
            request = urllib.request.Request(
                f"http://127.0.0.1:{port}/health",
                headers={"X-Trace-Id": "trace-123"},
            )

            with urllib.request.urlopen(request) as response:
                self.assertEqual(response.status, 200)
                self.assertEqual(response.headers["X-Trace-Id"], "trace-123")
                self.assertIn("status", response.read().decode())
        finally:
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    unittest.main()
