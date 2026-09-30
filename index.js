import express from 'express';
import pool from './db.js';


const app = express();

app.use(express.json());

// fields a client is allowed to send, with their max length in the database
const FIELDS = {
  name: 100,
  description: 255,
  price: null,
  category: 50,
};

// check the product sent by the client, returns an error message or null
// partial = true for PATCH : missing fields are allowed
function validateProduct(body, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Le corps de la requête doit être un objet JSON';
  }

  for (const [field, maxLength] of Object.entries(FIELDS)) {
    const value = body[field];

    if (value === undefined) {
      if (partial) continue;
      return `Le champ "${field}" est obligatoire`;
    }

    if (field === 'price') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        return 'Le champ "price" doit être un nombre positif';
      }
    } else if (typeof value !== 'string' || value.trim() === '') {
      return `Le champ "${field}" doit être un texte non vide`;
    } else if (value.length > maxLength) {
      return `Le champ "${field}" ne doit pas dépasser ${maxLength} caractères`;
    }
  }

  return null;
}

// keep only the known fields (ignore "id" or anything else sent by the client)
function pickFields(body) {
  const product = {};
  for (const field of Object.keys(FIELDS)) {
    if (body[field] !== undefined) product[field] = body[field];
  }
  return product;
}

// runs before every route containing :id, rejects ids like "abc" or "1 OR 1=1"
app.param('id', (req, res, next, id) => {
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: "L'id doit être un entier positif" });
  }
  next();
});

app.get('/', (req, res) => {
  res.json({message : 'API OK'});
});

//list all products
app.get('/products', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM products');
  res.json(rows);
});

//get one product by id
app.get('/products/:id', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (rows.length === 0) {
    return res.status(404).json({ error: 'Produit introuvable' });
  }
  res.json(rows[0]);
});

//create a product
app.post('/products', async (req, res) => {
  const error = validateProduct(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const { name, description, price, category } = req.body;
  const [result] = await pool.query(
    'INSERT INTO products (name, description, price, category) VALUES (?, ?, ?, ?)',
    [name, description, price, category]
  );
  res.status(201).json({ id: result.insertId, name, description, price, category });
});

//replace a product (all fields required)
app.put('/products/:id', async (req, res) => {
  const error = validateProduct(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const { name, description, price, category } = req.body;
  const [result] = await pool.query(
    'UPDATE products SET name = ?, description = ?, price = ?, category = ? WHERE id = ?',
    [name, description, price, category, req.params.id]
  );
  if (result.affectedRows === 0) {
    return res.status(404).json({ error: 'Produit introuvable' });
  }
  res.json({ id: Number(req.params.id), name, description, price, category });
});

//update some fields of a product
app.patch('/products/:id', async (req, res) => {
  const error = validateProduct(req.body, true);
  if (error) {
    return res.status(400).json({ error });
  }

  const fields = pickFields(req.body);
  if (Object.keys(fields).length === 0) {
    return res.status(400).json({ error: 'Aucun champ à modifier' });
  }

  // "SET ?" with an object becomes : SET `name` = 'x', `price` = 12
  const [result] = await pool.query('UPDATE products SET ? WHERE id = ?', [fields, req.params.id]);
  if (result.affectedRows === 0) {
    return res.status(404).json({ error: 'Produit introuvable' });
  }

  const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
  res.json(rows[0]);
});

//delete a product
app.delete('/products/:id', async (req, res) => {
  const [result] = await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) {
    return res.status(404).json({ error: 'Produit introuvable' });
  }
  res.status(204).end();
});

// no route matched
app.use((req, res) => {
  res.status(404).json({ error: 'Route introuvable' });
});

// errors : invalid JSON sent by the client, or a problem with the database
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON invalide' });
  }
  console.error(err);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

app.listen (3000, () => {
  console.log('Server is running');
});
