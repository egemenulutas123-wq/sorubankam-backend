import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const checkAndAwardBadges = async (userId: string) => {
  // Kullanıcının güncel istatistiklerini çek
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    include: {
      badges: true,
      _count: { select: { decks: true, followers: true } }
    }
  });

  if (!profile) return [];

  const attempts = await prisma.attempt.findMany({ where: { userId } });
  const totalCorrect = attempts.filter(a => a.isCorrect).length;

  // Kontrol edilecek kriterleri bir haritada topla
  const userStats: any = {
    "total_attempts": attempts.length,
    "total_correct": totalCorrect,
    "streak": profile.currentStreak,
    "deck_count": profile._count.decks,
    "follower_count": profile._count.followers
  };

  const allBadges = await prisma.badge.findMany();
  const earnedBadgeIds = profile.badges.map(b => b.badgeId);
  
  // Sadece henüz kazanmadığı rozetleri filtrele
  const unearnedBadges = allBadges.filter(b => !earnedBadgeIds.includes(b.id));
  const newBadges = [];

  for (const badge of unearnedBadges) {
    const currentValue = userStats[badge.requirementType] || 0;
    
    // Eğer şartı sağladıysa rozeti ver ve XP'sini ekle
    if (currentValue >= badge.requirementValue) {
      await prisma.userBadge.create({
        data: { userId, badgeId: badge.id }
      });
      
      await prisma.profile.update({
        where: { id: userId },
        data: { xpCurrent: { increment: badge.xpReward } }
      });
      
      newBadges.push(badge);
    }
  }

  return newBadges; // Yeni kazanılan rozetleri geri döndür
};