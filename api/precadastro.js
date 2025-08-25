// api/precadastro.js
// Função serverless para Vercel (CommonJS)

const mongoose = require('mongoose');
const validator = require('validator');

/**
 * ===== Conexão MongoDB com cache (recomendado em serverless) =====
 */
let cached = global._mongooseCache;
if (!cached) {
  cached = global._mongooseCache = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) return cached.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI não configurada no ambiente.');
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, {
        // Ajustes seguros para serverless
        serverSelectionTimeoutMS: 10000,
        maxPoolSize: 5
      })
      .then((m) => m);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

/**
 * ===== Schema / Model =====
 */
const precadastroSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true, maxlength: 100 },

    profissao: {
      type: String,
      required: true,
      enum: [
        'arquiteto',
        'engenheiro',
        'prestador',
        'fornecedor',
        'construtor',
        'designer',
        'outro'
      ]
    },

    especialidades: {
      type: [String],
      default: [],
      validate: {
        validator: function (especialidades) {
          // Regras específicas por profissão
          if (this.profissao === 'prestador') {
            const validasPrestador = [
              'pedreiro',
              'eletricista',
              'encanador',
              'gesseiro',
              'pintor',
              'instalador-pisos'
            ];
            return especialidades.every((esp) => validasPrestador.includes(esp));
          }
          if (this.profissao === 'engenheiro') {
            const validasEngenheiro = [
              'projetista',
              'gerenciamento-obras',
              'orcamentista'
            ];
            return (
              Array.isArray(especialidades) &&
              especialidades.length === 1 &&
              validasEngenheiro.includes(especialidades[0])
            );
          }
          return true;
        },
        message: 'Especialidades inválidas para a profissão selecionada.'
      }
    },

    empresa: { type: String, trim: true, maxlength: 100, default: '' },

    telefone: { type: String, required: true, trim: true },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      validate: [validator.isEmail, 'Email inválido']
    },

    cidade: { type: String, required: true, trim: true, maxlength: 100 },

    dataRegistro: { type: Date, default: Date.now },

    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' }
  },
  { timestamps: true }
);

// índices
precadastroSchema.index({ email: 1 }, { unique: true });

// evita OverwriteModelError em hot-reloads
const Precadastro =
  mongoose.models.Precadastro || mongoose.model('Precadastro', precadastroSchema);

/**
 * ===== Handler principal =====
 */
module.exports = async function handler(req, res) {
  // CORS básico
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Pré-vôo
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Conectar ao banco (com cache)
    await connectDB();

    // Body
    let {
      nome,
      profissao,
      especialidades,
      empresa,
      telefone,
      email,
      cidade
    } = req.body || {};

    // Sanitização
    nome = (nome || '').toString().trim();
    profissao = (profissao || '').toString().trim();
    empresa = (empresa || '').toString().trim();
    telefone = (telefone || '').toString().trim();
    email = (email || '').toString().trim().toLowerCase();
    cidade = (cidade || '').toString().trim();

    // Normaliza especialidades
    const normalizeEspecialidades = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val.map((s) => String(s).trim()).filter(Boolean);
      if (typeof val === 'string')
        return val
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      return [];
    };
    const especialidadesArr = normalizeEspecialidades(especialidades);

    // Validações
    if (!nome || !profissao || !telefone || !email || !cidade) {
      return res
        .status(400)
        .json({ error: 'Todos os campos obrigatórios devem ser preenchidos.' });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: 'Email inválido.' });
    }

    const telDigits = telefone.replace(/\D/g, '');
    if (telDigits.length < 10 || telDigits.length > 11) {
      return res.status(400).json({ error: 'Telefone inválido.' });
    }

    if (profissao === 'prestador' && especialidadesArr.length === 0) {
      return res
        .status(400)
        .json({ error: 'Prestadores devem selecionar pelo menos uma especialidade.' });
    }

    if (profissao === 'engenheiro' && especialidadesArr.length === 0) {
      return res
        .status(400)
        .json({ error: 'Engenheiros devem selecionar uma especialidade.' });
    }

    // Duplicidade por email
    const jaExiste = await Precadastro.findOne({ email }).lean();
    if (jaExiste) {
      return res.status(409).json({ error: 'Este email já está cadastrado.' });
    }

    // Metadados cliente
    const clientIP =
      req.headers['x-forwarded-for'] ||
      req.headers['x-real-ip'] ||
      req.connection?.remoteAddress ||
      'unknown';

    const userAgent = req.headers['user-agent'] || 'unknown';

    // Cria documento
    const doc = await Precadastro.create({
      nome,
      profissao,
      especialidades: especialidadesArr,
      empresa,
      telefone,
      email,
      cidade,
      ip: Array.isArray(clientIP) ? clientIP[0] : String(clientIP),
      userAgent
    });

    // Log simples
    const especTxt = especialidadesArr.length
      ? ` (${especialidadesArr.join(', ')})`
      : '';
    console.log(`✅ Novo pré-cadastro: ${nome} <${email}> - ${profissao}${especTxt}`);

    return res.status(201).json({
      success: true,
      message: 'Pré-cadastro realizado com sucesso!',
      data: {
        id: doc._id,
        nome: doc.nome,
        email: doc.email,
        profissao: doc.profissao,
        especialidades: doc.especialidades,
        dataRegistro: doc.dataRegistro
      }
    });
  } catch (err) {
    console.error('❌ Erro no pré-cadastro:', err);

    if (err && err.code === 11000) {
      return res.status(409).json({ error: 'Este email já está cadastrado.' });
    }
    if (err && err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    if (String(err.message || '').includes('MONGODB_URI')) {
      return res.status(500).json({ error: 'Variável MONGODB_URI não configurada.' });
    }

    return res
      .status(500)
      .json({ error: 'Erro interno do servidor. Tente novamente.' });
  }
};
