import app from './app.js';
import dotenv from 'dotenv';
import {query} from './db.js';
import {importCatalog} from './catalogImport.js';
dotenv.config();
await query("ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS preferred_genders TEXT[] NOT NULL DEFAULT '{}'");
await importCatalog();
app.listen(process.env.PORT||3000,()=>console.log(`Thread Match listening on ${process.env.PORT||3000}`));
