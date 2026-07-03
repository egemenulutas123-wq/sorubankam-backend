import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const badges = [
    { name: "İlk Adım", description: "İlk sorunuzu çözdünüz.", xpReward: 50, requirementType: "total_attempts", requirementValue: 1 },
    { name: "Isınma Turu", description: "Toplam 10 doğru cevap verdiniz.", xpReward: 100, requirementType: "total_correct", requirementValue: 10 },
    { name: "Bilgi Küpü", description: "Toplam 50 doğru cevap verdiniz.", xpReward: 300, requirementType: "total_correct", requirementValue: 50 },
    { name: "Ateşli Öğrenci", description: "3 gün üst üste giriş yaptınız.", xpReward: 100, requirementType: "streak", requirementValue: 3 },
    { name: "İstikrar Abidesi", description: "7 gün üst üste giriş yaptınız.", xpReward: 400, requirementType: "streak", requirementValue: 7 },
    { name: "İçerik Üreticisi", description: "İlk destenizi oluşturdunuz.", xpReward: 100, requirementType: "deck_count", requirementValue: 1 },
    { name: "Fenomen", description: "İlk takipçinizi kazandınız.", xpReward: 150, requirementType: "follower_count", requirementValue: 1 },
  ];

  for (const badge of badges) {
    await prisma.badge.create({ data: badge });
  }
  console.log("Rozetler veritabanına başarıyla eklendi! 🎉");
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });