# VeerGame Vercel + Meta CAPI deployment

## Files
- `index.html` — landing page with Meta Pixel + browser/server PageView deduplication.
- `api/capi.js` — Vercel serverless function that sends genuine PageView events to Meta CAPI.

## Vercel Environment Variables
Already used by the project:
- `META_PIXEL_ID` = `1772893023836805`
- `META_ACCESS_TOKEN` = your Meta CAPI access token (keep secret)

Optional:
- `META_GRAPH_VERSION` = `v26.0`
- `META_TEST_EVENT_CODE` = temporary Test Events code from Meta

## Deploy
Upload/replace these files in the same Vercel project:
- `index.html`
- `api/capi.js`

Then redeploy.

## Verify
1. Open the Vercel website.
2. Meta Events Manager -> your dataset -> Test Events.
3. With `META_TEST_EVENT_CODE` temporarily set, open the website and look for PageView.
4. The browser Pixel and server event use the same event_id, allowing Meta to deduplicate them.

## Important
This endpoint intentionally accepts only PageView.
It must NOT be used to fabricate Registration/Purchase/Deposit conversions.
A Registration or Purchase event should be sent only when the authorized service/backend confirms the real completed action.
