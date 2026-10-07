import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import {query} from './db.js';
import {requireAuth, sign} from './auth.js';
import {scoreItem} from './recommendationEngine.js';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const app = express();
app.use(cors()); app.use(express.json({limit:'100kb'}));
const catalogImages = process.env.KAGGLE_DATA_PATH || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../kaggledata');
app.use('/catalog-images', express.static(path.join(catalogImages, 'images')));
const clean = (v) => typeof v === 'string' ? v.trim() : '';
const arrays = (v) => Array.isArray(v) ? v.filter(x => typeof x === 'string').map(x => x.trim().toLowerCase()).slice(0,20) : [];
async function context(userId) {
  const p = await query('SELECT * FROM user_preferences WHERE user_id=$1',[userId]);
  const i = await query(`SELECT c.*, ui.interaction_type FROM user_interactions ui JOIN clothing_items c ON c.id=ui.item_id WHERE ui.user_id=$1`,[userId]);
  return {preferences:p.rows[0] || {}, likes:i.rows.filter(x=>x.interaction_type==='like'), dislikes:i.rows.filter(x=>x.interaction_type==='dislike')};
}
app.get('/api/health', (req,res)=>res.json({ok:true}));
app.post('/api/auth/register', async (req,res,next)=>{try {
  const email=clean(req.body.email).toLowerCase(), firstName=clean(req.body.firstName), password=req.body.password;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||!firstName||typeof password!=='string'||password.length<8) return res.status(400).json({error:'Valid email, name, and 8+ character password required'});
  const hash=await bcrypt.hash(password,12), r=await query('INSERT INTO users(email,password_hash,first_name) VALUES($1,$2,$3) RETURNING id,email,first_name',[email,hash,firstName]);
  res.status(201).json({token:sign(r.rows[0].id),user:r.rows[0]});
} catch(e){if(e.code==='23505') return res.status(409).json({error:'Email already registered'}); next(e);}});
app.post('/api/auth/login', async (req,res,next)=>{try {
  const r=await query('SELECT * FROM users WHERE email=$1',[clean(req.body.email).toLowerCase()]);
  if(!r.rowCount||!(await bcrypt.compare(req.body.password||'',r.rows[0].password_hash))) return res.status(401).json({error:'Invalid email or password'});
  const {id,email,first_name:firstName}=r.rows[0]; res.json({token:sign(id),user:{id,email,firstName}});
} catch(e){next(e);}});
app.get('/api/user/preferences',requireAuth,async(req,res,next)=>{try{const r=await query('SELECT * FROM user_preferences WHERE user_id=$1',[req.user.id]);res.json(r.rows[0]||null)}catch(e){next(e)}});
app.post('/api/user/preferences',requireAuth,async(req,res,next)=>{try{
  const vals=[arrays(req.body.colors),arrays(req.body.shirtStyles),arrays(req.body.pantStyles),arrays(req.body.materials)];
  if(vals.some(x=>x.length<1)) return res.status(400).json({error:'Choose at least one value for every preference'});
  const r=await query(`INSERT INTO user_preferences(user_id,preferred_colors,preferred_shirt_styles,preferred_pant_styles,preferred_materials) VALUES($1,$2,$3,$4,$5)
  ON CONFLICT(user_id) DO UPDATE SET preferred_colors=$2,preferred_shirt_styles=$3,preferred_pant_styles=$4,preferred_materials=$5,updated_at=now() RETURNING *`,[req.user.id,...vals]);res.json(r.rows[0]);
}catch(e){next(e)}});
async function ranked(req) { const ctx=await context(req.user.id); let sql='SELECT c.* FROM clothing_items c', p=[], where=[];
 if(req.query.category){p.push(clean(req.query.category));where.push(`c.category=$${p.length}`)} if(req.query.subcategory){p.push(clean(req.query.subcategory));where.push(`c.subcategory=$${p.length}`)} if(req.query.gender_tag){p.push(clean(req.query.gender_tag));where.push(`c.gender_tag=$${p.length}`)}
 if(req.query.unseen){p.push(req.user.id);where.push(`NOT EXISTS (SELECT 1 FROM user_interactions x WHERE x.item_id=c.id AND x.user_id=$${p.length})`)}
 const r=await query(`${sql}${where.length?' WHERE '+where.join(' AND '):''} ORDER BY c.created_at DESC`,p); return r.rows.map(item=>({...item,match_score:scoreItem(item,ctx.preferences,ctx)})).sort((a,b)=>b.match_score-a.match_score); }
app.get('/api/discover/next',requireAuth,async(req,res,next)=>{try{res.json((await ranked({...req,user:req.user,query:{unseen:'1'}}))[0]||null)}catch(e){next(e)}});
app.post('/api/discover/swipe',requireAuth,async(req,res,next)=>{try{const id=clean(req.body.itemId), action=req.body.action;if(!/^[0-9a-f-]{36}$/i.test(id)||!['like','dislike'].includes(action))return res.status(400).json({error:'Invalid swipe'});await query(`INSERT INTO user_interactions(user_id,item_id,interaction_type) VALUES($1,$2,$3) ON CONFLICT(user_id,item_id) DO UPDATE SET interaction_type=$3,created_at=now()`,[req.user.id,id,action]);res.json({ok:true,next:(await ranked({...req,user:req.user,query:{unseen:'1'}}))[0]||null})}catch(e){if(e.code==='23503')return res.status(404).json({error:'Item not found'});next(e)}});
app.get('/api/recommendations',requireAuth,async(req,res,next)=>{try{const all=await ranked(req),page=Math.max(1,Number(req.query.page)||1),limit=Math.min(40,Math.max(1,Number(req.query.limit)||12));res.json({items:all.slice((page-1)*limit,page*limit),page,limit,total:all.length})}catch(e){next(e)}});
app.get('/api/outfits',requireAuth,async(req,res,next)=>{try{const r=await query(`SELECT c.* FROM clothing_items c JOIN user_interactions ui ON ui.item_id=c.id WHERE ui.user_id=$1 AND ui.interaction_type='like' ORDER BY ui.created_at DESC`,[req.user.id]);res.json(r.rows)}catch(e){next(e)}});
app.get('/api/items/:id',async(req,res,next)=>{try{const r=await query('SELECT * FROM clothing_items WHERE id=$1',[req.params.id]);if(!r.rowCount)return res.status(404).json({error:'Item not found'});res.json(r.rows[0])}catch(e){next(e)}});
app.get('/api/items/:id/similar',async(req,res,next)=>{try{const r=await query('SELECT * FROM clothing_items WHERE id=$1',[req.params.id]);if(!r.rowCount)return res.status(404).json({error:'Item not found'});const x=r.rows[0],s=await query(`SELECT *, (CASE WHEN category=$1 THEN 3 ELSE 0 END + CASE WHEN color=$2 THEN 2 ELSE 0 END + CASE WHEN material=$3 THEN 2 ELSE 0 END + CASE WHEN style=$4 THEN 1 ELSE 0 END) AS similarity FROM clothing_items WHERE id<>$5 ORDER BY similarity DESC LIMIT 3`,[x.category,x.color,x.material,x.style,x.id]);res.json({item:x,similar:s.rows})}catch(e){next(e)}});
app.get('/api/faq',(req,res)=>res.json([{question:'How does matching work?',answer:'Your onboarding choices are combined with patterns from likes and dislikes to produce a transparent 0–100 match score.'},{question:'Can I change my preferences?',answer:'Yes. Open your profile and submit the questionnaire again at any time.'},{question:'What does a swipe do?',answer:'Like and dislike teach the recommendation engine and remove that item from Discover.'}]));
app.use(express.static(new URL('../../client/dist',import.meta.url).pathname)); app.get('*',(req,res,next)=>req.path.startsWith('/api')?next():res.sendFile(new URL('../../client/dist/index.html',import.meta.url).pathname));
app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:'Unexpected server error'})});
export default app;
