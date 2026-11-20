import jwt from 'jsonwebtoken';
export function requireAuth(req,res,next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i,'');
  if (!token) return res.status(401).json({error:'Authentication required'});
  try { req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret'); next(); }
  catch { return res.status(401).json({error:'Invalid or expired token'}); }
}
export const sign = (id) => jwt.sign({id}, process.env.JWT_SECRET || 'dev-secret', {expiresIn:'7d'});
