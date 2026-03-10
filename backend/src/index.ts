import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import scrapeRouter from "./routes/scrape.router";

import { scrapeOffers } from "./services/scraper.service";
import { initDiscordBot } from "./discord";
import schedule from "node-schedule";

const app = express();
const port = process.env.PORT || 3001;

// Validate required auth env vars at startup
if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
  console.error(
    "FATAL: ADMIN_USERNAME and ADMIN_PASSWORD environment variables must be set.",
  );
  process.exit(1);
}

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : ["http://localhost:3000"];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
);

app.use(express.json());

// Routes de l'API
app.use("/api/v1", scrapeRouter);

app.get("/", (req: Request, res: Response) => {
  res.send("Hello from Deal-Voyager API!");
});

// Planification du scraping automatique toutes les heures
schedule.scheduleJob("0 * * * *", () => {
  console.log(
    `Exécution du scraping planifié par Cron (${new Date().toLocaleTimeString("fr-FR")})...`,
  );
  scrapeOffers();
});

app.listen(Number(port), "0.0.0.0", async () => {
  console.log(`Server is running on http://0.0.0.0:${port}`);
  await initDiscordBot();
});
