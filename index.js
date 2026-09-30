import express from 'express';
import pool from './db.js';


const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.json({message : 'API OK'});
});

//list all products
app.get('/products', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM products');
  res.json(rows);
});

//get one product by id
app.get('/products/:id', async (req, res) = > {
    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    res.json(rows);
});



app.listen (3000, () => {
  console.log('Server is running');
});