# Loop Web — 100% In-Browser On-Device AI Agent

**Loop** is a tiny, custom language-model AI agent (~50M parameters, Llama-style architecture) created from scratch by [ZEROLABS](https://zerolabs.live). Loop runs 100% locally on the user's device via ONNX WebGPU runtime and transformers.js in a dedicated Web Worker. No API keys, no cloud inference servers, and zero tracking or telemetry.

### Honest Limits
Loop is a tiny experimental model. It excels at brief chats, exact-arithmetic calculation with its calculator tool, device UTC clock queries, and factual questions verified against live Wikipedia text. When facts cannot be confirmed directly within retrieved passages, Loop abstains rather than halluncinating.

---

## Architecture Diagram

```
+-------------------------------------------------------------+
| Browser UI (React 19 / Next.js 15 App Shell & Zustand Store) |
+-------------------------------------------------------------+
                              |
                     Client Singleton (client.ts)
                              |  postMessage / Worker Events
                              v
+-------------------------------------------------------------+
|           Web Worker (workers/loop.worker.ts)               |
|                                                             |
|  1. Router (Hashed n-gram MLP + rule shortcuts)             |
|  2. Prefill generator                                       |
|  3. Thinker (transformers.js WebGPU / WASM execution)        |
|  4. Tools:                                                  |
|     - calc (exact BigInt + float arithmetic)                |
|     - search (direct CORS Wikipedia passages)               |
|     - time (device UTC clock)                               |
|  5. Verification & Safety Guards (agent.ts)                 |
+-------------------------------------------------------------+
```

---

## Step 1 — Export the Model from Training Notebook

After running training cells 1–10 in your Kaggle/Colab notebook (`loop_agent_v3_2.ipynb`), append and run **CELL 11** (`export_for_browser_cell.py`).

CELL 11 will:
1. Export the thinker weights to ONNX format with past KV-cache (`model.onnx`, `model_fp16.onnx`, `model_quantized.onnx`).
2. Export `router.bin` (little-endian float32 weights) and `router.json`.
3. Export `persona.json`, `loop_web_config.json`, and `parity.json`.
4. Upload all files to a **PUBLIC** Hugging Face repository (e.g. `ZEROLABS1/loop-v3-50M-onnx`).

> **CRITICAL**: The Hugging Face repository **MUST be Public** because browsers cannot authenticate private HF repositories without exposing secret tokens.

---

## Step 2 — Configuration

Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Set your exported Hugging Face repository ID:
```env
NEXT_PUBLIC_LOOP_MODEL_ID="ZEROLABS1/loop-v3-50M-onnx"
```

*Self-Hosting Option*: To host model files locally on your own domain without Hugging Face, place the exported files in `public/models/loop/` and set `NEXT_PUBLIC_LOOP_MODEL_ID="/models/loop"`.

---

## Step 3 — Running Locally

Install dependencies and start development server:
```bash
npm install
npm run dev
```

Open `http://localhost:3000` in Google Chrome or Microsoft Edge.
- **WebGPU Support**: Desktop Chrome/Edge 113+, Android Chrome 121+.
- **WASM Fallback**: Other browsers automatically fall back to single-threaded WebAssembly (`q8` quantized weights).

---

## Deployment

Deploy directly to Vercel, Cloud Run, or any static/Node host:
```bash
npm run build
npm run start
```
No environment variables other than `NEXT_PUBLIC_LOOP_MODEL_ID` are required.

---

## Extra App-Level Tools (Slash Commands)

Loop includes deterministic utility helpers in the composer (triggered with `/` or the Tools menu):
- `/convert 5 km to miles` or `/convert 100 f to c` — Offline unit conversion for length, mass, volume, speed, and temperature.
- `/define <topic>` — Direct encyclopedic Wikipedia summary lookup.
- `/weather <city>` — Live worldwide meteorological reports via Open-Meteo.
- `/roll 2d6` or `/random 1 100` — Cryptographically secure dice roller.
- `/calc <expression>` — Direct calculator interface.

---

## Manual Acceptance Checklist

1. **First Visit Onboarding**: Shows clean Onboarding card with model sizes (~110 MB for fp16). Clicking "Download Loop" shows real-time progress bar, speed, and ETA.
2. **Persistence**: Reloading the page loads Loop directly from browser cache without redownloading.
3. **Chat**: "hi" responds with greeting; Route Chip shows `chat · rule` in debug mode.
4. **Calculator**: "what is 37 times 12" displays Calculator card `37 * 12 = 444` and verified answer `37 * 12 = 444`.
5. **Percentages & Powers**: "what is 15 percent of 240" computes `36`.
6. **Clock**: "what time is it" displays Clock card with current UTC time and local timezone equivalent.
7. **Wikipedia Search**: "who is Marie Curie" performs live retrieval, displays snippet cards with clickable links, and verifies the answer against the retrieved passages.
8. **Offline Mode**: Disconnecting network keeps chat, calculator, and clock fully functional; search displays offline notification and Loop abstains honestly.
9. **Responsive Design**: Clean layout on 375 px mobile devices without horizontal overflow; composer sits above device safe-area inset.
10. **Storage Management**: Settings → Storage shows persistent quota, engine precision, and "Delete downloaded model" button.

---

## Troubleshooting

- **Model 404 / Failed to load**: Verify the Hugging Face repository exists, is set to **Public**, and contains `onnx/model.onnx`, `router.bin`, and `router.json`.
- **WebGPU Unavailable**: Ensure hardware acceleration is enabled in `chrome://settings/system` and WebGPU is supported on your GPU driver. Loop will automatically fall back to WASM `q8`.
- **Clearing Cache**: Click the Status Pill in the header or go to Settings → Storage & Parity → "Delete downloaded model".
