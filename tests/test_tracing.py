import json
import sys
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from http.server import HTTPServer
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main
from main import HealthHandler


class FakeSpanContext:
    def __init__(self, trace_id):
        self.trace_id = trace_id
        self.is_valid = True


class FakeSpan:
    def __init__(self, trace_id):
        self.attributes = {}
        self._span_context = FakeSpanContext(trace_id)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        return False

    def set_attribute(self, key, value):
        self.attributes[key] = value

    def get_span_context(self):
        return self._span_context


class FakeTracer:
    def __init__(self):
        self.started_spans = []
        self.current_span = FakeSpan(int("1234", 16))

    def start_as_current_span(self, name, context=None, kind=None, attributes=None):
        self.started_spans.append(
            {
                "name": name,
                "context": context,
                "kind": kind,
                "attributes": attributes or {},
            }
        )
        return self.current_span


class TracingTests(unittest.TestCase):
    def test_configure_tracing_without_opentelemetry_uses_fallback(self):
        with patch("main.trace", None), patch("main.OTLPSpanExporter", None):
            main.configure_tracing()
            self.assertTrue(hasattr(main.TRACER, "start_as_current_span"))

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

    def test_readiness_request_returns_ready_status(self):
        server = HTTPServer(("127.0.0.1", 0), HealthHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()

        try:
            port = server.server_address[1]
            request = urllib.request.Request(f"http://127.0.0.1:{port}/ready")

            with urllib.request.urlopen(request) as response:
                self.assertEqual(response.status, 200)
                self.assertIn("ready", response.read().decode())
        finally:
            server.shutdown()
            server.server_close()

    def test_readiness_request_with_query_string_is_supported(self):
        server = HTTPServer(("127.0.0.1", 0), HealthHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()

        try:
            port = server.server_address[1]
            request = urllib.request.Request(f"http://127.0.0.1:{port}/ready?probe=1")

            with urllib.request.urlopen(request) as response:
                self.assertEqual(response.status, 200)
                self.assertIn("ready", response.read().decode())
        finally:
            server.shutdown()
            server.server_close()

    def test_responses_request_creates_server_span(self):
        fake_tracer = FakeTracer()
        server = HTTPServer(("127.0.0.1", 0), HealthHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)

        with patch("main.TRACER", fake_tracer), patch(
            "main.trace.get_current_span", return_value=fake_tracer.current_span
        ):
            thread.start()

            try:
                port = server.server_address[1]
                request = urllib.request.Request(
                    f"http://127.0.0.1:{port}/responses",
                    data=b'{"input":"Hello World"}',
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )

                with urllib.request.urlopen(request) as response:
                    self.assertEqual(response.status, 200)
                    self.assertEqual(
                        response.headers["X-Trace-Id"],
                        "00000000000000000000000000001234",
                    )
                    self.assertIn(
                        "SocialEngage local agent received: Hello World",
                        response.read().decode(),
                    )

                self.assertEqual(fake_tracer.started_spans[0]["name"], "POST /responses")
                self.assertEqual(
                    fake_tracer.started_spans[0]["attributes"]["http.method"],
                    "POST",
                )
                self.assertEqual(fake_tracer.current_span.attributes["http.status_code"], 200)
            finally:
                server.shutdown()
                server.server_close()

    def test_responses_request_extracts_text_from_messages_payload(self):
        server = HTTPServer(("127.0.0.1", 0), HealthHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()

        try:
            port = server.server_address[1]
            request = urllib.request.Request(
                f"http://127.0.0.1:{port}/responses",
                data=json.dumps({"messages": [{"role": "user", "content": "Hello World"}]}).encode(
                    "utf-8"
                ),
                headers={"Content-Type": "application/json"},
                method="POST",
            )

            with urllib.request.urlopen(request) as response:
                self.assertEqual(response.status, 200)
                self.assertIn(
                    "SocialEngage local agent received: Hello World",
                    response.read().decode(),
                )
        finally:
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    unittest.main()
