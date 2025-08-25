// api/precadastro.js - Função serverless para Vercel
const mongoose = require('mongoose');
const validator = require('validator');

// Configuração do MongoDB
const connectDB = async () => {
  if (mongoose.connections[0].readyState) {
    return;
  }
  
  const mongoURI = process.env.MONGODB_URI;
  if (!mongoURI) {
    throw new Error('MONGODB_URI não configurada');
  }
  
  await mongoose.connect(mongoURI);
};

// Schema do Precadastro
const precadastroSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true, maxlength: 100 },
  profissao: {
    type: String,
    required: true,
    enum: ['arquiteto', 'engenheiro', 'prestador', 'fornecedor', 'construtor', 'designer', 'outro']
  },
  especialidades: {
    type: [String],
    default: [],
    validate: {
      validator: function (especialidades) {
        if (this.profissao === 'prestador') {
          const validasPrestador = ['pedreiro', 'eletricista', 'encanador', 'gesseiro', 'pintor', 'instalador-pisos'];
          return especialidades.every(esp => validasPrestador.includes(esp));
        } else if (this.profissao === 'engenheiro') {
          const validasEngenheiro = ['projetista', 'gerenciamento-obras', 'orcamentista'];
          return especialidades.length === 1 && validasEngenheiro.includes(especialidades[0]);
        }
        return true;
      },
      message: 'Especialidades inválidas para a profissão selecionada'
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
}, { timestamps: true });

// Índices
precadastroSchema.index({ email: 1 }, { unique: true });

const Precadastro = mongoose.models.Precadastro || mongoose.model('Precadastro', precadastroSchema);

// Função principal da API
export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Apenas POST é permitido
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }
  
  try {
    // Conectar ao MongoDB
    await connectDB();
    
    let { nome, profissao, especialidades, empresa, telefone, email, cidade } = req.body || {};
    
    // Sanitização básica
    nome = (nome || '').toString().trim();
    profissao = (profissao || '').toString().trim();
    empresa = (empresa || '').toString().trim();
    telefone = (telefone || '').toString().trim();
    email = (email || '').toString().trim().toLowerCase();
    cidade = (cidade || '').toString().trim();
    
    // Normalizar especialidades
    const normalizeEspecialidades = (especialidades) => {
      if (!especialidades) return [];
      if (Array.isArray(especialidades)) return especialidades.map(s => String(s).trim()).filter(Boolean);
      if (typeof especialidades === 'string') {
        return especialidades.split(',').map(s => s.trim()).filter(Boolean);
      }
      return [];
    };
    
    const especialidadesArray = normalizeEspecialidades(especialidades);
    
    // Validações
    if (!nome || !profissao || !telefone || !email || !cidade) {
      return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos' });
    }
    
    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }
    
    const telefoneClean = telefone.replace(/\D/g, '');
    if (telefoneClean.length < 10 || telefoneClean.length > 11) {
      return res.status(400).json({ error: 'Telefone inválido' });
    }
    
    if (profissao === 'prestador' && especialidadesArray.length === 0) {
      return res.status(400).json({ error: 'Prestadores devem selecionar pelo menos uma especialidade' });
    }
    
    if (profissao === 'engenheiro' && especialidadesArray.length === 0) {
      return res.status(400).json({ error: 'Engenheiros devem selecionar uma especialidade' });
    }
    
    // Checagem de duplicidade
    const emailExistente = await Precadastro.findOne({ email });
    if (emailExistente) {
      return res.status(409).json({ error: 'Este email já está cadastrado' });
    }
    
    // Capturar informações do cliente
    const clientIP = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.connection?.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    // Persistência
    const novoPrecadastro = await Precadastro.create({
      nome,
      profissao,
      especialidades: especialidadesArray,
      empresa,
      telefone,
      email,
      cidade,
      ip: clientIP,
      userAgent: userAgent
    });
    
    const especTxt = especialidadesArray.length ? ` (${especialidadesArray.join(', ')})` : '';
    console.log(`✅ Novo pré-cadastro: ${nome} <${email}> - ${profissao}${especTxt}`);
    
    return res.status(201).json({
      success: true,
      message: 'Pré-cadastro realizado com sucesso!',
      data: {
        id: novoPrecadastro._id,
        nome: novoPrecadastro.nome,
        email: novoPrecadastro.email,
        profissao: novoPrecadastro.profissao,
        especialidades: novoPrecadastro.especialidades,
        dataRegistro: novoPrecadastro.dataRegistro
      }
    });
    
  } catch (error) {
    console.error('❌ Erro no pré-cadastro:', error);
    
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'Este email já está cadastrado' });
    }
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Erro interno do servidor. Tente novamente.' });
  }
}

