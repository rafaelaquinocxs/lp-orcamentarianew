const { MongoClient } = require('mongodb');

let cachedClient = null;

async function connectToDatabase() {
  if (cachedClient) {
    return cachedClient;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI não configurada');
  }

  try {
    const client = new MongoClient(uri);
    await client.connect();
    cachedClient = client;
    return client;
  } catch (error) {
    console.error('Erro MongoDB:', error);
    throw error;
  }
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { nome, profissao, especialidades, empresa, telefone, email, cidade } = req.body;

    // Validações básicas
    if (!nome || !profissao || !telefone || !email || !cidade) {
      return res.status(400).json({ error: 'Campos obrigatórios não preenchidos' });
    }

    // Conectar ao MongoDB
    const client = await connectToDatabase();
    const db = client.db('orcamentaria');
    const collection = db.collection('precadastros');

    // Verificar se email já existe
    const emailExiste = await collection.findOne({ email });
    if (emailExiste) {
      return res.status(409).json({ error: 'Email já cadastrado' });
    }

    // Salvar cadastro
    const cadastro = {
      nome: nome.trim(),
      profissao,
      especialidades: especialidades || [],
      empresa: empresa ? empresa.trim() : '',
      telefone: telefone.trim(),
      email: email.trim().toLowerCase(),
      cidade: cidade.trim(),
      dataRegistro: new Date(),
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress
    };

    const result = await collection.insertOne(cadastro);

    console.log(`✅ Novo cadastro: ${nome} <${email}> - ${profissao}`);

    return res.status(201).json({
      success: true,
      message: 'Cadastro realizado com sucesso!',
      id: result.insertedId
    });

  } catch (error) {
    console.error('Erro no cadastro:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

