import express, { Request, Response, NextFunction } from "express";
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
import uploadRoutes from "./routes/upload";
import profileRoutes from "./routes/profile"; 

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware'ler
app.use(cors());
app.use(express.json());

// 🚀 CANLI UYGULAMA İÇİN HAYAT KURTARAN YÖNLENDİRME (KÖPRÜ)
// Canlıdaki mobil uygulama yanlışlıkla /api/auth/profile adresine istek attığı için
// bu isteği sunucu içinde otomatik olarak doğru olan /api/profile rotasına çeviriyoruz.
app.use((req: Request, res: Response, next: NextFunction) => {
  // Eğer mobilden gelen istek tam olarak bu hatalı adres ise:
  if (req.url === '/api/auth/profile') {
    req.url = '/api/profile'; // Adresi doğru olanla değiştir ve yola devam et
  }
  next();
});

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
app.use("/api", uploadRoutes); 
app.use("/api", profileRoutes); 

// Sunucuyu Başlat
app.listen(port, () => {
  console.log(`Sunucu http://localhost:${port} adresinde ayaklandı.`);
});