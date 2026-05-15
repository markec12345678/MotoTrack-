const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');

async function main() {
  const url = process.env.TURSO_URL || 'libsql://mototrack-robertpezdirc27.aws-eu-west-1.turso.io';
  const token = process.env.TURSO_AUTH_TOKEN;

  if (!token) {
    console.error('TURSO_AUTH_TOKEN environment variable is required');
    process.exit(1);
  }

  const client = createClient({ url, authToken: token });

  // Generate unique IDs (simple cuid-like)
  function makeId() {
    return 'cmp' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
  }

  const userIds = [makeId(), makeId(), makeId()];
  const now = new Date().toISOString();

  // Create users
  const users = [
    { id: userIds[0], name: 'Miran M.', email: 'miran@mototrack.si', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Miran', bike: 'BMW R1250GS', bio: 'Adventurni motociklist z ljubeznijo do slovenskih gora.', fuelCapacity: 15.0, fuelConsumption: 5.5, currentFuel: 15.0, speedLimit: 90, speedAlertEnabled: 1, speedAlertSound: 1, currentMileage: 12500, createdAt: now, updatedAt: now },
    { id: userIds[1], name: 'Luka K.', email: 'luka@mototrack.si', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Luka', bike: 'Yamaha Ténéré 700', bio: 'Enduro navdušenec. Vikend izleti po Sloveniji so moja strast.', fuelCapacity: 16.0, fuelConsumption: 4.8, currentFuel: 12.0, speedLimit: 90, speedAlertEnabled: 1, speedAlertSound: 1, currentMileage: 8700, createdAt: now, updatedAt: now },
    { id: userIds[2], name: 'Ana S.', email: 'ana@mototrack.si', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ana', bike: 'Honda CB500X', bio: 'Motorkulinatičarka in popotnica po Primorski in Istri.', fuelCapacity: 17.0, fuelConsumption: 3.9, currentFuel: 14.0, speedLimit: 80, speedAlertEnabled: 1, speedAlertSound: 0, currentMileage: 5300, createdAt: now, updatedAt: now },
  ];

  console.log('Seeding Turso database...');

  // Insert users
  for (const u of users) {
    await client.execute({
      sql: `INSERT OR IGNORE INTO User (id, name, email, avatar, bike, bio, fuelCapacity, fuelConsumption, currentFuel, speedLimit, speedAlertEnabled, speedAlertSound, currentMileage, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [u.id, u.name, u.email, u.avatar, u.bike, u.bio, u.fuelCapacity, u.fuelConsumption, u.currentFuel, u.speedLimit, u.speedAlertEnabled, u.speedAlertSound, u.currentMileage, u.createdAt, u.updatedAt]
    });
  }
  console.log(`  ✓ ${users.length} users`);

  // Insert POIs
  const pois = [
    { name: 'Petrol Ljubljana Center', type: 'gas_station', lat: 46.0569, lng: 14.5058, description: 'Bencinska črpalka v središču Ljubljane. 24/7 odprto.', rating: 4.2 },
    { name: 'Restavracija As', type: 'restaurant', lat: 46.0510, lng: 14.5060, description: 'Priljubljena restavracija z lokalno hrano.', rating: 4.5 },
    { name: 'Moto srečanje Rožnik', type: 'biker_spot', lat: 46.0580, lng: 14.4800, description: 'Srečanje motoristov ob nedeljah.', rating: 4.7 },
    { name: 'Moto servis Ljubljana', type: 'mechanic', lat: 46.0620, lng: 14.5200, description: 'Avtorizirani servis BMW in Yamaha.', rating: 4.6 },
    { name: 'OMV Bled', type: 'gas_station', lat: 46.3625, lng: 14.0944, description: 'Bencinska črpalka ob cesti proti Bledu.', rating: 4.0 },
    { name: 'Restavracija Blejski grad', type: 'restaurant', lat: 46.3690, lng: 14.0930, description: 'Restavracija z razgledom na Blejski jezero.', rating: 4.8 },
    { name: 'Petrol Bovec', type: 'gas_station', lat: 46.3317, lng: 13.5536, description: 'Edina bencinska črpalka v Bovcu.', rating: 3.9 },
    { name: 'Restavracija Soča', type: 'restaurant', lat: 46.3350, lng: 13.5600, description: 'Domača hrana ob reki Soči. Soška postrvlj.', rating: 4.6 },
    { name: 'Moto srečanje Bovec', type: 'biker_spot', lat: 46.3300, lng: 13.5500, description: 'Letno mednarodno moto srečanje.', rating: 4.9 },
    { name: 'OMV Koper', type: 'gas_station', lat: 45.5481, lng: 13.7300, description: 'Bencinska črpalka ob vhodu v Koper.', rating: 4.1 },
    { name: 'Restavracija Piran', type: 'restaurant', lat: 45.5272, lng: 13.5681, description: 'Morska restavracija v Piranu.', rating: 4.7 },
    { name: 'Moto servis Maribor', type: 'mechanic', lat: 46.5547, lng: 15.6459, description: 'Splošni moto servis v Mariboru.', rating: 4.3 },
    { name: 'Parkirišče Vršič', type: 'parking', lat: 46.4333, lng: 13.7333, description: 'Parkirišče na prelazu Vršič.', rating: 4.2 },
    { name: 'Hotel Vila Bled', type: 'hotel', lat: 46.3570, lng: 14.0890, description: 'Luksuzni hotel ob Blejskem jezeru.', rating: 4.9 },
  ];

  for (const poi of pois) {
    await client.execute({
      sql: `INSERT INTO Poi (id, name, type, lat, lng, description, rating, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [makeId(), poi.name, poi.type, poi.lat, poi.lng, poi.description, poi.rating, now]
    });
  }
  console.log(`  ✓ ${pois.length} POIs`);

  // Insert hazards
  const hazards = [
    { type: 'speed_camera', name: 'Hitrostna past Ljubljana', description: 'Hitrostna kamera na Ljubljanski obvoznici', lat: 46.075, lng: 14.53, userId: userIds[0] },
    { type: 'speed_camera', name: 'Hitrostna past Maribor', description: 'Hitrostna kamera na Mariborski obvoznici', lat: 46.54, lng: 15.62, userId: userIds[1] },
    { type: 'rockfall', name: 'Plazovito območje Vršič', description: 'Nevarnost padanja kamenja spomladi', lat: 46.44, lng: 13.72 },
    { type: 'slippery', name: 'Zdrsna cesta Predel', description: 'Nevarnost zdrsa pri mrazu', lat: 46.385, lng: 13.56 },
    { type: 'wildlife', name: 'Divjad Soška dolina', description: 'Pogost prehod divjadi čez cesto', lat: 46.32, lng: 13.6 },
    { type: 'slippery', name: 'Zdrsna cesta Mangart', description: 'Izjemno drsna cesta pri mokri podlagi', lat: 46.455, lng: 13.64 },
    { type: 'construction', name: 'Delnice na Gorenjski', description: 'Cesta v popravilu', lat: 46.2, lng: 14.2 },
    { type: 'speed_limit', name: 'Omejitev 30 Ljubljana center', description: 'Omejitev hitrosti 30 km/h', lat: 46.05, lng: 14.505 },
  ];

  for (const h of hazards) {
    const userId = h.userId || null;
    await client.execute({
      sql: `INSERT INTO Hazard (id, type, name, description, lat, lng, userId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [makeId(), h.type, h.name, h.description, h.lat, h.lng, userId, now]
    });
  }
  console.log(`  ✓ ${hazards.length} hazards`);

  // Insert communities
  const communityIds = [makeId(), makeId(), makeId(), makeId(), makeId()];
  const communitiesData = [
    { id: communityIds[0], name: 'Alpski motoristi', description: 'Skupnost motoristov gorskih prelazov.', avatar: '🏔️' },
    { id: communityIds[1], name: 'Soški jezdecí', description: 'Motoristi Soške doline.', avatar: '🌊' },
    { id: communityIds[2], name: 'Obalni rajderji', description: 'Primorski motoristi.', avatar: '🏖️' },
    { id: communityIds[3], name: 'Enduro Slovenija', description: 'Enduro in off-road navdušenci.', avatar: '🏍️' },
    { id: communityIds[4], name: 'Nočni jezdecí Ljubljana', description: 'Nočne vožnje in kavarna ob polnoči.', avatar: '🌙' },
  ];

  for (const c of communitiesData) {
    await client.execute({
      sql: `INSERT INTO Community (id, name, description, avatar, isPublic, createdAt, updatedAt) VALUES (?, ?, ?, ?, 1, ?, ?)`,
      args: [c.id, c.name, c.description, c.avatar, now, now]
    });
  }
  console.log(`  ✓ ${communitiesData.length} communities`);

  // Community members
  const membersData = [
    { userId: userIds[0], communityId: communityIds[0], role: 'admin' },
    { userId: userIds[1], communityId: communityIds[0], role: 'member' },
    { userId: userIds[2], communityId: communityIds[0], role: 'member' },
    { userId: userIds[1], communityId: communityIds[1], role: 'admin' },
    { userId: userIds[0], communityId: communityIds[1], role: 'member' },
    { userId: userIds[2], communityId: communityIds[2], role: 'admin' },
    { userId: userIds[0], communityId: communityIds[2], role: 'moderator' },
    { userId: userIds[1], communityId: communityIds[3], role: 'admin' },
    { userId: userIds[0], communityId: communityIds[3], role: 'member' },
    { userId: userIds[0], communityId: communityIds[4], role: 'admin' },
    { userId: userIds[2], communityId: communityIds[4], role: 'member' },
  ];

  for (const m of membersData) {
    await client.execute({
      sql: `INSERT INTO CommunityMember (id, userId, communityId, role, joinedAt) VALUES (?, ?, ?, ?, ?)`,
      args: [makeId(), m.userId, m.communityId, m.role, now]
    });
  }
  console.log(`  ✓ ${membersData.length} community members`);

  // Insert achievements
  const achievementsData = [
    { type: 'first_ride', title: 'Prva vožnja', description: 'Zaključili ste prvo vožnjo!', icon: '🏍️', userId: userIds[0] },
    { type: 'hiker', title: 'Pohodnik', description: 'Zaključili ste 10 voženj!', icon: '🥾', userId: userIds[0] },
    { type: 'first_ride', title: 'Prva vožnja', description: 'Zaključili ste prvo vožnjo!', icon: '🏍️', userId: userIds[1] },
    { type: 'mountain_cossack', title: 'Gorski kozak', description: 'Prevozili ste 5000m višine!', icon: '⛰️', userId: userIds[1] },
    { type: 'first_ride', title: 'Prva vožnja', description: 'Zaključili ste prvo vožnjo!', icon: '🏍️', userId: userIds[2] },
    { type: 'speed_demon', title: 'Hitrostni demon', description: 'Hitrost nad 120 km/h!', icon: '⚡', userId: userIds[2] },
  ];

  for (const a of achievementsData) {
    await client.execute({
      sql: `INSERT INTO Achievement (id, type, title, description, icon, userId, earnedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [makeId(), a.type, a.title, a.description, a.icon, a.userId, now]
    });
  }
  console.log(`  ✓ ${achievementsData.length} achievements`);

  // Insert challenges
  const challengeIds = [makeId(), makeId(), makeId()];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString();

  const challenges = [
    { id: challengeIds[0], title: 'Mesečni km', description: 'Prevozite 500 km ta mesec!', type: 'distance', goal: 500, unit: 'km', icon: '🛣️', points: 200, creatorId: userIds[0] },
    { id: challengeIds[1], title: 'Alpski osvajalec', description: 'Premejajte 3000m višine!', type: 'elevation', goal: 3000, unit: 'm', icon: '⛰️', points: 300, creatorId: userIds[0] },
    { id: challengeIds[2], title: 'Veriga dni', description: 'Vozite 7 dni zapored!', type: 'streak', goal: 7, unit: 'dni', icon: '🔥', points: 250, creatorId: userIds[2] },
  ];

  for (const c of challenges) {
    await client.execute({
      sql: `INSERT INTO challenges (id, title, description, type, goal, unit, startDate, endDate, isPublic, category, icon, points, creatorId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'monthly', ?, ?, ?, ?)`,
      args: [c.id, c.title, c.description, c.type, c.goal, c.unit, monthStart, monthEnd, c.icon, c.points, c.creatorId, now]
    });
  }
  console.log(`  ✓ ${challenges.length} challenges`);

  // Challenge participants
  const participants = [
    { challengeId: challengeIds[0], userId: userIds[0], progress: 347 },
    { challengeId: challengeIds[0], userId: userIds[1], progress: 215 },
    { challengeId: challengeIds[1], userId: userIds[1], progress: 1800 },
    { challengeId: challengeIds[2], userId: userIds[2], progress: 4 },
  ];

  for (const p of participants) {
    await client.execute({
      sql: `INSERT INTO challenge_participants (id, challengeId, userId, progress, completed, pointsEarned, joinedAt) VALUES (?, ?, ?, ?, 0, 0, ?)`,
      args: [makeId(), p.challengeId, p.userId, p.progress, now]
    });
  }
  console.log(`  ✓ ${participants.length} challenge participants`);

  // Insert user points
  const userPoints = [
    { userId: userIds[0], totalPoints: 1250, ridesPoints: 800, socialPoints: 250, challengePoints: 200, streakDays: 4, level: 3 },
    { userId: userIds[1], totalPoints: 890, ridesPoints: 500, socialPoints: 190, challengePoints: 200, streakDays: 2, level: 2 },
    { userId: userIds[2], totalPoints: 640, ridesPoints: 400, socialPoints: 140, challengePoints: 100, streakDays: 4, level: 2 },
  ];

  for (const up of userPoints) {
    await client.execute({
      sql: `INSERT INTO user_points (id, userId, totalPoints, level, ridesPoints, socialPoints, challengePoints, streakDays, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [makeId(), up.userId, up.totalPoints, up.level, up.ridesPoints, up.socialPoints, up.challengePoints, up.streakDays, now, now]
    });
  }
  console.log(`  ✓ ${userPoints.length} user points`);

  // Verify data
  const result = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  console.log('\n✅ Database seeded successfully!');
  console.log(`\nTables: ${result.rows.length}`);

  // Count records
  for (const row of result.rows) {
    try {
      const count = await client.execute(`SELECT COUNT(*) as cnt FROM "${row.name}"`);
      console.log(`  ${row.name}: ${count.rows[0].cnt} rows`);
    } catch (e) { }
  }
}

main().catch(console.error);
