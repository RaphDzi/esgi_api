import express from 'express';
import bcrypt from 'bcryptjs';
import pool from './db.js';
import { createToken, authenticate, authorize } from './auth.js';


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

// managers can only modify the products they created, admins can modify all of them
// must be used after authenticate()
async function checkOwnership(req, res, next) {
  if (req.user.role === 'admin') return next();

  const [rows] = await pool.query('SELECT created_by FROM products WHERE id = ?', [req.params.id]);
  if (rows.length === 0) {
    return res.status(404).json({ error: 'Produit introuvable' });
  }
  if (rows[0].created_by !== req.user.id) {
    return res.status(403).json({ error: 'Vous ne pouvez modifier que les produits que vous avez créés' });
  }
  next();
}

app.get('/', (req, res) => {
  res.json({message : 'API OK'});
});

//login : returns an access token valid for 5 minutes
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return res.status(400).json({ error: 'Les champs "email" et "password" sont obligatoires' });
  }

  const [rows] = await pool.query('SELECT id, password, role FROM users WHERE email = ?', [email]);
  const user = rows[0];

  // same message if the email or the password is wrong : don't tell which accounts exist
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }

  res.json({ token: createToken(user), token_type: 'Bearer', expires_in: 300, role: user.role });
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

//create a product (managers and admins), the creator is saved in created_by
app.post('/products', authenticate, authorize('manager', 'admin'), async (req, res) => {
  const error = validateProduct(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const { name, description, price, category } = req.body;
  const [result] = await pool.query(
    'INSERT INTO products (name, description, price, category, created_by) VALUES (?, ?, ?, ?, ?)',
    [name, description, price, category, req.user.id]
  );
  res.status(201).json({ id: result.insertId, name, description, price, category, created_by: req.user.id });
});

//replace a product (all fields required) : admins, or the manager who created it
app.put('/products/:id', authenticate, authorize('manager', 'admin'), checkOwnership, async (req, res) => {
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
  const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
  res.json(rows[0]);
});

//update some fields of a product : admins, or the manager who created it
app.patch('/products/:id', authenticate, authorize('manager', 'admin'), checkOwnership, async (req, res) => {
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

//delete a product (admins only)
app.delete('/products/:id', authenticate, authorize('admin'), async (req, res) => {
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
