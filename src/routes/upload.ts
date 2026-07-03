import { Router, Request, Response } from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// Cloudinary Konfigürasyonu (.env dosyasından şifreleri çekiyoruz)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer Ayarı: Dosyayı bilgisayarın diskine kaydetmeden doğrudan belleğe (RAM) alıyoruz
const storage = multer.memoryStorage();
const upload = multer({ storage });

// --- YENİ EKLENEN GENEL YÜKLEME ENDPOINT'İ ---
router.post("/", upload.single("file"), async (req: Request, res: Response): Promise<any> => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Lütfen bir dosya yükleyin." });
    }

    const cloudinaryUpload = new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "uploads" },
        (error, result) => {
          if (result) resolve(result);
          else reject(error);
        }
      );
      stream.end(req.file!.buffer);
    });

    const result: any = await cloudinaryUpload;

    return res.status(200).json({ 
      message: "Dosya başarıyla yüklendi.",
      url: result.secure_url 
    });
  } catch (error: any) {
    console.error("🔥 Genel Yükleme Hatası:", error);
    return res.status(500).json({ 
        error: "Sunucu tarafında bir hata oluştu.",
        detay: error.message || String(error)
    });
  }
});

// 1. Profil Fotoğrafı (Avatar) Yükleme Rotası
router.post("/upload/avatar", authMiddleware, upload.single("image"), async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).userId;
    
    if (!req.file) {
      return res.status(400).json({ error: "Lütfen bir fotoğraf seçin." });
    }

    // Cloudinary'ye Stream (Akış) yöntemiyle fotoğrafı yolluyoruz
    const cloudinaryUpload = new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "sorubankam/avatars" }, // Cloudinary'de açılacak klasör adı
        (error, result) => {
          if (result) resolve(result);
          else reject(error);
        }
      );
      stream.end(req.file!.buffer);
    });

    const result: any = await cloudinaryUpload;

    // Veritabanında kullanıcının avatarUrl kısmını güncelliyoruz
    const updatedProfile = await prisma.profile.update({
      where: { id: userId },
      data: { avatarUrl: result.secure_url },
      select: { id: true, username: true, avatarUrl: true } // Şifreyi falan döndürmemek için
    });

    res.json({ message: "Profil fotoğrafı başarıyla güncellendi!", profile: updatedProfile });
  } catch (error) {
    res.status(500).json({ error: "Fotoğraf yüklenirken bir hata oluştu." });
  }
});

// 2. Deste Kapak Fotoğrafı Yükleme Rotası
router.post("/upload/deck/:deckId", authMiddleware, upload.single("image"), async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).userId;
    const deckId = req.params.deckId;

    if (!req.file) return res.status(400).json({ error: "Lütfen bir fotoğraf seçin." });

    // Önce bu destenin sahibi gerçekten bu kişi mi diye güvenlik kontrolü yapıyoruz
    const deck = await prisma.deck.findUnique({ where: { id: deckId } });
    if (!deck) return res.status(404).json({ error: "Deste bulunamadı." });
    if (deck.authorId !== userId) return res.status(403).json({ error: "Bu desteye fotoğraf yükleme yetkiniz yok." });

    // Cloudinary'ye yolluyoruz
    const cloudinaryUpload = new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "sorubankam/decks" },
        (error, result) => {
          if (result) resolve(result);
          else reject(error);
        }
      );
      stream.end(req.file!.buffer);
    });

    const result: any = await cloudinaryUpload;

    // Veritabanını güncelliyoruz
    const updatedDeck = await prisma.deck.update({
      where: { id: deckId },
      data: { coverUrl: result.secure_url }
    });

    res.json({ message: "Deste kapak fotoğrafı eklendi!", deck: updatedDeck });
  } catch (error) {
    res.status(500).json({ error: "Fotoğraf yüklenirken bir hata oluştu." });
  }
});

export default router;