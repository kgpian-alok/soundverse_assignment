require("dotenv").config();
const express = require("express");
const { Sequelize, DataTypes } = require("sequelize");
const client = require("prom-client");

// DB Init
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  logging: false,
});

// Model
const Clip = sequelize.define("Clip", {
  title: DataTypes.STRING,
  description: DataTypes.STRING,
  genre: DataTypes.STRING,
  duration: DataTypes.STRING,
  audioUrl: DataTypes.STRING,
  playCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  lastPlayedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: Sequelize.NOW,
  },
});

// Metrics
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics();
const requestCounter = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

// App
const app = express();
app.use(express.json());

// Prometheus middleware
app.use((req, res, next) => {
  res.on("finish", () => {
    requestCounter.labels(req.method, req.path, res.statusCode).inc();
  });
  next();
});

// Routes
app.get("/", (req, res) => {
  res.send("Welcome to the Soundverse!");
});

app.get("/clips", async (_, res) => {
  const clips = await Clip.findAll();
  res.json(clips);
});

app.get("/clips/:id/stream", async (req, res) => {
  const clip = await Clip.findByPk(req.params.id);
  if (!clip) return res.status(404).send("Clip not found");
  clip.playCount += 1;
  clip.lastPlayedAt = Sequelize.literal("current_timestamp");
  await clip.save();
  res.redirect(clip.audioUrl);
});

app.get("/clips/:id/stats", async (req, res) => {
  const clip = await Clip.findByPk(req.params.id);
  if (!clip) return res.status(404).send("Clip not found");
  res.json(clip);
});

app.post("/clips", async (req, res) => {
  const newClip = await Clip.create(req.body);
  res.status(201).json(newClip);
});

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});

// Seed if needed
const seedData = async () => {
  await sequelize.sync({ force: true });
  await Clip.bulkCreate([
    {
      title: "Chill Vibes",
      description: "Relaxing ambient sound",
      genre: "ambient",
      duration: "30s",
      audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    },
    {
      title: "Pop Spark",
      description: "Upbeat pop tune",
      genre: "pop",
      duration: "30s",
      audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    },
    {
      title: "Jazz Flow",
      description: "Smooth jazz instrumental",
      genre: "jazz",
      duration: "30s",
      audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    },
    {
      title: "Hip Hop Heat",
      description: "Energetic hip hop beat",
      genre: "hiphop",
      duration: "30s",
      audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    },
    {
      title: "Lo-Fi Dream",
      description: "Chill lo-fi background loop",
      genre: "lofi",
      duration: "30s",
      audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
    },
    {
      title: "EDM Bounce",
      description: "Electronic dance music track",
      genre: "edm",
      duration: "30s",
      audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
    },
  ]);
  console.log("Seeded DB with 6 test clips.");
  process.exit();
};

// Start
if (process.argv[2] === "seed") {
  seedData();
} else {
  sequelize.sync().then(() => {
    app.listen(process.env.PORT, () => {
      console.log(`🚀 Server running on http://localhost:${process.env.PORT}`);
    });
  });
}
