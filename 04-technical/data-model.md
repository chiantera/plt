# Data Model Draft

## Case

Fields:

- `id`
- `title`
- `jurisdiction`
- `practice_area` default: criminal defense
- `client_name` optional
- `status`
- `created_at`
- `updated_at`
- `owner_user_id`
- `firm_id` optional

## SourceDocument

Fields:

- `id`
- `case_id`
- `filename`
- `mime_type`
- `file_hash`
- `storage_uri`
- `page_count`
- `language`
- `document_type`
- `processing_status`
- `created_at`

## AudioSource

Fields:

- `id`
- `case_id`
- `filename`
- `file_hash`
- `duration_seconds`
- `storage_uri`
- `processing_status`
- `created_at`

## TextChunk

Fields:

- `id`
- `case_id`
- `source_id`
- `source_type` document/audio/note
- `text`
- `page_start`
- `page_end`
- `timestamp_start`
- `timestamp_end`
- `embedding_id`

## Entity

Fields:

- `id`
- `case_id`
- `type` person/org/location/legal_concept/charge/court/etc.
- `name`
- `aliases`
- `source_refs`
- `confidence`
- `user_verified`

## CaseEvent

Fields:

- `id`
- `case_id`
- `date`
- `date_precision`
- `title`
- `description`
- `event_type`
- `source_refs`
- `confidence`
- `user_verified`

## EvidenceItem

Fields:

- `id`
- `case_id`
- `title`
- `description`
- `evidence_type`
- `source_refs`
- `related_entities`
- `related_events`
- `tags`

## OpenQuestion

Fields:

- `id`
- `case_id`
- `question`
- `reason`
- `priority`
- `source_refs`
- `status`

## Deadline

Fields:

- `id`
- `case_id`
- `date`
- `title`
- `description`
- `source_refs`
- `reminder_settings`
- `status`

## GeneratedBrief

Fields:

- `id`
- `case_id`
- `brief_type` consultation/hearing/appeal/discovery/etc.
- `content_markdown`
- `source_refs`
- `model_used`
- `created_at`
- `created_by`

## UsageEvent

Fields:

- `id`
- `user_id`
- `firm_id`
- `case_id`
- `event_type` ocr_page/stt_minute/flash_tokens/pro_tokens/export/storage/etc.
- `quantity`
- `cost_estimate`
- `created_at`

## SourceRef shape

```json
{
  "source_type": "document",
  "source_id": "doc_123",
  "page": 7,
  "chunk_id": "chunk_456",
  "quote": "short supporting quote",
  "confidence": 0.82
}
```

For audio:

```json
{
  "source_type": "audio",
  "source_id": "aud_123",
  "timestamp_start": 125.4,
  "timestamp_end": 151.2,
  "chunk_id": "chunk_999",
  "quote": "short transcript quote",
  "confidence": 0.78
}
```
