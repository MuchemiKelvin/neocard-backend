# NeoCampus module endpoints for Maya

Base URL while this backend is running locally: `http://127.0.0.1:4000`.

Send the existing admin API key in the `x-api-key` header. A device key works only for a school that device is linked to. A sponsor key is rejected. Every school call needs an active license.

The Ultra AI Core is the only AI entry point. Homework and App Builder call it. The other modules keep the APIs they already have.

## Ultra AI Core

`POST /v1/ai/complete`

```json
{
  "tenant_id": "SCHOOL-GREENFIELD",
  "user_id": "student-1",
  "role": "student",
  "module": "homework",
  "prompt": "The learner's question or work"
}
```

Success returns `data.tenant_id`, `data.user_id`, `data.role`, `data.module`, `data.use_case`, `data.source`, `data.result`, and `data.cost`. Live Gemini also returns `data.input_tokens` and `data.output_tokens`, and `source` is `gemini`. With `AI_MODE` left at `mock`, `source` is `mock` and `cost` is `0`. See [GEMINI_INTEGRATION.md](./GEMINI_INTEGRATION.md).

`GET /v1/ai/usage?tenant_id=SCHOOL-GREENFIELD` lists those calls for one school.

Failures use `success: false` plus a `code`: `UNAUTHORIZED`, `MISSING_FIELD`, `TENANT_NOT_FOUND`, a license denial, or `PROVIDER_UNAVAILABLE`.

## 1. Homework Review

`POST /v1/homework/review`

This calls the Core with module `homework`. There is no separate homework AI.

```json
{
  "tenant_id": "SCHOOL-GREENFIELD",
  "user_id": "student-1",
  "role": "student",
  "subject": "Mathematics",
  "lesson": "Addition",
  "submission": "2 + 2 = 4"
}
```

`submission` is required. `subject` and `lesson` are optional and are sent with the submission.

## 2. Sponsor / 7-Layer Proof Engine

`GET /v1/analytics/proof-layers`

`POST /v1/analytics/events`

```json
{
  "tenant_id": "SCHOOL-GREENFIELD",
  "user_id": "student-1",
  "module": "neoschool",
  "event_type": "lesson_completed",
  "timestamp": "2026-10-15T12:00:00.000Z"
}
```

`GET /v1/analytics/summary?tenant_id=SCHOOL-GREENFIELD&from=2026-10-15T00:00:00.000Z&to=2026-10-15T23:59:59.000Z`

Verified Participation and Repeat Engagement come from scans. The other five layers count when the event metadata includes their fields: `channel`, `shared_person_id`, `lesson_id`, `offline_source`, `outcome_type`, `verified_result`, `sponsor_id`, and `period`.

## 3. Repair and Rollback

Use the existing device unlock and backup restore.

`POST /v1/device-security/support/unlock` with an admin key:

```json
{
  "device_id": "device_greenfield_reader",
  "authorized_by": "support"
}
```

`POST /v1/backups` with `{ "tenant_id": "SCHOOL-GREENFIELD" }`, then `POST /v1/backups/:backupId/restore`.

Restore writes a checksum-checked copy under `database/restores`. It does not replace the live database. A rollback of lessons or other school records is not part of this delivery.

## 4. NeoStorage / Backup

`POST /v1/backups`

`GET /v1/backups?tenant_id=SCHOOL-GREENFIELD`

`GET /v1/backups/:backupId`

`POST /v1/backups/:backupId/restore`

`GET /v1/storage/quota/:studentId?tenant_id=SCHOOL-GREENFIELD`

`POST /v1/storage/usage` with `tenant_id`, `student_id`, and `bytes`.

`POST /v1/storage/files` with `tenant_id`, `student_id`, `filename`, and `content_base64`.

Each student quota is 20 GB. The quota view returns `warning_level` of `NORMAL`, `WARNING_80`, `WARNING_90`, or `FULL`. A write past the quota returns `QUOTA_FULL`.

## 5. App Builder / NeoSchool

`POST /v1/app-builder/lessons`

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

Creating a lesson calls the Core with module `app_builder`. In live mode `source` is `gemini` and `lesson.content` is Gemini's text. In mock mode `source` is `mock`.

`GET /v1/app-builder/lessons/:lessonId`

`POST /v1/app-builder/lessons/:lessonId/save`

`POST /v1/app-builder/lessons/:lessonId/publish`

Opening, saving, and publishing a lesson that already exists checks the school license and does not make another AI call.
