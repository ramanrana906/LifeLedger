import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set before migrating.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

async function main() {
  console.log('Starting migration to People-first model...');

  // 1. Fetch all checkins and dates that don't have a personId
  const checkins = await prisma.relationshipCheckin.findMany({
    where: { personId: null, personName: { not: null } },
  });

  const dates = await prisma.importantDate.findMany({
    where: { personId: null, personName: { not: null } },
  });

  console.log(`Found ${checkins.length} checkins and ${dates.length} important dates to migrate.`);

  // 2. Build a map of unique people: key is `${userId}:${personName}`
  const peopleMap = new Map<string, { userId: string; name: string; relationshipType: string }>();

  for (const checkin of checkins) {
    if (!checkin.personName) continue;
    const key = `${checkin.userId}:${checkin.personName}`;
    if (!peopleMap.has(key)) {
      peopleMap.set(key, {
        userId: checkin.userId,
        name: checkin.personName,
        relationshipType: checkin.category ?? 'Friend',
      });
    }
  }

  for (const date of dates) {
    if (!date.personName) continue;
    const key = `${date.userId}:${date.personName}`;
    if (!peopleMap.has(key)) {
      peopleMap.set(key, {
        userId: date.userId,
        name: date.personName,
        relationshipType: 'Friend',
      });
    }
  }

  console.log(`Found ${peopleMap.size} unique people to create/upsert.`);

  // 3. Upsert people and collect their IDs
  const personIdMap = new Map<string, string>(); // key: `${userId}:${name}`, value: personId
  
  for (const [key, person] of peopleMap.entries()) {
    const createdPerson = await prisma.person.upsert({
      where: {
        userId_name: {
          userId: person.userId,
          name: person.name,
        }
      },
      update: {},
      create: {
        userId: person.userId,
        name: person.name,
        relationshipType: person.relationshipType,
      },
    });
    personIdMap.set(key, createdPerson.id);
  }

  // 4. Update checkins
  let checkinsUpdated = 0;
  for (const checkin of checkins) {
    if (!checkin.personName) continue;
    const key = `${checkin.userId}:${checkin.personName}`;
    const personId = personIdMap.get(key);
    if (personId) {
      await prisma.relationshipCheckin.update({
        where: { id: checkin.id },
        data: { personId },
      });
      checkinsUpdated++;
    }
  }

  // 5. Update dates
  let datesUpdated = 0;
  for (const date of dates) {
    if (!date.personName) continue;
    const key = `${date.userId}:${date.personName}`;
    const personId = personIdMap.get(key);
    if (personId) {
      await prisma.importantDate.update({
        where: { id: date.id },
        data: { personId },
      });
      datesUpdated++;
    }
  }

  console.log(`Successfully migrated ${checkinsUpdated} checkins and ${datesUpdated} dates.`);
  console.log('Migration complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
