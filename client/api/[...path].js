const DEFAULT_BASE = "https://finance-app-api-gcnf.onrender.com";

module.exports = async function handler(req, res) {
  const base = process.env.API_PROXY_BASE || DEFAULT_BASE;
  const target = `${base.replace(/\/$/, "")}${req.url}`;

  const headers = { ...req.headers };
  delete headers.host;
  delete headers.connection;
  delete headers["content-length"];

  const method = req.method || "GET";
  const hasBody = !["GET", "HEAD"].includes(method);
  let body = undefined;
  if (hasBody) {
    body = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", reject);
    });
  }

  try {
    const response = await fetch(target, { method, headers, body });
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "transfer-encoding") return;
      res.setHeader(key, value);
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    res.end(buffer);
  } catch (err) {
    res.statusCode = 502;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Proxy error" }));
  }
};
