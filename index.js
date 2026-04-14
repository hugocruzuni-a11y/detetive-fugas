require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');

if (!process.env.STRIPE_SECRET_KEY || !process.env.GEMINI_API_KEY) {
    console.error("🚨 ALERTA: Chaves da API em falta (STRIPE_SECRET_KEY ou GEMINI_API_KEY).");
}

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const app = express();
app.use(cors());

// ==========================================
// 🛡️ WEBHOOK DO STRIPE (MUITO IMPORTANTE ESTAR AQUI)
// ==========================================
app.post('/api/webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET; 
        if(endpointSecret) {
            event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        } else {
            event = JSON.parse(req.body); 
        }
    } catch (err) {
        console.error(`❌ Erro no Webhook: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const emailCliente = session.customer_details.email;
        
        console.log(`💰 PAGAMENTO CONFIRMADO DE: ${emailCliente}`);
        
        // ENVIO DO E-MAIL AUTOMÁTICO
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
                        <h3>📄 Minuta de Lei Europeia (Direito ao Esquecimento e Cancelamento):</h3>
                        <div style="background:#f1f5f9; padding:20px; border-radius:10px; border-left: 4px solid #10b981; font-family: monospace;">
                            "Exmo(a) Senhor(a),<br><br>
                            Venho por este meio exercer o meu direito de cancelamento imediato do serviço associado a esta conta/cartão, bem como o direito ao apagamento dos meus dados pessoais nos termos do RGPD (Artigo 17.º).<br><br>
                            Exijo o cancelamento com efeitos imediatos e a confirmação por escrito no prazo máximo de 48 horas, sob pena de apresentar queixa-crime às entidades reguladoras (Banco de Portugal / ASAE).<br><br>
                            Com os melhores cumprimentos."
                        </div>
                        <br>
                        <p><strong>Ação imediata:</strong> Copia o texto acima e envia para o e-mail de suporte (ou formulário de contacto) de cada empresa listada no teu relatório.</p>
                        <p>Um abraço,<br><strong>Equipa Detetive de Fugas</strong></p>
                    </div>
                `
            });
            console.log("✅ E-mail enviado com sucesso!");
        } catch (erroEmail) {
            console.error("❌ Erro a enviar e-mail (Verifica as tuas credenciais Gmail):", erroEmail.message);
        }
    }

    res.json({received: true});
});

// ==========================================
// ROTAS NORMAIS DA APLICAÇÃO
// ==========================================
app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/auditoria.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'auditoria.html')));

const upload = multer({ storage: multer.memoryStorage() }); 

// ROTA DA IA 
app.post('/api/analisar-pdf', upload.single('extrato'), async (req, res) => {
    if (!req.file) return res.status(400).json({ erro: 'Nenhum ficheiro recebido.' });

    try {
        const documentoPDF = { inlineData: { data: req.file.buffer.toString("base64"), mimeType: "application/pdf" } };
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro", generationConfig: { temperature: 0 } });
        
        const prompt = `És um detetive financeiro robótico, exato e implacável. Analisa o documento PDF em anexo (extrato bancário).
        Foca-te EXCLUSIVAMENTE nestas 3 categorias: 1. Comissões bancárias, taxas. 2. Subscrições. 3. Seguros/Telecomunicações.
        Devolve APENAS um objeto JSON válido: {"total_desperdicado_mensal": 0, "total_desperdicado_anual": 0, "subscricoes_encontradas": [{"nome": "Nome", "valor_mensal": 0, "categoria": "Categoria", "nivel_alerta": "Vermelho/Laranja/Amarelo"}], "mensagem_impacto": "Uma frase agressiva sobre a perda de dinheiro."}`;

        const result = await model.generateContent([prompt, documentoPDF]);
        let respostaIA = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
        const jsonLimpo = respostaIA.substring(respostaIA.indexOf('{'), respostaIA.lastIndexOf('}') + 1);

        res.status(200).json({ sucesso: true, dados: JSON.parse(jsonLimpo) });
    } catch (error) {
        if (error.status === 429) return res.status(429).json({ sucesso: false, erro: 'Tráfego elevado. Aguarda 30 seg.' });
        res.status(500).json({ sucesso: false, erro: 'Falha na IA ao ler o PDF.' });
    }
});

// ROTA DO PAGAMENTO
app.post('/api/checkout', async (req, res) => {
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            customer_creation: 'always', // Obriga o Stripe a pedir o e-mail
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
        res.status(500).json({ erro: 'Erro a conectar ao banco.' });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Motor de IA e Vendas online na porta ${PORT}`));