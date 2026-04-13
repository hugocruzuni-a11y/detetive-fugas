require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const multer = require('multer');

// --- LIGAÇÃO AO STRIPE ---
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); 

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const upload = multer({ storage: multer.memoryStorage() }); 
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- ROTA 1: A IA QUE DETETA AS FUGAS ---
app.post('/api/analisar-pdf', upload.single('extrato'), async (req, res) => {
    console.log("\n-----------------------------------------");
    console.log("🕵️ INÍCIO DA INVESTIGAÇÃO 2050...");
    
    if (!req.file) {
        return res.status(400).json({ erro: 'Nenhum ficheiro recebido.' });
    }

    try {
        console.log(`✅ Ficheiro: ${req.file.originalname} (Tamanho: ${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);
        
        const documentoPDF = {
            inlineData: {
                data: req.file.buffer.toString("base64"),
                mimeType: "application/pdf"
            }
        };
        
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-pro",
            generationConfig: {
                temperature: 0, 
                topP: 1,
                topK: 1
            }
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

        console.log(`⏳ A injetar os dados no modelo [gemini-2.5-pro]...`);
        
        let tentativas = 0;
        let maxTentativas = 6;
        let result = null;

        while (tentativas < maxTentativas) {
            try {
                if (tentativas > 0) {
                    console.log(`🔄 [Tentativa ${tentativas + 1}/${maxTentativas}] A tentar furar o trânsito da Google...`);
                }
                
                result = await model.generateContent([prompt, documentoPDF]);
                break;
                
            } catch (erroIA) {
                tentativas++;
                
                if (erroIA.status === 503 || erroIA.status === 429 || (erroIA.message && (erroIA.message.includes('503') || erroIA.message.includes('429')))) {
                    console.log(`⚠️ Servidores da Google lotados. A aguardar 10 segundos em silêncio... 🤫`);
                    
                    if (tentativas >= maxTentativas) {
                        throw new Error("A Google está completamente esgotada neste momento.");
                    }
                    await new Promise(resolve => setTimeout(resolve, 10000));
                } else {
                    throw erroIA;
                }
            }
        }

        console.log("✅ A IA processou os dados com sucesso!");
        
        let respostaIA = result.response.text();
        respostaIA = respostaIA.replace(/```json/g, "").replace(/```/g, "").trim();
        const inicioJSON = respostaIA.indexOf('{');
        const fimJSON = respostaIA.lastIndexOf('}') + 1;
        const jsonLimpo = respostaIA.substring(inicioJSON, fimJSON);

        const dadosJSON = JSON.parse(jsonLimpo);

        res.status(200).json({ sucesso: true, dados: dadosJSON });

    } catch (error) {
        console.error("\n🚨 ALARME DO SISTEMA 🚨");
        
        if (error.status === 429 || (error.message && error.message.includes('429'))) {
            console.error("❌ ERRO 429: Limite de velocidade atingido.");
            return res.status(429).json({ 
                sucesso: false, 
                erro: '⚠️ Atingimos o limite da Google. Por favor, aguarda 60 segundos e tenta novamente.' 
            });
        }

        console.error(error.message || error);
        res.status(500).json({ sucesso: false, erro: 'Ups! A IA teve um soluço. Verifica o teu PDF.' });
    }
});

// --- ROTA 2: A CAIXA REGISTADORA (STRIPE) ---
app.post('/api/checkout', async (req, res) => {
    try {
        console.log("💳 A gerar link de pagamento no Stripe...");
        
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: 'Desbloqueio do Relatório de Fugas',
                            description: 'Acesso total a todas as subscrições ocultas e minutas de cancelamento.',
                        },
                        unit_amount: 499, // Valor em cêntimos (4,99€)
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            // URLs de retorno dinâmicas (funciona no Localhost e no Render)
            success_url: `${req.protocol}://${req.get('host')}/sucesso.html`,
            cancel_url: `${req.protocol}://${req.get('host')}/`,
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error("Erro no Stripe:", error.message);
        res.status(500).json({ erro: 'Erro a criar pagamento.' });
    }
});

// --- PORTA DINÂMICA (CRÍTICO PARA O RENDER) ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Motor 2050 a faturar na porta ${PORT}`);
});