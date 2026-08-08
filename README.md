# SocialEngage Agent Local Debugging

## Foundry Toolkit Agent Inspector

This workspace is configured to run the root Python entrypoint through `azd ai agent run` and attach VS Code's Python debugger via `debugpy`.

### Prerequisites

- `azd` installed and available on your user PATH
- `azure.ai.agents` extension installed for `azd`
- local virtual environment at `.venv`
- Python dependencies installed from `requirements.txt`

### Debug From VS Code

1. Open the workspace root in VS Code.
2. Press `F5`.
3. Select `Debug Local Agent HTTP Server (azd)`.

That launch profile runs the background task `Run Agent HTTP Server (azd)`, which:

- refreshes the terminal `PATH` so `azd` is available in the current shell
- sets `AZURE_DEV_USER_AGENT=microsoft_foundry_skill` for the local run
- starts the agent with `azd ai agent run --no-client --port 8088`
- overrides the startup command so the Python process starts under `debugpy`
- opens Foundry Toolkit Agent Inspector in VS Code after the local server is ready

### Equivalent Terminal Command

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
$env:AZURE_DEV_USER_AGENT = "microsoft_foundry_skill"
azd ai agent run --no-client --port 8088 --start-command ".venv\Scripts\python.exe -m debugpy --listen 127.0.0.1:5679 main.py --server"
```

### Local Invoke

Run local invoke commands from the workspace root where `azure.yaml` lives, or pass `-C` explicitly.

```powershell
azd ai agent invoke --local "Hello World"
azd -C D:\Source\socialengage ai agent invoke --local "Hello World"
```

### Tracing

`main.py` exports OpenTelemetry spans over OTLP HTTP to `http://localhost:4318/v1/traces` by default — the local Foundry Toolkit tracing endpoint. Override the destination with:

```powershell
$env:OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = "http://localhost:4318/v1/traces"
```

View traces from a local run with the VS Code command `ai-mlstudio.tracing.open` (Foundry Toolkit trace viewer).

### Notes

- The local azd project definition lives in `azure.yaml`.
- The agent entrypoint remains `main.py`.
- If the current VS Code terminal still cannot find `azd`, open a new terminal window and retry.