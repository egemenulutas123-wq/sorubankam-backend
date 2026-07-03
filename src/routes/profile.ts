import express from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middleware/auth"; // <-- İSİM DÜZELTİLDİ

const router = express.Router();
const prisma = new PrismaClient();

// 1. Kendi profil bilgilerini getir
router.get("/profile", authMiddleware, async (req: any, res) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { id: req.userId },
      // İstersen buraya istatistikleri de include edebilirsin (deck sayısı vb.)
    });
    
    if (!profile) {
      return res.status(404).json({ error: "Profil bulunamadı" });
    }
    
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: "Profil getirilirken bir hata oluştu" });
  }
});

// 2. Profil bilgilerini güncelle
router.put("/profile", authMiddleware, async (req: any, res) => {
  try {
    const { fullName, bio, grade, city, subjects } = req.body;
    
    const updatedProfile = await prisma.profile.update({
      where: { id: req.userId },
      data: { fullName, bio, grade, city, subjects },
    });
    
    res.json(updatedProfile);
  } catch (error) {
    res.status(500).json({ error: "Profil güncellenirken bir hata oluştu" });
  }
});

// 3. Başka bir kullanıcının public profilini getir
router.get("/profile/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        fullName: true,
        bio: true,
        avatarUrl: true,
        xpCurrent: true,
        // Gizli kalması gereken şifre, email gibi alanları burada seçmiyoruz
      }
    });

    if (!profile) {
      return res.status(404).json({ error: "Kullanıcı bulunamadı" });
    }

    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: "Kullanıcı getirilirken bir hata oluştu" });
  }
});

// Not: Avatar yükleme (Cloudinary/Multer) kısmı karmaşık olduğu ve sunucuyu 
// patlatmaması için şimdilik temel profil işlemlerini ekledim.

export default router;