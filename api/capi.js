// Vercel Serverless Function: /api/capi
// Sends ONLY genuine PageView events to Meta Conversions API.
// Never put META_ACCESS_TOKEN in frontend/HTML code.

module.exports = async function handler(req, res) {
  // Only POST requests are allowed.
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed"
    });
  }

  // Read Vercel Environment Variables.
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;
  const graphVersion =
    process.env.META_GRAPH_VERSION || "v26.0";
  const testEventCode =
    process.env.META_TEST_EVENT_CODE || "";

  // Check required configuration.
  if (!pixelId || !accessToken) {
    console.error("Missing Meta environment variables");

    return res.status(500).json({
      ok: false,
      error:
        "META_PIXEL_ID or META_ACCESS_TOKEN is missing"
    });
  }

  // Read request body.
  const body = req.body || {};

  // This public endpoint supports PageView only.
  const eventName = body.event_name || "PageView";

  if (eventName !== "PageView") {
    return res.status(400).json({
      ok: false,
      error: "Only PageView is enabled"
    });
  }

  // Use the browser event ID when supplied.
  // This allows Meta browser/server deduplication.
  const eventId =
    typeof body.event_id === "string" && body.event_id
      ? body.event_id
      : "pv_" +
        Date.now() +
        "_" +
        Math.random().toString(36).slice(2);

  const eventTime = Math.floor(Date.now() / 1000);

  // URL of the page that generated the event.
  const eventSourceUrl =
    typeof body.event_source_url === "string"
      ? body.event_source_url.slice(0, 2000)
      : "";

  // Browser user agent.
  const userAgent =
    req.headers["user-agent"] || "";

  // Get the real client IP from Vercel's forwarded header.
  const forwardedFor =
    req.headers["x-forwarded-for"] || "";

  const clientIp =
    forwardedFor
      .split(",")[0]
      .trim() ||
    req.headers["x-real-ip"] ||
    "";

  // Meta user_data.
  const userData = {
    client_user_agent: userAgent
  };

  if (clientIp) {
    userData.client_ip_address = clientIp;
  }

  // Optional browser identifiers.
  // These are only sent if the browser actually provides them.
  if (
    typeof body.fbp === "string" &&
    body.fbp.length > 0
  ) {
    userData.fbp = body.fbp;
  }

  if (
    typeof body.fbc === "string" &&
    body.fbc.length > 0
  ) {
    userData.fbc = body.fbc;
  }

  // Meta Conversions API payload.
  const payload = {
    data: [
      {
        event_name: "PageView",
        event_time: eventTime,
        event_id: eventId,
        action_source: "website",
        event_source_url: eventSourceUrl,
        user_data: userData
      }
    ]
  };

  // Add Test Events code when configured.
  if (testEventCode) {
    payload.test_event_code = testEventCode;
  }

  try {
    const metaUrl =
      `https://graph.facebook.com/${graphVersion}/` +
      `${encodeURIComponent(pixelId)}/events`;

    const metaResponse = await fetch(metaUrl, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      },

      body: JSON.stringify(payload)
    });

    const responseText =
      await metaResponse.text();

    let metaResult;

    try {
      metaResult = JSON.parse(responseText);
    } catch (parseError) {
      metaResult = {
        raw: responseText
      };
    }

    // Meta rejected the event.
    if (!metaResponse.ok) {
      console.error(
        "Meta CAPI error:",
        metaResponse.status,
        JSON.stringify(metaResult)
      );

      return res.status(502).json({
        ok: false,
        upstream_status: metaResponse.status,
        meta: metaResult
      });
    }

    // Successful Meta response.
    console.log(
      "Meta CAPI success:",
      JSON.stringify(metaResult)
    );

    return res.status(200).json({
      ok: true,
      event_name: "PageView",
      event_id: eventId,
      meta: metaResult
    });

  } catch (error) {
    console.error(
      "CAPI request failed:",
      error && error.message
        ? error.message
        : error
    );

    return res.status(500).json({
      ok: false,
      error: "CAPI request failed"
    });
  }
};
