import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// GET /social/feed - Takip edilen kullanıcıların son public destelerini getirir
router.get("/social/feed", authMiddleware, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).userId;

    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });

    const followingIds = following.map(f => f.followingId);

    const feedDecks = await prisma.deck.findMany({
      where: {
        author: { id: { in: followingIds } },
        isPublic: true,
      },
      include: {
        author: {
          select: { id: true, username: true, fullName: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(feedDecks);
  } catch (error) {
    res.status(500).json({ error: "Akış getirilirken bir hata oluştu." });
  }
});

// GET /social/users/recommended - En çok takipçisi veya destesi olan 5 kullanıcıyı önerir
router.get("/social/users/recommended", authMiddleware, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).userId;

    // "prisma.user" yerine projenizdeki ana kullanıcı modeli olan "prisma.profile" kullanıldı.
    const recommendedUsers = await prisma.profile.findMany({
      where: {
        id: { not: userId },
      },
      take: 5,
      orderBy: [
        {
          followers: {
            _count: "desc",
          },
        },
        {
          decks: {
            _count: "desc",
          },
        },
      ],
      select: {
        id: true,
        username: true,
        fullName: true,
      },
    });

    res.json(recommendedUsers);
  } catch (error) {
    res.status(500).json({ error: "Önerilen kullanıcılar getirilemedi." });
  }
});

// 1. POST /follow/:userId - Kullanıcıyı takip et
router.post("/follow/:userId", authMiddleware, async (req: Request, res: Response): Promise<any> => {
  try {
    const followerId = (req as any).userId; // Giriş yapan kişi
    const followingId = req.params.userId;  // Takip edilecek kişi

    if (followerId === followingId) {
      return res.status(400).json({ error: "Kendinizi takip edemezsiniz." });
    }

    // Zaten takip ediyor mu kontrolü
    const existingFollow = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });

    if (existingFollow) {
      return res.json({ message: "Bu kullanıcıyı zaten takip ediyorsunuz." });
    }

    await prisma.follow.create({ data: { followerId, followingId } });
    res.status(201).json({ message: "Kullanıcı takip edilmeye başlandı." });
  } catch (error) {
    res.status(500).json({ error: "Takip işlemi sırasında hata oluştu." });
  }
});

// 2. DELETE /follow/:userId - Takibi bırak
router.delete("/follow/:userId", authMiddleware, async (req: Request, res: Response): Promise<any> => {
  try {
    const followerId = (req as any).userId;
    const followingId = req.params.userId;

    await prisma.follow.deleteMany({
      where: { followerId, followingId },
    });

    res.json({ message: "Takip bırakıldı." });
  } catch (error) {
    res.status(500).json({ error: "Takip bırakma işlemi sırasında hata oluştu." });
  }
});

// 3. GET /followers/:userId - Bir kullanıcının takipçilerini listele
router.get("/followers/:userId", authMiddleware, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.params.userId;
    const followers = await prisma.follow.findMany({
      where: { followingId: userId },
      include: { follower: { select: { id: true, username: true, fullName: true } } },
    });
    res.json({ count: followers.length, followers: followers.map(f => f.follower) });
  } catch (error) {
    res.status(500).json({ error: "Takipçiler getirilemedi." });
  }
});

// 4. GET /following/:userId - Bir kullanıcının takip ettiklerini listele
router.get("/following/:userId", authMiddleware, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.params.userId;
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      include: { following: { select: { id: true, username: true, fullName: true } } },
    });
    res.json({ count: following.length, following: following.map(f => f.following) });
  } catch (error) {
    res.status(500).json({ error: "Takip edilenler getirilemedi." });
  }
});

// 5. POST /saved-decks/:deckId - Desteyi Kaydet / Kaydedilenlerden Çıkar (Toggle)
router.post("/saved-decks/:deckId", authMiddleware, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).userId;
    const deckId = req.params.deckId;

    const existingSave = await prisma.savedDeck.findUnique({
      where: { userId_deckId: { userId, deckId } },
    });

    if (existingSave) {
      // Varsa sil
      await prisma.savedDeck.delete({ where: { id: existingSave.id } });
      return res.json({ saved: false, message: "Deste kaydedilenlerden çıkarıldı." });
    } else {
      // Yoksa ekle
      await prisma.savedDeck.create({ data: { userId, deckId } });
      return res.status(201).json({ saved: true, message: "Deste başarıyla kaydedildi." });
    }
  } catch (error) {
    res.status(500).json({ error: "Deste kaydetme işlemi sırasında hata oluştu." });
  }
});

// 6. GET /saved-decks - Giriş yapan kullanıcının kaydettiği desteleri listele
router.get("/saved-decks", authMiddleware, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).userId;
    const savedDecks = await prisma.savedDeck.findMany({
      where: { userId },
      include: { deck: { include: { author: { select: { username: true } } } } },
      orderBy: { createdAt: "desc" },
    });
    // Sadece deck kısmını temiz bir dizi olarak döndürüyoruz
    res.json(savedDecks.map(sd => sd.deck));
  } catch (error) {
    res.status(500).json({ error: "Kaydedilen desteler getirilemedi." });
  }
});

export default router;