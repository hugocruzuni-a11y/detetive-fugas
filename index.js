require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');

// --- VALIDAÇÃO DE SEGURANÇA ---
if (!process.env.STRIPE_SECRET_KEY || !process.env.GEMINI_API_KEY) {
    console.warn("⚠️ ALERTA: Faltam chaves de API (Stripe ou Gemini) nas variáveis de ambiente!");
}

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'chave_ausente');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'chave_ausente');

const app = express();
app.use(cors());

// =======================================================
// 🛡️ 1. ROTA DO WEBHOOK (Obrigatório estar antes do express.json)
// =======================================================
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET; 
        if (endpointSecret) {
            event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        } else {
            event = JSON.parse(req.body); // Fallback para desenvolvimento
        }
    } catch (err) {
        console.error(`❌ Erro no Webhook: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Se o cliente pagou com sucesso
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const emailCliente = session.customer_details.email;
        
        console.log(`💰 SUCESSO: Pagamento recebido de ${emailCliente}`);
        
        // Disparar o e-mail
        try {
            let transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER, 
                    pass: process.env.EMAIL_PASS  
                }
            });

            await transporter.sendMail({
                from: '"Detetive de Fugas" <noreply@detetivedefugas.pt>',
                to: emailCliente,
                subject: "🚨 O teu Relatório de Fugas e Minutas de Cancelamento",
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; color: #1e293b;">
                        <h2 style="color: #10b981;">Obrigado por confiares no Detetive de Fugas!</h2>
                        <p>O teu pagamento foi processado com sucesso. Como prometido, aqui estão as ferramentas legais para estancares a perda de dinheiro:</p>
                        <br>
                        <h3>📄 Minuta de Lei Europeia (Direito ao Cancelamento):</h3>
                        <div style="background:#f1f5f9; padding:20px; border-radius:10px; border-left: 4px solid #10b981; font-family: monospace;">
                            "Exmo(a) Senhor(a),<br><br>
                            Venho por este meio exercer o meu direito de cancelamento imediato do serviço associado a esta conta/cartão, bem como o direito ao apagamento dos meus dados pessoais nos termos do RGPD (Artigo 17.º).<br><br>
                            Exijo o cancelamento com efeitos imediatos e a confirmação por escrito no prazo máximo de 48 horas, sob pena de apresentar queixa-crime às entidades reguladoras.<br><br>
                            Com os melhores cumprimentos."
                        </div>
                        <br>
                        <p><strong>Ação imediata:</strong> Copia o texto acima e envia para o suporte de cada empresa listada na auditoria.</p>
                        <p>Um abraço,<br><strong>Equipa Detetive de Fugas</strong></p>
                    </div>
                `
            });
            console.log("✅ E-mail enviado com sucesso!");
        } catch (erroEmail) {
            console.error("❌ Falha a enviar e-mail:", erroEmail.message);
        }
    }
    res.json({ received: true });
});

// =======================================================
// 🌐 2. CONFIGURAÇÕES NORMAIS E FRONTEND
// =======================================================
app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/auditoria.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'auditoria.html')));

const upload = multer({ storage: multer.memoryStorage() }); 

// =======================================================
// 🧠 3. ROTA DA INTELIGÊNCIA ARTIFICIAL (GEMINI)
// =======================================================
app.post('/api/analisar-pdf', upload.single('extrato'), async (req, res) => {
    if (!req.file) return res.status(400).json({ erro: 'Nenhum ficheiro recebido.' });

    try {
        console.log("🕵️ A iniciar análise do documento...");
        const documentoPDF = { inlineData: { data: req.file.buffer.toString("base64"), mimeType: "application/pdf" } };
        
        // Uso garantido do modelo 1.5 Pro (mais estável)
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro", generationConfig: { temperature: 0 } });
        
        const prompt = `És um detetive financeiro robótico e implacável. Analisa o documento PDF em anexo. 
        Se for um extrato bancário, extrai taxas ocultas, subscrições e seguros. 
        Devolve APENAS e EXCLUSIVAMENTE um objeto JSON válido, sem crases markdown, com esta estrutura exata:
        {"total_desperdicado_mensal": 0, "total_desperdicado_anual": 0, "subscricoes_encontradas": [{"nome": "Empresa", "valor_mensal": 0, "categoria": "Tipo", "nivel_alerta": "Vermelho"}], "mensagem_impacto": "Uma frase forte de alerta."}
        Se o documento NÃO for um extrato (ex: talão/comprovativo), devolve o mesmo JSON com valores a 0. NUNCA respondas com texto normal.`;

        const result = await model.generateContent([prompt, documentoPDF]);
        let respostaIA = result.response.text();
        
        // Limpeza rigorosa do texto para garantir que é um JSON válido
        respostaIA = respostaIA.replace(/```json/gi, "").replace(/```/g, "").trim();
        const jsonLimpo = respostaIA.substring(respostaIA.indexOf('{'), respostaIA.lastIndexOf('}') + 1);

        console.log("✅ Análise concluída com sucesso.");
        res.status(200).json({ sucesso: true, dados: JSON.parse(jsonLimpo) });

    } catch (error) {
        console.error("❌ ERRO NO MOTOR IA:", error.message);
        if (error.status === 429 || String(error.message).includes('429')) {
            return res.status(429).json({ sucesso: false, erro: 'Tráfego elevado na IA. Aguarda 30 segundos.' });
        }
        res.status(500).json({ sucesso: false, erro: 'A IA não conseguiu ler o PDF. Garante que é um extrato válido.' });
    }
});

// =======================================================
// 💳 4. ROTA DE CHECKOUT (STRIPE)
// =======================================================
app.post('/api/checkout', async (req, res) => {
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            customer_creation: 'always', 
            line_items: [{
                price_data: { currency: 'eur', product_data: { name: 'Desbloqueio de Relatório e Minutas' }, unit_amount: 499 },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${req.protocol}://${req.get('host')}/sucesso.html`,
            cancel_url: `${req.protocol}://${req.get('host')}/auditoria.html`,
        });
        res.json({ url: session.url });
    } catch (error) {
        console.error("❌ Erro no Stripe:", error.message);
        res.status(500).json({ erro: 'Erro a conectar ao banco.' });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Motor Online a faturar na porta ${PORT}`));