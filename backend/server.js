const express = require("express");
const cors = require("cors");
const { connectDb } = require("./db");

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

connectDb()
  .then(() =>
    app.listen(PORT, "0.0.0.0", () =>
      console.log(`Listening on http://0.0.0.0:${PORT}`),
    ),
  )
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
