"""Minimal HTTP entrypoint that can be launched directly or via agentdev."""

import argparse
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import logging
import os
import time
import uuid
from urllib.parse import urlsplit

try:
    from opentelemetry import trace as otel_trace
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.propagate import extract
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.trace import SpanKind
except ImportError:
    otel_trace = None
    OTLPSpanExporter = None
    extract = lambda _headers: None
    Resource = None
    TracerProvider = None
    BatchSpanProcessor = None

    class SpanKind:
        SERVER = "SERVER"


class _NoOpSpan:
    def __init__(self):
        self.attributes = {}

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        return False

    def set_attribute(self, key, value):
        self.attributes[key] = value

    def get_span_context(self):
        return type("SpanContext", (), {"is_valid": False, "trace_id": 0})()


class _NoOpTracer:
    def start_as_current_span(self, name, context=None, kind=None, attributes=None):
        return _NoOpSpan()


class _FallbackTraceModule:
    def get_tracer(self, _name):
        return _NoOpTracer()

    def get_current_span(self):
        return _NoOpSpan()

    def set_tracer_provider(self, _provider):
        return None


trace = otel_trace if otel_trace is not None else _FallbackTraceModule()

SERVICE_NAME = "socialengage-local-agent"
TRACER = trace.get_tracer(SERVICE_NAME)


def configure_tracing():
    # The OTLP exporter logs a "Transient error ... retrying" warning (and an
    # eventual "Failed to export span batch" error) for every batch when no
    # collector is listening on the configured endpoint. That's expected for
    # local runs started without the Agent Inspector/trace collector, so quiet
    # it down to avoid flooding the console. Real export failures are still
    # visible at DEBUG if needed.
    if OTLPSpanExporter is not None:
        logging.getLogger("opentelemetry.exporter.otlp.proto.http.trace_exporter").setLevel(
            logging.CRITICAL
        )

    global TRACER

    trace_module = trace if trace is not None else _FallbackTraceModule()

    if OTLPSpanExporter is None or Resource is None or TracerProvider is None or BatchSpanProcessor is None:
        TRACER = trace_module.get_tracer(SERVICE_NAME)
        return

    resource = Resource.create({"service.name": SERVICE_NAME})
    provider = TracerProvider(resource=resource)
    exporter = OTLPSpanExporter(
        endpoint=os.getenv(
            "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT",
            "http://localhost:4318/v1/traces",
        )
    )
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace_module.set_tracer_provider(provider)
    TRACER = trace_module.get_tracer(SERVICE_NAME)


class HealthHandler(BaseHTTPRequestHandler):
    def _start_request_span(self):
        parent_context = extract(dict(self.headers))
        return TRACER.start_as_current_span(
            f"{self.command} {self.path}",
            context=parent_context,
            kind=SpanKind.SERVER,
            attributes={
                "http.method": self.command,
                "http.target": self.path,
            },
        )

    def _get_trace_id(self):
        incoming = self.headers.get("X-Trace-Id")
        if incoming:
            return incoming

        span_context = trace.get_current_span().get_span_context()
        if span_context.is_valid:
            return format(span_context.trace_id, "032x")

        traceparent = self.headers.get("traceparent")
        if traceparent and traceparent.startswith("00-") and "-" in traceparent:
            return traceparent.split("-")[1]

        return str(uuid.uuid4())

    def _write_json(self, status_code, payload, trace_id):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("X-Trace-Id", trace_id)
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode("utf-8"))

    def _get_request_path(self):
        return urlsplit(self.path).path

    def _read_json_body(self):
        content_length = int(self.headers.get("Content-Length", "0"))
        if content_length == 0:
            return {}

        raw_body = self.rfile.read(content_length)
        if not raw_body:
            return {}

        return json.loads(raw_body.decode("utf-8"))

    def _extract_input_text(self, payload):
        if isinstance(payload.get("input"), str):
            return payload["input"]

        if isinstance(payload.get("message"), str):
            return payload["message"]

        if isinstance(payload.get("messages"), list):
            extracted_parts = []
            for message in payload["messages"]:
                if isinstance(message, str):
                    extracted_parts.append(message)
                    continue

                if not isinstance(message, dict):
                    continue

                content = message.get("content")
                if isinstance(content, str):
                    extracted_parts.append(content)
                    continue

                if isinstance(content, list):
                    for content_item in content:
                        if isinstance(content_item, dict):
                            if content_item.get("type") == "input_text":
                                extracted_parts.append(content_item.get("text", ""))
                            elif content_item.get("type") == "text":
                                extracted_parts.append(content_item.get("text", ""))

            if extracted_parts:
                return " ".join(part for part in extracted_parts if part).strip()

        input_items = payload.get("input", [])
        if not isinstance(input_items, list):
            return ""

        extracted_parts = []
        for item in input_items:
            if isinstance(item, dict) and isinstance(item.get("content"), list):
                for content_item in item["content"]:
                    if isinstance(content_item, dict) and content_item.get("type") == "input_text":
                        extracted_parts.append(content_item.get("text", ""))

        return " ".join(part for part in extracted_parts if part).strip()

    def _build_response_payload(self, prompt_text):
        response_text = "SocialEngage local agent received: " + (prompt_text or "")
        return {
            "id": f"resp_{uuid.uuid4().hex}",
            "object": "response",
            "created_at": int(time.time()),
            "status": "completed",
            "error": None,
            "incomplete_details": None,
            "model": "socialengage-local",
            "output": [
                {
                    "id": f"msg_{uuid.uuid4().hex}",
                    "type": "message",
                    "status": "completed",
                    "role": "assistant",
                    "content": [
                        {
                            "type": "output_text",
                            "text": response_text,
                            "annotations": [],
                        }
                    ],
                }
            ],
            "parallel_tool_calls": False,
            "tool_choice": "auto",
            "tools": [],
            "metadata": {},
        }

    def do_GET(self):
        with self._start_request_span() as span:
            trace_id = self._get_trace_id()
            request_path = self._get_request_path()
            print(f"request path={request_path} trace_id={trace_id}", flush=True)

            if request_path in ("/", "/health", "/healthz"):
                span.set_attribute("http.status_code", 200)
                self._write_json(200, {"status": "ok"}, trace_id)
                return

            if request_path in ("/ready", "/readiness"):
                span.set_attribute("http.status_code", 200)
                self._write_json(200, {"status": "ready"}, trace_id)
                return

            span.set_attribute("http.status_code", 404)
            self._write_json(404, {"error": "not_found"}, trace_id)

    def do_POST(self):
        with self._start_request_span() as span:
            trace_id = self._get_trace_id()
            request_path = self._get_request_path()
            print(f"request path={request_path} trace_id={trace_id}", flush=True)

            if request_path == "/responses":
                try:
                    payload = self._read_json_body()
                except json.JSONDecodeError:
                    span.set_attribute("http.status_code", 400)
                    self._write_json(400, {"error": "invalid_json"}, trace_id)
                    return

                prompt_text = self._extract_input_text(payload)
                span.set_attribute("http.status_code", 200)
                self._write_json(200, self._build_response_payload(prompt_text), trace_id)
                return

            span.set_attribute("http.status_code", 404)
            self._write_json(404, {"error": "not_found"}, trace_id)

    # Silence default request logs to reduce noisy container output.
    def log_message(self, format, *args):
        return


def parse_args():
    parser = argparse.ArgumentParser(
        description="Run the SocialEngage agent entrypoint as an HTTP server."
    )
    parser.add_argument(
        "--server",
        action="store_true",
        help="Run the HTTP server entrypoint. This flag is accepted for agentdev compatibility.",
    )
    parser.add_argument(
        "--host",
        default=os.getenv("HOST", "0.0.0.0"),
        help="Host interface to bind.",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.getenv("PORT", "8088")),
        help="Port to listen on.",
    )
    return parser.parse_args()


def main():
    configure_tracing()
    args = parse_args()
    server = HTTPServer((args.host, args.port), HealthHandler)
    print(f"Running on http://{args.host}:{args.port}", flush=True)
    print("Application startup complete", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()