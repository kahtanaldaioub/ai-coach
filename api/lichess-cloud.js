// api/lichess-cloud.js
export default async function handler(req, res) {
  // Enable CORS for development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const { fen } = req.query;
  if (!fen) {
    return res.status(400).json({ error: 'Missing FEN parameter' });
  }
  
  try {
    const url = `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=1`;
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Cloud eval failed' });
    }
    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}