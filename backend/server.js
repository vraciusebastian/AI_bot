const express = require("express");
const cors    = require("cors");
const os      = require("os");
const { connectDb } = require("./db");

function getLocalIp() {
  const vpn = /^(tun|tap|ppp|wg|nordlynx|proton|utun|ipsec|vpn)/i;
  const lan = /^(eth|en|wlan|wi.fi|ethernet|local area|wireless)/i;
  const ifaces = os.networkInterfaces();
  let fallback = null;
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (vpn.test(name)) continue;
    for (const addr of addrs) {
      if (addr.family !== "IPv4" || addr.internal) continue;
      if (lan.test(name)) return addr.address;
      if (!fallback) fallback = addr.address;
    }
  }
  return fallback || "127.0.0.1";
}

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/documents", require("./routes/documents"));
app.use("/api/github", require("./routes/github"));
app.use("/api/prompts", require("./routes/prompts"));
app.use("/api/feedback", require("./routes/feedback"));
app.use("/api/watcher", require("./routes/watcher"));
app.use("/api/automation", require("./routes/automation"));

app.get("/", (_req, res) => res.json({ status: "ok" }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ detail: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 8000;
const HOST = getLocalIp();

connectDb()
  .then(() =>
    app.listen(PORT, HOST, () =>
      console.log(`Listening on http://${HOST}:${PORT}`),
    ),
  )
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
