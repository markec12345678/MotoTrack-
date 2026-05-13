import { db } from '@/lib/db'

export async function notifyLike(userId: string, fromUserId: string, routeTitle: string, routeId: string) {
  // Don't notify self
  if (userId === fromUserId) return
  const fromUser = await db.user.findUnique({ where: { id: fromUserId } })
  await db.notification.create({
    data: {
      type: 'like',
      title: 'Nov všeček',
      message: `${fromUser?.name || 'Nekdo'} je všečkal vašo pot "${routeTitle}"`,
      userId,
      fromUserId,
      relatedId: routeId,
    },
  })
}

export async function notifyComment(userId: string, fromUserId: string, text: string, relatedId: string) {
  if (userId === fromUserId) return
  const fromUser = await db.user.findUnique({ where: { id: fromUserId } })
  await db.notification.create({
    data: {
      type: 'comment',
      title: 'Nov komentar',
      message: `${fromUser?.name || 'Nekdo'} je komentiral: "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"`,
      userId,
      fromUserId,
      relatedId,
    },
  })
}

export async function notifyAchievement(userId: string, achievementTitle: string, achievementIcon: string) {
  await db.notification.create({
    data: {
      type: 'achievement',
      title: 'Nov dosežek! 🏆',
      message: `Zaslužili ste dosežek: ${achievementIcon} ${achievementTitle}`,
      userId,
    },
  })
}

export async function notifyFriendRequest(userId: string, fromUserId: string) {
  const fromUser = await db.user.findUnique({ where: { id: fromUserId } })
  await db.notification.create({
    data: {
      type: 'friend_request',
      title: 'Prošnja za prijateljstvo',
      message: `${fromUser?.name || 'Nekdo'} vas želi dodati za prijatelja`,
      userId,
      fromUserId,
    },
  })
}

export async function notifyCommunityJoin(userId: string, communityName: string, communityId: string) {
  await db.notification.create({
    data: {
      type: 'community_join',
      title: 'Nov član skupnosti',
      message: `Nov član se je pridružil skupnosti "${communityName}"`,
      userId,
      relatedId: communityId,
    },
  })
}
