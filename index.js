require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const multer = require('multer');

// --- 🛡️ SISTEMA DE AUTO-DIAGNÓSTICO 2050 ---
if (!process.env.STRIPE_SECRET_KEY || !process.env.GEMINI_API_KEY) {
    console.error("🚨 ALERTA VERMELHO: Chaves da API em falta!");
    console.error("Verifica se o 'STRIPE_SECRET_KEY' e o 'GEMINI_API_KEY' estão nas Environment Variables do Render.");
}

// --- LIGAÇÕES CENTRAIS ---
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const app = express();
app.use(cors());
app.use(express.json());
// Diz ao Express para servir a pasta 'public' onde está o teu site
app.use(express.static('public'));

const upload = multer({ storage: multer.memoryStorage() }); 

// --- ROTA 1: A IA QUE DETETA AS FUGAS ---
app.post('/api/analisar-pdf', upload.single('extrato'), async (req, res) => {
    console.log("\n-----------------------------------------");
    console.log("🕵️ INÍCIO DA INVESTIGAÇÃO IA...");
    
    if (!req.file) {
        return res.status(400).json({ erro: 'Nenhum ficheiro recebido.' });
    }

    try {
        console.log(`✅ Ficheiro recebido: ${req.file.originalname} (Tamanho: ${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);
        
        const documentoPDF = {
            inlineData: {
                data: req.file.buffer.toString("base64"),
                mimeType: "application/pdf"
            }
        };
        
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-pro",
            generationConfig: { temperature: 0, topP: 1, topK: 1 }
        });
        
        const prompt = `
        És um detetive financeiro robótico, exato e implacável. Analisa o documento PDF em anexo (extrato bancário).
        A TUA MISSÃO É EXTRAIR ABSOLUTAMENTE TODAS AS DESPESAS que se enquadrem nas categorias abaixo. NÃO podes resumir. NÃO podes deixar nenhuma de fora.
        
        Ignora compras de supermercado, restaurantes, farmácias ou lojas normais.
        Foca-te EXCLUSIVAMENTE nestas 3 categorias:
        1. Comissões bancárias, taxas de conta, anuidades de cartões, juros -> nivel_alerta: "Vermelho"
        2. Subscrições (Netflix, Spotify, Apple, Ginásios, Software, Apps) -> nivel_alerta: "Laranja"
        3. Seguros (vida, automóvel) e Telecomunicações (MEO, NOS, Vodafone) -> nivel_alerta: "Amarelo"

        Devolve APENAS um objeto JSON válido, sem texto adicional:
        {
            "total_desperdicado_mensal": 0,
            "total_desperdicado_anual": 0,
            "subscricoes_encontradas": [
                {
                    "nome": "Nome da Empresa Exato",
                    "valor_mensal": 0,
                    "categoria": "Categoria",
                    "nivel_alerta": "Vermelho/Laranja/Amarelo" 
                }
            ],
            "mensagem_impacto": "Uma frase curta e muito agressiva sobre como o banco/empresas estão a roubar este dinheiro sem o cliente notar."
        }
        `;

        console.log(`⏳ A analisar o extrato com Gemini 2.5 Pro...`);
        
        let tentativas = 0;
        let maxTentativas = 3;
        let result = null;

        while (tentativas < maxTentativas) {
            try {
                result = await model.generateContent([prompt, documentoPDF]);
                break;
            } catch (erroIA) {
                tentativas++;
                console.log(`⚠️ Tentativa ${tentativas} falhou. A tentar novamente...`);
                if (tentativas >= maxTentativas) throw erroIA;
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }

        console.log("✅ IA processou os dados com sucesso!");
        
        let respostaIA = result.response.text();
        respostaIA = respostaIA.replace(/```json/g, "").replace(/```/g, "").trim();
        const jsonLimpo = respostaIA.substring(respostaIA.indexOf('{'), respostaIA.lastIndexOf('}') + 1);

        res.status(200).json({ sucesso: true, dados: JSON.parse(jsonLimpo) });

    } catch (error) {
        console.error("❌ ERRO NO MOTOR IA:", error.message || error);
        if (error.status === 429 || (error.message && error.message.includes('429'))) {
            return res.status(429).json({ sucesso: false, erro: 'Tráfego elevado. Aguarda 30 segundos e tenta de novo.' });
        }
        res.status(500).json({ sucesso: false, erro: 'Falha na leitura do PDF. Garante que é um extrato válido.' });
    }
});

// --- ROTA 2: A CAIXA REGISTADORA (STRIPE) ---
app.post('/api/checkout', async (req, res) => {
    try {
        console.log("💳 A gerar link de pagamento super-seguro no Stripe...");
        
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: 'Desbloqueio do Relatório de Fugas',
                            description: 'Acesso total a todas as subscrições ocultas e minutas de cancelamento legais.',
                        },
                        unit_amount: 499, // 4,99€
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            // O código abaixo deteta se estás no localhost ou no domínio real do Render
            success_url: `${req.protocol}://${req.get('host')}/sucesso.html`,
            cancel_url: `${req.protocol}://${req.get('host')}/`,
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error("❌ Erro no Stripe:", error.message);
        res.status(500).json({ erro: 'O banco rejeitou a criação da sessão de pagamento.' });
    }
});

// --- ARRANCAR O SERVIDOR ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`\n🚀 ==========================================`);
    console.log(`🚀 SUCESSO: Detetive Online na porta ${PORT}`);
    console.log(`🚀 ==========================================\n`);
});