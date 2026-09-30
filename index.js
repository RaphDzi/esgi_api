import express from 'express';
import pool from './db.js';


const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.json({message : 'API OK'});
});

const [rows] = await pool.query('SELECT 1 + 1 AS resultat');
console.log('Connexion MySQL OK :', rows);

app.listen (3000, () => {
  console.log('Server is running');
});