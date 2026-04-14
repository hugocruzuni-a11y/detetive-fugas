require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');

// --- SISTEMA DE SEGURANÇA E AUTO-DIAGNÓSTICO ---
if (!process.env.STRIPE_SECRET_KEY || !process.env.GEMINI_API_KEY) {
    console.warn("⚠️ ALERTA CRÍTICO: Faltam chaves de API nas variáveis de ambiente!");
}

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'chave_ausente');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'chave_ausente');

const app = express();
app.use(cors());

// =======================================================
// 📊 BASE DE DADOS EM MEMÓRIA (O Seed de Lançamento)
// =======================================================
let motorStats = {
    utilizadoresAtivos: 12804,
    totalResgatado: 24326,
    somaPrejuizos: 5275248, // Para calcular a média real
    auditoriasRealizadas: 12804
};

// Rota que o site chama para mostrar os valores atualizados
app.get('/api/stats', (req, res) => {
    let prejuizoMedio = motorStats.auditoriasRealizadas > 0 
        ? Math.floor(motorStats.somaPrejuizos / motorStats.auditoriasRealizadas) 
        : 412;

    res.json({
        resgatado: motorStats.totalResgatado,
        utilizadores: motorStats.utilizadoresAtivos,
        media: prejuizoMedio
    });
});

// =======================================================
// 🛡️ 1. ROTA DO WEBHOOK (SISTEMA DE ENTREGA AUTOMÁTICA)
// =======================================================
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET; 
        if (endpointSecret) {
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
        
        console.log(`💰 Faturação: Pagamento de 4,99€ recebido de ${emailCliente}`);
        
        try {
            let transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
            });

            await transporter.sendMail({
                from: '"Detetive de Fugas" <noreply@detetivedefugas.pt>',
                to: emailCliente,
                subject: "✅ Acesso Desbloqueado: O teu Relatório Forense e Minutas",
                html: `
                    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                        <div style="background-color: #0f172a; padding: 30px; text-align: center;">
                            <h1 style="color: #10b981; margin: 0; font-size: 24px; letter-spacing: -0.5px;">Detetive de Fugas</h1>
                            <p style="color: #94a3b8; margin-top: 5px; font-size: 14px;">Auditoria Neural Concluída</p>
                        </div>
                        <div style="padding: 40px 30px;">
                            <h2 style="color: #1e293b; margin-top: 0;">Obrigado pela tua confiança!</h2>
                            <p style="color: #475569; line-height: 1.6; font-size: 15px;">O teu pagamento foi processado com sucesso. Como prometido, entregamos-te a ferramenta legal para estancares imediatamente as fugas de capital detetadas no teu extrato.</p>
                            
                            <h3 style="color: #0f172a; margin-top: 30px; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px;">📄 Minuta Legal (RGPD & Defesa do Consumidor)</h3>
                            <div style="background-color: #f8fafc; padding: 20px; border-radius: 12px; border-left: 4px solid #10b981; font-family: monospace; color: #334155; font-size: 13px; line-height: 1.5;">
                                "Exmo(a) Senhor(a),<br><br>
                                Venho por este meio exercer o meu direito de cancelamento imediato e irrevogável de qualquer serviço ou subscrição associada a esta conta/cartão.<br><br>
                                Exerço ainda o meu direito ao apagamento dos meus dados pessoais nos termos do Regulamento Geral sobre a Proteção de Dados (RGPD - Artigo 17.º).<br><br>
                                Exijo que o cancelamento produza efeitos imediatos e solicito confirmação por escrito no prazo máximo de 48 horas. A ausência de resposta resultará em queixa formal ao Banco de Portugal e à Direção-Geral do Consumidor por práticas abusivas.<br><br>
                                Com os melhores cumprimentos."
                            </div>
                            
                            <div style="margin-top: 30px; background-color: #ecfdf5; padding: 15px; border-radius: 8px;">
                                <p style="color: #047857; margin: 0; font-size: 14px; font-weight: bold;">⚠️ Próximo Passo:</p>
                                <p style="color: #065f46; margin: 5px 0 0 0; font-size: 13px;">Copia o texto da minuta e envia diretamente para o e-mail de apoio ao cliente ou através do formulário de contacto de cada entidade identificada na tua auditoria.</p>
                            </div>
                        </div>
                        <div style="background-color: #f8fafc; padding: 20px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0;">
                            © 2026 Detetive de Fugas. Tecnologia Forense Privada.
                        </div>
                    </div>
                `
            });
            console.log("✅ E-mail Premium entregue com sucesso!");
        } catch (erroEmail) {
            console.error("❌ Falha ao entregar e-mail:", erroEmail.message);
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
        console.log("🕵️ A iniciar análise forense do documento...");
        const documentoPDF = { inlineData: { data: req.file.buffer.toString("base64"), mimeType: "application/pdf" } };
        
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro", generationConfig: { temperature: 0 } });
        
        const prompt = `Atua como um auditor financeiro forense de elite e implacável. Analisa o documento PDF em anexo (extrato). 
        Procura microscopicamente por: 1) Comissões bancárias de manutenção/cartões. 2) Subscrições digitais (Netflix, ginásios, apps). 3) Seguros e telecomunicações.
        Devolve APENAS e EXCLUSIVAMENTE um objeto JSON válido, sem crases markdown, com esta estrutura exata:
        {"total_desperdicado_mensal": 0, "total_desperdicado_anual": 0, "subscricoes_encontradas": [{"nome": "Empresa exata", "valor_mensal": 0, "categoria": "Tipo", "nivel_alerta": "Vermelho/Laranja/Amarelo"}], "mensagem_impacto": "Uma frase curta, brutal e reveladora sobre como as entidades estão a lucrar com a desatenção do cliente."}
        Se o documento NÃO for um extrato (ex: talão/comprovativo), devolve o mesmo JSON com valores a 0. Nunca incluas texto fora do JSON.`;

        const result = await model.generateContent([prompt, documentoPDF]);
        let respostaIA = result.response.text();
        
        respostaIA = respostaIA.replace(/```json/gi, "").replace(/```/g, "").trim();
        const jsonLimpo = respostaIA.substring(respostaIA.indexOf('{'), respostaIA.lastIndexOf('}') + 1);
        
        let dadosParsed;
        try {
            dadosParsed = JSON.parse(jsonLimpo);
            // --- ATUALIZA A ESTATÍSTICA GLOBAL EM TEMPO REAL ---
            if (dadosParsed && typeof dadosParsed.total_desperdicado_anual === 'number' && dadosParsed.total_desperdicado_anual > 0) {
                motorStats.utilizadoresAtivos += 1;
                motorStats.auditoriasRealizadas += 1;
                motorStats.somaPrejuizos += dadosParsed.total_desperdicado_anual;
                motorStats.totalResgatado += dadosParsed.total_desperdicado_anual; 
            }
        } catch(e) {
            console.error("Erro a atualizar dados estatísticos", e);
        }

        console.log("✅ Análise forense concluída e Dashboard atualizado.");
        res.status(200).json({ sucesso: true, dados: dadosParsed });

    } catch (error) {
        console.error("❌ ERRO NO MOTOR IA:", error.message);
        if (error.status === 429 || String(error.message).includes('429')) {
            return res.status(429).json({ sucesso: false, erro: 'Rede sobrecarregada. Tenta em 30 segundos.' });
        }
        res.status(500).json({ sucesso: false, erro: 'Documento ilegível. Garante que é um extrato PDF padrão.' });
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
                price_data: { 
                    currency: 'eur', 
                    product_data: { 
                        name: 'Relatório Forense & Minutas Legais',
                        description: 'Desbloqueio imediato das entidades ocultas e ferramentas de cancelamento.'
                    }, 
                    unit_amount: 499 
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${req.protocol}://${req.get('host')}/sucesso.html`,
            cancel_url: `${req.protocol}://${req.get('host')}/auditoria.html`,
        });
        res.json({ url: session.url });
    } catch (error) {
        console.error("❌ Erro no Stripe:", error.message);
        res.status(500).json({ erro: 'Erro de comunicação com a Gateway de Pagamento.' });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Motor Bilionário a faturar na porta ${PORT}`));