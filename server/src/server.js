import app from './app.js';
import dotenv from 'dotenv';
import {importCatalog} from './catalogImport.js';
dotenv.config();
await importCatalog();
app.listen(process.env.PORT||3000,()=>console.log(`Thread Match listening on ${process.env.PORT||3000}`));
