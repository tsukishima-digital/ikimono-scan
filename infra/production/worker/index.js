const MODEL_PREFIX = "/models/";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith(MODEL_PREFIX)) {
      return env.ASSETS.fetch(request);
    }

    const key = url.pathname.slice(MODEL_PREFIX.length);
    if (!key || key.includes("..")) {
      return new Response("Not found", { status: 404 });
    }

    const object = await env.MODELS.get(key);
    if (object === null) {
      return new Response("Not found", { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set(
      "cache-control",
      key === "manifest.json" ? "public, max-age=300" : "public, max-age=31536000, immutable",
    );

    return new Response(object.body, { headers });
  },
};
