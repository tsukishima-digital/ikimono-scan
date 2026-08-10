const MODEL_PREFIX = "/models/";
const MODEL_MANIFEST = "/models/manifest.json";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith(MODEL_PREFIX)) {
      return env.ASSETS.fetch(request);
    }

    if (url.pathname === MODEL_MANIFEST) {
      const response = await env.ASSETS.fetch(request);
      if (response.headers.get("content-type")?.includes("text/html")) {
        return new Response("Not found", { status: 404 });
      }
      return response;
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
    headers.set("cache-control", "public, max-age=31536000, immutable");

    return new Response(object.body, { headers });
  },
};
