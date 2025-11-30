import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

async function updateSchedule() {
  try {
    console.log('📅 Updating streaming schedule...');

    const scheduleEntries = [
      { dayOfWeek: 0, streamNumber: 1, eventTitle: 'Nick' },
      { dayOfWeek: 0, streamNumber: 2, eventTitle: 'Cierra' },
      { dayOfWeek: 1, streamNumber: 1, eventTitle: 'Nick' },
      { dayOfWeek: 1, streamNumber: 2, eventTitle: 'Cierra' },
      { dayOfWeek: 2, streamNumber: 1, eventTitle: 'Nick' },
      { dayOfWeek: 2, streamNumber: 2, eventTitle: 'Nick' },
      { dayOfWeek: 3, streamNumber: 1, eventTitle: 'Nick' },
      { dayOfWeek: 3, streamNumber: 2, eventTitle: 'Cierra' },
      { dayOfWeek: 4, streamNumber: 1, eventTitle: 'Nick' },
      { dayOfWeek: 4, streamNumber: 2, eventTitle: 'Nick' },
      { dayOfWeek: 5, streamNumber: 1, eventTitle: 'Nick' },
      { dayOfWeek: 5, streamNumber: 2, eventTitle: 'Nick' },
      { dayOfWeek: 6, streamNumber: 1, eventTitle: 'Nick' },
      { dayOfWeek: 6, streamNumber: 2, eventTitle: 'Cierra' },
    ];

    for (const entry of scheduleEntries) {
      await prisma.schedule.upsert({
        where: {
          dayOfWeek_streamNumber: {
            dayOfWeek: entry.dayOfWeek,
            streamNumber: entry.streamNumber,
          },
        },
        update: {
          eventTitle: entry.eventTitle,
          isActive: true,
          updatedAt: new Date(),
        },
        create: {
          dayOfWeek: entry.dayOfWeek,
          streamNumber: entry.streamNumber,
          eventTitle: entry.eventTitle,
          isActive: true,
        },
      });

      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      console.log(`✅ Updated: ${dayNames[entry.dayOfWeek]} - Stream ${entry.streamNumber} - ${entry.eventTitle}`);
    }

    console.log('\n✅ Schedule update completed successfully!');
  } catch (error) {
    console.error('❌ Error updating schedule:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateSchedule();

