require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');

if (!process.env.STRIPE_SECRET_KEY || !process.env.GEMINI_API_KEY) {
    console.error("🚨 ALERTA VERMELHO: Chaves da API em falta!");
}

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const app = express();
app.use(cors());

// ==========================================
// 🛡️ O WEBHOOK DO STRIPE (TEM DE FICAR AQUI, ANTES DO JSON)
// ==========================================
app.post('/api/webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        // Substitui isto pela tua chave de webhook do Render/Stripe mais tarde
        const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET; 
        if(endpointSecret) {
            event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        } else {
            event = JSON.parse(req.body); // Fallback para testes sem assinatura
        }
    } catch (err) {
        console.error(`❌ Erro no Webhook: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Se o pagamento foi concluído com sucesso
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const emailCliente = session.customer_details.email;
        
        console.log(`💰 PAGAMENTO RECEBIDO DE: ${emailCliente}`);
        
        // 📧 ENVIO DE E-MAIL AUTOMÁTICO
        try {
            // Configuração do e-mail (Usa o teu Gmail e uma App Password)
            let transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER, // Teu e-mail (ex: detetivedefugas@gmail.com)
                    pass: process.env.EMAIL_PASS  // Password de Aplicação do Google
                }
            });

            await transporter.sendMail({
                from: '"Detetive de Fugas" <teu-email@gmail.com>',
                to: emailCliente,
                subject: "🚨 O teu Relatório de Fugas e Minutas de Cancelamento",
                html: `
                    <h2>Obrigado por confiares no Detetive de Fugas!</h2>
                    <p>O teu pagamento foi confirmado. Como prometido, aqui está o material para estancares a perda de dinheiro:</p>
                    <br>
                    <h3>📄 Minuta de Lei Europeia (Direito ao Esquecimento e Cancelamento):</h3>
                    <div style="background:#f1f5f9; padding:15px; border-radius:10px; font-family:monospace;">
                        "Exmo(a) Senhor(a),<br><br>
                        Venho por este meio exercer o meu direito de cancelamento imediato do serviço associado a esta conta, bem como o direito ao apagamento dos meus dados pessoais (RGPD - Artigo 17.º).<br><br>
                        Exijo o cancelamento com efeitos imediatos e a confirmação por escrito no prazo de 48 horas, sob pena de queixa às entidades reguladoras.<br><br>
                        Com os melhores cumprimentos."
                    </div>
                    <br>
                    <p><strong>Dica:</strong> Copia o texto acima e envia para o e-mail de suporte de cada empresa que a IA detetou no teu relatório.</p>
                    <p>Um abraço,<br>Equipa Detetive de Fugas</p>
                `
            });
            console.log("✅ E-mail enviado com sucesso!");
        } catch (erroEmail) {
            console.error("❌ Erro a enviar e-mail:", erroEmail);
        }
    }

    res.json({received: true});
});

// ==========================================
// ROTAS NORMAIS (APÓS O WEBHOOK)
// ==========================================
app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/auditoria.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'auditoria.html')));

const upload = multer({ storage: multer.memoryStorage() }); 

// ROTA DA IA (O código que já tens funciona perfeito aqui)
app.post('/api/analisar-pdf', upload.single('extrato'), async (req, res) => {
    if (!req.file) return res.status(400).json({ erro: 'Nenhum ficheiro recebido.' });

    try {
        const documentoPDF = { inlineData: { data: req.file.buffer.toString("base64"), mimeType: "application/pdf" } };
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro", generationConfig: { temperature: 0 } });
        
        const prompt = `Analisa o extrato PDF em anexo. Devolve APENAS um objeto JSON válido... (Ignora supermercados, foca em comissões, subscrições e seguros. O JSON deve ter: total_desperdicado_mensal, total_desperdicado_anual, subscricoes_encontradas (array de objetos com nome, valor_mensal, categoria, nivel_alerta), mensagem_impacto).`;

        const result = await model.generateContent([prompt, documentoPDF]);
        let respostaIA = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
        const jsonLimpo = respostaIA.substring(respostaIA.indexOf('{'), respostaIA.lastIndexOf('}') + 1);

        res.status(200).json({ sucesso: true, dados: JSON.parse(jsonLimpo) });
    } catch (error) {
        if (error.status === 429) return res.status(429).json({ sucesso: false, erro: 'Tráfego elevado. Aguarda 30 seg.' });
        res.status(500).json({ sucesso: false, erro: 'Falha na IA.' });
    }
});

app.post('/api/checkout', async (req, res) => {
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            // Pede o e-mail ao cliente obrigatoriamente
            customer_creation: 'always', 
            line_items: [{
                price_data: { currency: 'eur', product_data: { name: 'Desbloqueio do Relatório e Minutas' }, unit_amount: 499 },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${req.protocol}://${req.get('host')}/sucesso.html`,
            cancel_url: `${req.protocol}://${req.get('host')}/auditoria.html`,
        });
        res.json({ url: session.url });
    } catch (error) {
        res.status(500).json({ erro: 'Erro no Stripe.' });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Motor de Vendas e E-mail a faturar na porta ${PORT}`));