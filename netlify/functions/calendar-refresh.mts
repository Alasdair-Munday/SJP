import { getSnapshot } from '../../src/lib/calendar/store.mjs';

export default async () => {
  const snapshot = await getSnapshot({ force: true });
  if (snapshot.error) throw new Error(snapshot.error);
  console.info('[calendar] Verified public calendar', snapshot.verifiedAt);
};

export const config = { schedule: '*/5 * * * *' };
