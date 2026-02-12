export default async function handler(req, res) {
  const base =
    process.env.API_PROXY_BASE || "https://finance-app-api-gcnf.onrender.com";
  const target = `${base.replace(/\/$/, "")}${req.url}`;

  const headers = { ...req.headers };
  delete headers.host;
  delete headers.connection;
  delete headers["content-length"];

  const method = req.method || "GET";
  const hasBody = !["GET", "HEAD"].includes(method);
  let body;
  if (hasBody) {
    if (typeof req.body === "string") body = req.body;
    else if (req.body !== undefined) body = JSON.stringify(req.body);
  }

  try {
    const response = await fetch(target, {
      method,
      headers,
      body,
    });
    const text = await response.text();
    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "transfer-encoding") return;
      res.setHeader(key, value);
    });
    res.send(text);
  } catch (err) {
    res.status(502).json({ error: "Proxy error" });
  }
}
