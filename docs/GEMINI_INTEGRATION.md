# Gemini integration

The Ultra AI Core calls Google Gemini. There is no second AI backend. Current and later NeoCampus modules keep using `POST /v1/ai/complete`.

Base URL while this backend is running locally: `http://127.0.0.1:4000`.

## Mode

`AI_MODE` in `.env` chooses the path.

- `mock` is the default. The Core returns a draft sentence, `source` is `mock`, and `cost` is `0`. No call leaves the server.
- `live` calls Gemini Flash. A successful response has `source` `gemini`.

The server reads `.env` when it starts. Save the file, then restart the API.

## Key

Set the key only in `.env`:

```
AI_MODE=live
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.8-flash
```

`.env` is gitignored. The key is sent only as the `x-goog-api-key` header to Google. It is not written into the lesson, the usage row, the API response, or this repository. `AI_PROVIDER_API_KEY` is accepted if `GEMINI_API_KEY` is empty. A missing key in live mode returns HTTP 502 `PROVIDER_UNAVAILABLE` and stores a usage row with `provider_status` `FAILED`.

`gemini-2.5-flash` is closed to new API keys. This integration uses `gemini-3.8-flash`.

## Request

`POST /v1/ai/complete`

Send the existing admin API key in the `x-api-key` header. A device key works only for a school that device is linked to. A sponsor key is rejected. The school license must be active.

```json
{
  "tenant_id": "SCHOOL-GREENFIELD",
  "user_id": "teacher-1",
  "role": "teacher",
  "module": "app_builder",
  "prompt": "Mathematics grade 2 Addition"
}
```

`tenant_id`, `user_id`, `role`, and `module` are required. The Core maps `app_builder`, `lesson`, and `neoschool` to use case `lesson`. `homework` stays `homework`. `sponsor` stays `sponsor`. `neocard` becomes `card`.

A live success looks like this:

```json
{
  "success": true,
  "data": {
    "id": "aiu_1792113728659_a6bfcc81",
    "tenant_id": "SCHOOL-GREENFIELD",
    "user_id": "teacher-1",
    "role": "teacher",
    "module": "app_builder",
    "use_case": "lesson",
    "source": "gemini",
    "result": "Gemini's answer",
    "cost": 0.007162,
    "input_tokens": 5,
    "output_tokens": 2075
  }
}
```

`cost` is euros. `output_tokens` is the answer tokens plus any thinking tokens Google reports.

## Usage row

`GET /v1/ai/usage?tenant_id=SCHOOL-GREENFIELD`

Each row stores `id`, `tenant_id`, `user_id`, `role`, `module`, `use_case`, `provider_status`, `input_tokens`, `output_tokens`, `cost`, `error`, and `created_at`. This list does not include the answer text. The answer is on the `POST /v1/ai/complete` response and, for App Builder, on the lesson.

The estimate uses Google's published Gemini 3.8 Flash rates through 31 December 2026: $0.75 per million input tokens and $3.75 per million output tokens, converted at 0.92 dollars to the euro. Override them with `GEMINI_INPUT_USD_PER_MILLION`, `GEMINI_OUTPUT_USD_PER_MILLION`, and `USD_TO_EUR`. This is an estimate from the token counts, not a copy of Google's invoice.

## App Builder

`POST /v1/app-builder/lessons` calls the Core with module `app_builder`. The prompt is the subject, grade, and topic. The lesson stores Gemini's text in `lesson.content` and sets `source` to `gemini` when live mode is on.

```json
{
  "tenant_id": "SCHOOL-GREENFIELD",
  "user_id": "teacher-1",
  "role": "teacher",
  "grade": "2",
  "subject": "Mathematics",
  "topic": "Addition"
}
```

`GET /v1/app-builder/lessons/:lessonId`, save, and publish check the school license and do not call Gemini again.

The local page at `http://127.0.0.1:4000/app-builder` uses the same Core. Its draft route does not put the Gemini key in the browser.

## Measured lesson

One live lesson was created on 16 October 2026.

| Field | Value |
| --- | --- |
| Lesson | `les_1792113746147_38a9c7d8` |
| Usage row | `aiu_1792113728659_a6bfcc81` |
| School | `SCHOOL-GREENFIELD` |
| User | `teacher-1`, role `teacher` |
| Module | `app_builder`, use case `lesson` |
| Model | `gemini-3.8-flash` |
| Status | `SUCCESS` |
| Input tokens | 5 |
| Output tokens | 2,075 |
| Estimated cost | €0.007162 |

The prompt was short and the model wrote a long guide, so the output token count is high. At 300 actions of this size the month is about €2.15 per student. That is above the €2 planning target of about €0.0067 per action, and inside the €3 ceiling of €0.01 per action. A shorter answer costs less.

This call used a developer key. It did not spend the separate €20 provider credit.

## Left out of this connection

This connection does not stop a student after 300 actions, and it does not enforce the €2 or €3 monthly ceiling. It does not connect the other dashboards, and it does not add a second provider.
