const source = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=JSON';

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const upstream = await fetch(source, { signal: AbortSignal.timeout(8000) });
    if (!upstream.ok) throw new Error('Orbital elements unavailable');
    const [elements] = await upstream.json();
    if (Number(elements?.NORAD_CAT_ID) !== 25544 || !elements.EPOCH || !Number(elements.MEAN_MOTION)) {
      throw new Error('Invalid ISS elements');
    }
    response.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
    return response.status(200).json({ elements, fetchedAt: new Date().toISOString() });
  } catch {
    response.setHeader('Cache-Control', 'no-store');
    return response.status(502).json({ error: 'ISS elements temporarily unavailable' });
  }
}
