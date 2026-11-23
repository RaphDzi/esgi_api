import Joi from 'joi';

// error messages in French ({{#label}} = field name, {{#limit}} = the constraint value)
const MESSAGES = {
  'any.required': 'Le champ {{#label}} est obligatoire',
  'object.base': 'Le corps de la requête doit être un objet JSON',
  'object.min': 'Aucun champ à modifier',
  'string.base': 'Le champ {{#label}} doit être un texte',
  'string.empty': 'Le champ {{#label}} ne doit pas être vide',
  'string.max': 'Le champ {{#label}} ne doit pas dépasser {{#limit}} caractères',
  'string.email': 'Le champ {{#label}} doit être une adresse email valide',
  'number.base': 'Le champ {{#label}} doit être un nombre',
  'number.min': 'Le champ {{#label}} doit être supérieur ou égal à {{#limit}}',
  'number.max': 'Le champ {{#label}} doit être inférieur ou égal à {{#limit}}',
  'number.precision': 'Le champ {{#label}} doit avoir au plus {{#limit}} décimales',
};

const OPTIONS = {
  abortEarly: false, // return all the errors, not only the first one
  stripUnknown: true, // remove fields that are not in the schema (id, created_by...)
  errors: { wrap: { label: false } }, // name instead of "name" in messages
  messages: MESSAGES,
};

// constraints of a product, they follow the columns of the "products" table
const productFields = {
  name: Joi.string().trim().max(100), // VARCHAR(100)
  description: Joi.string().trim().max(255), // VARCHAR(255)
  // DECIMAL(15,2) : 2 decimals max, 13 digits before the comma
  // strict() : "12" (a string) is refused, the client must send a number
  price: Joi.number().strict().min(0).max(9999999999999.99).precision(2),
  category: Joi.string().trim().max(50), // VARCHAR(50)
};

// POST and PUT : the whole product, every field is required
export const productSchema = Joi.object(productFields).prefs({ presence: 'required' });

// PATCH : only the fields to modify, but at least one
export const productPatchSchema = Joi.object(productFields).min(1);

export const loginSchema = Joi.object({
  email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).max(255).required(),
  password: Joi.string().max(72).required(), // bcrypt only uses the first 72 bytes
});

// middleware : validates req.body with the schema
// 400 with the list of errors, otherwise req.body is replaced by the cleaned value
export function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body ?? {}, OPTIONS);

    if (error) {
      return res.status(400).json({
        error: 'Données invalides',
        details: error.details.map((detail) => ({
          field: detail.path.join('.') || 'body',
          message: detail.message,
        })),
      });
    }

    req.body = value;
    next();
  };
}
