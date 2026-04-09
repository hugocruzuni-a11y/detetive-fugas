require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Diz ao motor para mostrar a nossa página web

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/analisar-extrato', async (req, res) => {
    const textoExtrato = req.body.texto;

    if (!textoExtrato) {
        return res.status(400).json({ erro: 'Por favor, envia o texto do extrato.' });
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
        És um detetive financeiro implacável. Analisa este extrato.
        Ignora compras de supermercado, restaurantes ou lojas normais.
        Foca-te APENAS em:
        1. Subscrições (Netflix, Spotify, Ginásios, Apps).
        2. Seguros e Telecomunicações.
        3. Comissões bancárias.

        Devolve APENAS um objeto JSON com esta estrutura (sem formatação markdown à volta):
        {
            "total_desperdicado_mensal": (numero),
            "total_desperdicado_anual": (numero),
            "subscricoes_encontradas": [
                {
                    "nome": "Nome do Serviço",
                    "valor_mensal": (numero),
                    "categoria": "Streaming | Ginásio | Taxa | Outro",
                    "nivel_alerta": "Alto | Médio | Baixo" 
                }
            ],
            "mensagem_impacto": "Frase curta e agressiva sobre o dinheiro perdido por ano."
        }

        Texto do Extrato:
        ${textoExtrato}
        `;

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
        });

        const respostaIA = result.response.text();
        const dadosJSON = JSON.parse(respostaIA);

        res.status(200).json({ sucesso: true, dados: dadosJSON });

    } catch (error) {
        console.error("Erro na análise:", error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao processar o extrato com a IA.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Motor do Detetive de Fugas a correr na porta ${PORT}`);
});