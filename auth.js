import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET manquant dans le fichier .env');
}

// tokens expire after 5 minutes
const TOKEN_DURATION = '5m';

export function createToken(user) {
  // "sub" (subject) = id of the user, "role" is read by authorize()
  return jwt.sign({ sub: String(user.id), role: user.role }, JWT_SECRET, {
    expiresIn: TOKEN_DURATION,
  });
}

// 401 : who are you ? -> checks the header "Authorization: Bearer <token>"
// on success, req.user = { id, role }
export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    res.set('WWW-Authenticate', 'Bearer');
    return res.status(401).json({ error: 'Jeton d\'accès manquant' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: Number(payload.sub), role: payload.role };
    next();
  } catch (err) {
    res.set('WWW-Authenticate', 'Bearer error="invalid_token"');
    const error = err.name === 'TokenExpiredError' ? 'Jeton d\'accès expiré' : 'Jeton d\'accès invalide';
    return res.status(401).json({ error });
  }
}

// 403 : I know who you are, but you are not allowed
// usage : authorize('manager', 'admin')
export function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accès refusé pour le rôle ' + req.user.role });
    }
    next();
  };
}
