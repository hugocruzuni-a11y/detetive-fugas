require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const multer = require('multer');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const upload = multer({ storage: multer.memoryStorage() });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/analisar-pdf', upload.single('extrato'), async (req, res) => {
    console.log("\n-----------------------------------------");
    console.log("🕵️ INÍCIO DA INVESTIGAÇÃO DIRETA COM A IA...");
    
    if (!req.file) {
        console.log("❌ FALHA: Nenhum ficheiro recebido.");
        return res.status(400).json({ erro: 'Nenhum ficheiro.' });
    }
    console.log("✅ PASSO 1: Ficheiro recebido ->", req.file.originalname);

    try {
        console.log("⏳ PASSO 2: A converter o PDF para a linguagem da IA (Base64)...");
        
        // Magia Negra: Converter o ficheiro diretamente para um formato que a Google engole nativamente
        const documentoPDF = {
            inlineData: {
                data: req.file.buffer.toString("base64"),
                mimeType: "application/pdf"
            }
        };

        console.log("⏳ PASSO 3: A enviar o PDF diretamente para o cérebro da Google...");
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // Usamos o motor mais recente

        const prompt = `
        És um detetive financeiro implacável. Analisa o documento PDF em anexo (é um extrato bancário).
        Ignora compras de supermercado, restaurantes ou lojas normais.
        Foca-te APENAS em:
        1. Subscrições (Netflix, Spotify, Ginásios, Apps).
        2. Seguros e Telecomunicações.
        3. Comissões bancárias.

        Devolve APENAS um objeto JSON válido e rigoroso com esta estrutura exata (sem formatação markdown, sem blocos de código):
        {
            "total_desperdicado_mensal": 0,
            "total_desperdicado_anual": 0,
            "subscricoes_encontradas": [
                {
                    "nome": "Nome do Serviço",
                    "valor_mensal": 0,
                    "categoria": "Streaming | Ginásio | Taxa | Outro",
                    "nivel_alerta": "Alto | Médio | Baixo" 
                }
            ],
            "mensagem_impacto": "Mensagem agressiva curta."
        }
        `;

        // Aqui enviamos o Texto (prompt) E o Documento (documentoPDF) ao mesmo tempo!
        const result = await model.generateContent([prompt, documentoPDF]);

        console.log("✅ PASSO 4: A IA leu o PDF e devolveu a resposta!");
        
        // Limpar qualquer formatação markdown que a IA tente adicionar por engano
        let respostaIA = result.response.text();
        respostaIA = respostaIA.replace(/```json/g, "").replace(/```/g, "").trim();
        
        const dadosJSON = JSON.parse(respostaIA);

        console.log("✅ PASSO 5: Sucesso total! A enviar para o site.");
        res.status(200).json({ sucesso: true, dados: dadosJSON });

    } catch (error) {
        console.error("\n🚨 ALARME: O MOTOR REBENTOU AQUI 🚨");
        console.error(error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao processar o extrato com a IA.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Motor VISUAL do Detetive de Fugas a correr na porta ${PORT}`);
});