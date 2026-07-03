import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";

// Rotaları (Routes) İçe Aktarıyoruz
import authRoutes from "./routes/auth";
import decksRoutes from "./routes/decks";
import questionsRoutes from "./routes/questions";
import socialRoutes from "./routes/social";
import attemptsRoutes from "./routes/attempts";
import badgesRoutes from "./routes/badges";
import exploreRoutes from "./routes/explore";
import uploadRoutes from "./routes/upload"; // Görsel Yükleme rotası eklendi

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware'ler
app.use(cors());
app.use(express.json());

// Ana Sayfa Testi
app.get("/", (req: Request, res: Response) => {
  res.send("Soru Bankam API Çalışıyor! 🚀");
});

// API Rotalarını Bağlıyoruz
app.use("/api/auth", authRoutes);
app.use("/api/decks", decksRoutes);
app.use("/api", questionsRoutes);
app.use("/api", socialRoutes);
app.use("/api", attemptsRoutes);
app.use("/api", badgesRoutes);
app.use("/api/explore", exploreRoutes);
app.use("/api", uploadRoutes); // Görsel rotası sisteme bağlandı

// Sunucuyu Başlat
app.listen(port, () => {
  console.log(`Sunucu http://localhost:${port} adresinde ayaklandı.`);
});