// Vercel Serverless Function: /api/capi
// Sends ONLY genuine PageView events from this landing page to Meta CAPI.
// Keep META_ACCESS_TOKEN in Vercel Environment Variables; never put it in HTML.

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;
  const graphVersion = process.env.META_GRAPH_VERSION || "v26.0";
  const testEventCode = process.env.META_TEST_EVENT_CODE || "";

  if (!pixelId || !accessToken) {
    return res.status(500).json({
      ok: false,
      error: "META_PIXEL_ID or META_ACCESS_TOKEN is missing in Vercel Environment Variables"
    });
  }

  const body = req.body || {};
  const eventName = body.event_name || "PageView";

  // Do not expose a generic public conversion endpoint.
  // Registration/deposit events must be sent only after a genuine
  // completed action is confirmed by the authorized backend.
  if (eventName !== "PageView") {
    return res.status(400).json({
      ok: false,
      error: "Only PageView is enabled in this public endpoint"
    });
  }

  const eventId =
    body.event_id ||
    ("pv_" + Date.now() + "_" + Math.random().toString(36).slice(2));

  const eventTime = Math.floor(Date.now() / 1000);
  const eventSourceUrl =
    typeof body.event_source_url === "string"
      ? body.event_source_url.slice(0, 2000)
      : "";

  const userAgent = req.headers["user-agent"] || "";

  const payload = {
    data: [
      {
        event_name: "PageView",
        event_time: eventTime,
        event_id: eventId,
        action_source: "website",
        event_source_url: eventSourceUrl,
        user_data: {
          client_user_agent: userAgent
        }
      }
    ]
  };

  // Optional: when META_TEST_EVENT_CODE is set, Meta will route the
  // event into Test Events for verification.
  if (testEventCode) {
    payload.test_event_code = testEventCode;
  }

  try {
    const metaResponse = await fetch(
      `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(pixelId)}/events`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify(payload)
      }
    );

    const resultText = await metaResponse.text();

    let result;
    try {
      result = JSON.parse(resultText);
    } catch {
      result = { raw: resultText };
    }

    if (!metaResponse.ok) {
      console.error("Meta CAPI error:", metaResponse.status, result);
      return res.status(502).json({
        ok: false,
        upstream_status: metaResponse.status,
        meta: result
      });
    }

    return res.status(200).json({
      ok: true,
      event_name: "PageView",
      event_id: eventId,
      meta: result
    });
  } catch (error) {
    console.error("CAPI request failed:", error);
    return res.status(500).json({
      ok: false,
      error: "CAPI request failed"
    });
  }
};
