const mongoose = require('mongoose');

// Cache da conexão para reutilizar em chamadas subsequentes
let cachedConnection = null;

async function connectToDatabase() {
  if (cachedConnection) {
    return cachedConnection;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI não configurada');
  }

  try {
    const connection = await mongoose.connect(uri);
    cachedConnection = connection;
    return connection;
  } catch (error) {
    console.error('Erro ao conectar MongoDB:', error);
    throw error;
  }
}

// Schema do precadastro
const precadastroSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true },
  profissao: { type: String, required: true },
  especialidades: [String],
  empresa: { type: String, default: '' },
  telefone: { type: String, required: true },
  email: { type: String, required: true, lowercase: true },
  cidade: { type: String, required: true },
  dataRegistro: { type: Date, default: Date.now }
}, { timestamps: true });

// Evitar erro de modelo já registrado
const Precadastro = mongoose.models.Precadastro || mongoose.model('Precadastro', precadastroSchema);

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas POST permitido
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Conectar ao banco
    await connectToDatabase();

    const { nome, profissao, especialidades, empresa, telefone, email, cidade } = req.body;

    // Validações básicas
    if (!nome || !profissao || !telefone || !email || !cidade) {
      return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos' });
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    // Validar especialidades para engenheiro e prestador
    if (profissao === 'engenheiro' && (!especialidades || especialidades.length === 0)) {
      return res.status(400).json({ error: 'Engenheiros devem selecionar uma especialidade' });
    }

    if (profissao === 'prestador' && (!especialidades || especialidades.length === 0)) {
      return res.status(400).json({ error: 'Prestadores devem selecionar pelo menos uma especialidade' });
    }

    // Verificar se email já existe
    const emailExistente = await Precadastro.findOne({ email });
    if (emailExistente) {
      return res.status(409).json({ error: 'Este email já está cadastrado' });
    }

    // Criar novo precadastro
    const novoPrecadastro = new Precadastro({
      nome: nome.trim(),
      profissao,
      especialidades: especialidades || [],
      empresa: empresa ? empresa.trim() : '',
      telefone: telefone.trim(),
      email: email.trim().toLowerCase(),
      cidade: cidade.trim()
    });

    await novoPrecadastro.save();

    console.log(`✅ Novo pré-cadastro: ${nome} <${email}> - ${profissao}`);

    return res.status(201).json({
      success: true,
      message: 'Pré-cadastro realizado com sucesso!',
      data: {
        id: novoPrecadastro._id,
        nome: novoPrecadastro.nome,
        email: novoPrecadastro.email,
        profissao: novoPrecadastro.profissao
      }
    });

  } catch (error) {
    console.error('Erro no pré-cadastro:', error);

    if (error.code === 11000) {
      return res.status(409).json({ error: 'Este email já está cadastrado' });
    }

    return res.status(500).json({ error: 'Erro interno do servidor. Tente novamente.' });
  }
}

