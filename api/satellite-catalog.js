const groups = new Set(['starlink', 'oneweb', 'gps-ops', 'galileo', 'glo-ops', 'weather']);

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }
  const group = request.query?.group;
  if (!groups.has(group)) return response.status(400).json({ error: 'Unknown satellite group' });

  try {
    const upstream = await fetch(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=JSON`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!upstream.ok) throw new Error('Satellite catalog unavailable');
    const objects = await upstream.json();
    if (!Array.isArray(objects) || !objects.length) throw new Error('Empty satellite catalog');

    // Keep the response compact for large constellations and Vercel’s response size limit.
    const elements = objects.map(object => [
      object.OBJECT_NAME, object.NORAD_CAT_ID, object.EPOCH, object.MEAN_MOTION, object.ECCENTRICITY,
      object.INCLINATION, object.RA_OF_ASC_NODE, object.ARG_OF_PERICENTER, object.MEAN_ANOMALY,
      object.BSTAR, object.MEAN_MOTION_DOT, object.MEAN_MOTION_DDOT,
    ]);
    response.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
    return response.status(200).json({ elements, fetchedAt: new Date().toISOString() });
  } catch {
    response.setHeader('Cache-Control', 'no-store');
    return response.status(502).json({ error: 'Satellite catalog temporarily unavailable' });
  }
}
